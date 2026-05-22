# ORM Cache Consistency Bug — Diagnosis and Fix

**Status:** Fixed and verified.
**Scope:** `l8physio` — service activation in `physio_demo` and `boostapp_demo`.
**Files changed:**
- `go/physio/boostapp/main/main.go` — boostapp_demo refactored to pure-consumer mode.
- `ORM_CACHE_CONSISTENCY.md` — this document.
- `go/physio/clients/PhyClientService.go` — restored to canonical form (an earlier cache-disable workaround on this file is gone).

---

## TL;DR

`physio_demo` and `boostapp_demo` both called `ActivateAllServices`, which activated all 14 physio ORM services in both processes. Each process held its own in-memory cache and its own postgres connection for the same tables. Writes from `boostapp_demo` updated postgres but never reached `physio_demo`'s cache; the UI served by `physio_demo` showed stale data permanently.

The fix: `boostapp_demo` activates **no** services. It is a pure consumer that accesses every service (including `BstpCal`, which it used to "own") over the vnet, routed to the single owning process: `physio_demo`.

---

## Original Symptoms

After `boostapp_demo` auto-onboarded 25 clients:
- `select count(*) from physioclient` → **25** ✓
- `GET /physio/50/PhyClient` (served by `physio_demo`) → **14**, with `metadata.keyCount.Total==14` ✗
- The UI displayed those 14 indefinitely. Restarting `physio_demo` was the only way to recover, after which the count would freeze again at whatever number the cache loaded on the next cold-start.

## Reproduction (original)

1. Both processes start; postgres is empty. Both caches initialize to size 0.
2. `boostapp_demo` auto-onboards 25 clients via its local `PhyClient` handler — writes go straight to postgres and update boostapp's local cache only.
3. State: boostapp cache = 25, postgres = 25, **physio_demo cache = 0**.
4. A REST request hits `physio_demo`. Cache is empty → falls through to DB → reads 14 rows (mid-sync) → caches them.
5. `boostapp_demo` finishes the remaining 11 writes to postgres.
6. Every subsequent read on `physio_demo` returns those 14 from cache. Cache is non-empty, so the DB fallback never fires again. **physio_demo is permanently frozen at 14.**

---

## Root Cause

This is **not** a cache synchronization problem; it is an architectural violation, amplified by a second framework-level issue in the service-group machinery.

### Primary cause: dual ownership of the same database table

Two processes were both acting as owners of every physio ORM table. Each activated its own local ORM handler, each got its own in-memory cache, each held its own direct postgres connection. There was no mechanism for one cache to learn about the other's writes.

The correct architecture is **one process owns a Prime Object's database table**. Any other process that needs that data must interact with the owning service over the vnet (service mesh RPC), not activate its own local ORM handler.

### Secondary cause: L8SG service-group conflates infrastructure with transaction participation

`l8common.ActivateService` puts every ORM service in a single service group (`"L8SG"`) by default. The framework then resolves transaction participants at the **group** level:

- `ServiceManager.GetParticipants("PhyClient", 50)` calls `resolveGroup(...)` → returns `("L8SG", 0)` → returns every node that has activated *any* service in L8SG.
- `transaction/states/T03_Run.go:60` uses that participant set as the broadcast target list for each transactional write.

So the moment any other node activates anything in L8SG, it joins the participant set for every L8SG service — even services it has no handler for. Those messages arrive, are dispatched locally, find no handler, and the transaction fails quorum. **The write is silently aborted on the owner, but the originator still receives a non-error response.**

---

## Investigation Timeline

This took multiple attempts because two layered failure modes hid each other.

### Attempt 1 — Disable PhyClient cache (band-aid)

Hypothesis: if `physio_demo`'s cache is the stale one, disable it so every read hits postgres.

Implementation: inlined `l8c.ActivateService` for `PhyClient` and passed `SetArgs(p, false)` to turn off the cache. Trade sub-ms cache reads for correctness.

Outcome: masked the symptom locally but did not address the dual-ownership problem. Discarded once the architectural reframe (next attempt) was understood.

### Attempt 2 — boostapp_demo activates only the service it "owns" (BstpCal)

Hypothesis: only `physio_demo` should activate physio ORM services. `boostapp_demo` becomes a remote consumer for `PhyClient`. Since `l8c.PostEntity`/`GetEntities`/etc. already fall back to `vnic.Request(...)` when no local handler is present, no call-site changes should be needed.

Implementation:
- Replaced `services.ActivateAllServices(...)` with `boostapp.Activate(...)` in `boostapp_demo`'s main.
- Reverted the PhyClient cache-disable workaround.

Immediate failures discovered:
- `Unknown proto name PhysioClient in registry` — without local activation, the proto types are no longer registered. Fixed by adding `Registry().Register(&physio.PhysioClient{})` and `Registry().Register(&physio.PhysioClientList{})`.
- `Cannot find node for table PhysioClient` from `l8ql/.../Query.go:239` — `vnic`'s `createElements` (in `l8bus/.../SendForward.go:70`) parses the SQL string locally **before sending** when the request body is a `string` or `*L8Query`. The parser needs the introspector to know the table. Fixed by adding `Introspector().Inspect(&physio.PhysioClient{})`.

After those two fixes, POSTs started logging `ONBOARDED ...` and re-fetches started returning the new clients — but a `Cannot find active handler for service PhyClient area 50` error kept appearing, twice per write (once from `RX.go:165`, once from `transaction/TransactionsRequests.go:95`). Initially diagnosed as cosmetic noise from the framework's `SetReplicationCount(3)` default.

### Attempt 3 — Disable replication on PhyClient

Hypothesis: the noise is the replication multicast looking for replicas that don't exist. Override `SetReplication(false)` + `SetReplicationCount(1)` to suppress it.

Implementation: re-inlined `clients.Activate` with the new replication settings.

Discovery: this changed nothing. **And the "noise" wasn't noise** — direct postgres query showed `count = 0` despite 26 `ONBOARDED` log lines.

Reading `transaction/states/T03_Run.go`:

```go
if service.TransactionConfig().Replication() {
    targets = replication.ReplicationFor(...)
    isReplicate = true
} else {
    targets = this.nic.Resources().Services().GetParticipants(msg.ServiceName(), msg.ServiceArea())
}
ok, peers := requests.RequestFromPeers(msg, targets, this.nic, isReplicate)
```

When replication is off, the framework falls through to `GetParticipants(...)` — which (via the L8SG group resolution above) still includes every node that activated anything in L8SG. `boostapp_demo` was a participant because it activated BstpCal. The broadcast still happened; quorum still failed; the write was still silently dropped.

### Attempt 4 — boostapp_demo activates nothing (✅ correct fix)

Hypothesis: the only way out of the L8SG participant set is to not be in L8SG at all. That means `boostapp_demo` cannot activate **any** service.

Implementation (final):
- Removed `boostapp.Activate(...)` from `boostapp_demo`.
- Reverted `PhyClientService.go` to canonical form.
- Added explicit `Registry().Register(...)` for the types boostapp_demo posts/gets: `PhysioClient`, `PhysioClientList`, `BoostappCalendarEvent`, `BoostappCalendarEventList`.
- Added `Introspector().Inspect(...)` for `PhysioClient` and `BoostappCalendarEvent` (anything used with the empty-filter / `select * from X` shortcut).
- Replaced the local `handler.Delete(...)` call in `deleteOldEvents` with `nic.Request("", boostapp.ServiceName, boostapp.ServiceArea, ifs.DELETE, evt, 30)` so deletions also route over the vnet.

---

## The Fix

### Before (broken)
```go
// physio_demo
services.ActivateAllServices(...)  // activates 14 services locally ✓ (owner)

// boostapp_demo
services.ActivateAllServices(...)  // activates 14 services locally ✗ (not owner)
// PhyClient writes go directly to postgres, bypassing physio_demo's cache
```

### After (correct)
```go
// physio_demo — owns all physio ORM services
services.ActivateAllServices(...)

// boostapp_demo — pure consumer; activates nothing
nic.Resources().Registry().Register(&physio.PhysioClient{})
nic.Resources().Registry().Register(&physio.PhysioClientList{})
nic.Resources().Registry().Register(&physio.BoostappCalendarEvent{})
nic.Resources().Registry().Register(&physio.BoostappCalendarEventList{})
nic.Resources().Introspector().Inspect(&physio.PhysioClient{})
nic.Resources().Introspector().Inspect(&physio.BoostappCalendarEvent{})
// All PhyClient and BstpCal calls auto-route to physio_demo via vnet RPC
```

### Auto-routing mechanism

`l8c.PostEntity` / `GetEntities` / `GetEntity` / `PutEntity` (in `l8common/go/common/service_factory.go`) check for a local service handler first and fall back to `vnic.Request(...)` when none exists. Removing the local activation is sufficient — call sites unchanged.

### Why the consumer-side type registration is necessary

Activation has two side effects beyond installing the handler:
1. `Registry().Register(serviceItem)` and `Register(serviceItemList)` — enables wire-format (de)serialization of those proto messages.
2. `Introspector().Inspect(serviceItem)` (via `AddPrimaryKeyDecorator`) — enables the L8QL parser to resolve the type name as a "table node."

When a process consumes a service without activating it, both effects have to be reproduced manually for the types it sends or receives. The first is needed to decode responses (POST acks, transaction callbacks). The second is needed because `vnic`'s `createElements` (in `l8bus/.../SendForward.go`) **parses SQL strings locally before sending**, so the sender must be able to resolve table names too.

---

## Verification

Verified on a fresh run after the final fix (postgres started empty):

| Metric | Before fix | After fix |
|---|---|---|
| `ONBOARDED` log lines | 26 | 26 |
| `select count(*) from physioclient` | **0** (silent loss) | **26** ✓ |
| `Cannot find active handler for service PhyClient` errors | 52 (2/POST) | **0** ✓ |
| `ONBOARD FAIL` log lines | 0 | 0 |
| `Sync complete` line | 47 posted, 0 failed | 47 posted, 0 failed |
| Re-link after onboarding | `have 0 PhysioClients` | `have 26 PhysioClients` ✓ |
| Events linked | 0/47 | 2/47 |
| Participants linked | 0/76 | 70/76 |

The decisive numbers:
- **DB count matches the onboard count** (26 = 26): writes are actually persisting.
- **Re-fetch after onboarding sees the new clients** (`have 26 PhysioClients`): physio_demo's cache reflects the writes immediately, which is the cross-process consistency that was the entire point.

---

## Architectural Rule

This bug led to the `single-owner-database-table` rule:

> Only one process may activate the ORM service for a given Prime Object. All other processes that need access to that data must reach the owning service via vnet RPC.

In our deployment, `physio_demo` owns every L8SG ORM service. Any other process (`boostapp_demo`, future workers, etc.) must be a pure consumer: no activations, only `Registry().Register(...)` + `Introspector().Inspect(...)` + `l8c.PostEntity/GetEntities/...` calls.

A corollary worth restating, since it tripped us up: **activating one L8SG service makes a node a participant for every L8SG service.** The participant set is group-scoped, not service-scoped. You can't "just activate the one service you own" if your peers expect a different ownership story.

---

## Framework Concerns / Upstream Asks

Two intertwined defaults in `l8common.ActivateService` make this bug class easy to fall into and hard to opt out of:

1. **Hardcoded `SetReplication(true)` + `SetReplicationCount(3)`.** Not configurable via `ServiceConfig`. A service with one true owner cannot declare itself non-replicated without inlining the helper.
2. **All ORM services share `ServiceGroup="L8SG"`**, and `ServiceManager.GetParticipants(...)` resolves participation at the **group** level. Group membership is currently treated as both "shared infrastructure / leader election" and "transaction participant set." These two concerns should be separated.

Suggested upstream changes:
- Expose replication and transactional settings in `ServiceConfig` so single-owner services can opt out without inlining.
- Decouple service-group membership from per-service participant resolution. A node should be a transaction participant for a given service only if it has actually activated *that* service.
- Surface transaction-quorum failure as a real error response, not a non-error reply. The silent-drop behavior we hit (`ONBOARDED` logged, row absent from postgres) is the worst possible failure mode; the originator has no way to know the write didn't land.

Until those land, the only safe deployment shape is: **one process owns all L8SG services; every other process is a pure consumer.**

---

## Why NOT distributed cache sync

An earlier proposal suggested switching `OrmService` from `cache.NewCache` to `dcache.NewDistributedCache` and wiring up `Notify` handlers for cross-process cache propagation. This would mask the original symptom but is the wrong approach because:

- It adds significant complexity (distributed cache protocol, notification serialization, init-time race mitigation, loop prevention, backpressure handling) to solve a problem that shouldn't exist.
- It papers over the architectural violation instead of fixing it.
- It would not have caught the secondary L8SG service-group bug at all.
- The framework's `dcache` machinery exists for cases where distributed state is genuinely needed (like `ReplicationService`'s node index). ORM data tables are not that case — they have a single owner by design.

---

## Open Follow-ups (separate from this fix)

- **Startup ordering.** If `boostapp_demo` starts before `physio_demo` is reachable on the vnet, its initial sync iteration will fail until `physio_demo` comes up. The 15-minute retry loop covers steady state, but the first iteration runs immediately on startup. Worth confirming the vnic layer blocks or retries appropriately, or adding an explicit readiness wait.
- **Cold-start cache race.** Even with single ownership, a request that hits `physio_demo` during initial postgres load could populate the cache with a partial set and then never refresh (the cache-fallback only triggers when the cache is empty). Out of scope here; worth a separate ticket.
- **Idempotent client provisioning.** Re-running boostapp_demo against a partly populated database produces `User already exists cli-NNN` messages from `provisionClientUser`. The onboard path should skip provisioning when the user already exists rather than relying on the secure layer to fail the call.
