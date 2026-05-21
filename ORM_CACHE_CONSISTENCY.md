# ORM Cache Consistency Bug — Diagnosis and Proposed Fix

Status: Proposal for peer review.
Scope: `l8orm` (specifically `OrmService`), with collaborating types in `l8services/dcache`, `l8bus/vnic`, and `l8types/ifs`.

## Summary

`OrmService` uses a process-local in-memory cache that is never updated by writes happening in peer processes. When the same ORM service is activated on more than one node — which is the *intended* HA pattern, since `service_factory.go` sets `SetTransactional(true)`, `SetReplication(true)`, `SetReplicationCount(3)` — each node's cache silently diverges. After the first read on a node falls through to the DB, that node's cache "freezes" at that snapshot; subsequent peer writes are invisible to it indefinitely, even though they are committed to the shared database.

The framework already ships everything needed to fix this (`dcache`, `IServiceCacheListener`, vnic Notify multicast). `OrmService` just isn't wired to it.

## Reproduction

Two processes — `physio_demo` and `boostapp_demo` — both call `services.ActivateAllServices(...)`, which (via `l8c.ActivateService`) registers the `PhyClient` ORM service in each process. Both call `sla.SetArgs(p, true)` so caching is enabled.

Timeline observed:

1. `T0` — both processes start; postgres is empty. Both caches initialize to `Size==0` via `loadCacheInitElements` (vendor/.../l8orm/go/orm/persist/OrmCache.go:116).
2. `T0+Δ` — `boostapp_demo`'s `autoOnboardUnlinked` calls `l8c.PostEntity("PhyClient", 50, ...)` 25 times. `PostEntity` finds boostapp's own local handler (service_factory.go:198–202) and calls it directly. Each call: `OrmDoAction.go:do` → `cacheAction` → `cachePost` (boostapp's local cache only) → `orm.Write` (postgres).
3. Result: boostapp cache = 25, postgres = 25, **physio_demo cache = 0**.
4. A REST request lands on physio_demo (web tier routing). `OrmService.Get` calls `cacheFetch` (OrmService.go:215), which returns `nil` because cache `Size==0` (OrmCache.go:73). Falls through to `fetchFromDbAndCache` (OrmCache.go:107), reads postgres (say 14 rows at that moment, mid-sync), populates physio_demo's cache with those 14, returns them.
5. boostapp finishes the remaining 11 writes to postgres.
6. Every subsequent read on physio_demo: `cacheFetch` returns those 14 from cache (cache is non-empty, so the DB fallback never re-fires). **physio_demo's cache is permanently frozen at 14.** Postgres has 25. UI shows 14 until physio_demo restarts.

Confirmed in `/tmp/run.log` and direct postgres query:
- `select count(*) from physioclient` → 25
- `GET /physio/50/PhyClient` → 14 (with `metadata.keyCount.Total==14`)

Same pattern applies to every subsequent boostapp sync: each new client onboarded is invisible to physio_demo's cache.

## Root cause

Three structural facts in `l8orm` produce the bug together:

1. **OrmService uses a plain local cache, not a distributed one.**
   In `vendor/.../l8orm/go/orm/persist/OrmService.go:89`:
   ```go
   this.cache = cache.NewCache(sla.ServiceItem(), initElements, nil, vnic.Resources())
   ```
   That's `cache.NewCache` from `l8utils/cache`. The 3rd argument is `nil` — no listener.

2. **OrmService writes do not propagate to peers.**
   `OrmService.Replication() bool { return false }` (OrmService.go:240), with the comment *"ORM operations are not replicated by default."* So at the transaction layer, peer `OrmService` instances are never told a write happened.

3. **Cache reads short-circuit the DB once the cache has any entry.**
   `OrmCache.go:73`: `cacheFetch` returns `nil` only when `Size==0`. Anything ≥ 1 returns the cache view directly. `OrmService.Get` (OrmService.go:215) calls `cacheFetch` first; the DB fallback only runs on `nil`.

In a single-process deployment the local cache is consistent with postgres because all writes go through it. In a multi-process deployment — the deployment the SLA's `replicationCount=3` actively encourages — caches diverge as soon as writes start.

The framework appears to anticipate this: `l8services/services/dcache` provides `DCache`, `NewDistributedCache`, a notification queue, and `IServiceCacheListener`; `l8services/services/replication` maintains a per-service node index; `l8bus/vnic/Notifications.go:50` defines:
```go
func (this *VirtualNetworkInterface) PropertyChangeNotification(set *l8notify.L8NotificationSet) {
    protocol.MsgLog.AddLog(set.ServiceName, byte(set.ServiceArea), ifs.Notify)
    this.Multicast(set.ServiceName, byte(set.ServiceArea), ifs.Notify, set)
}
```
i.e. when an `IDistributedCache` listener is the vnic, every local cache mutation is multicast to peers as an `ifs.Notify` message. The receiving side machinery exists too (`RX.go:154` handles `ifs.Notify`). `ReplicationService.go:47` uses `dcache.NewDistributedCache(..., vnic, ...)` — i.e. passes the vnic as listener — to get exactly this behavior for its own index.

`OrmService` does not opt into any of it.

## Proposed fix

Plug `OrmService` into the existing `dcache` machinery so that writes propagate to peer caches and reads stay fast.

### Code shape (sketch)

In `vendor/.../l8orm/go/orm/persist/OrmService.go`:

```go
// before:
this.cache = cache.NewCache(sla.ServiceItem(), initElements, nil, vnic.Resources())

// after:
this.cache = dcache.NewDistributedCache(
    sla.ServiceName(),
    sla.ServiceArea(),
    sla.ServiceItem(),
    initElements,
    vnic,                  // listener → broadcasts Notify on every mutation
    vnic.Resources(),
)
```

This requires:
- Changing `this.cache`'s type from `*cache.Cache` to `ifs.IDistributedCache`.
- Updating `OrmCache.go` helpers (`cacheGet`/`cachePost`/`cachePatch`/`cacheDelete`/`cacheFetch`/`cacheElements`/`cacheMetadata`) to call through `IDistributedCache` instead of `*cache.Cache`. The signatures already line up: `DCache.Post(v, sourceNotification ...bool)`, `Patch`, `Delete`, `Get`, `Fetch`, `Size`, `Metadata` — same shape as the underlying `cache.Cache`.

To receive notifications from peers, `OrmService` needs to handle `ifs.Notify` messages. The service mesh already routes `Notify` to the service. `OrmService` should implement (or have the SLA dispatch into) a `Notify(elements, vnic, msg, isReplica)` method that applies the change to the local cache **without** re-broadcasting it (avoiding broadcast loops). Two clean ways:

- Add a `Notify(...)` method to `OrmService` that calls `cache.Post/Patch/Delete` with `sourceNotification=true` (suppresses the outbound notification, per `DCachePost.go:24`).
- Or rely on the existing `cacheAction` path but tag the elements with a "is-replica" flag and have `cacheAction` switch on it.

The second is less invasive but needs a verified plumbing path for the flag.

### Init-time consistency

`loadCacheInitElements` reads from postgres at activation time. With the proposed change, peers that start *after* a write storm will still cold-load correctly (postgres is the source of truth), and peers that are alive during the storm will see each write via `Notify`. The narrow remaining race is a write that lands *between* a peer's `loadCacheInitElements` SELECT and the moment the peer is registered to receive notifications. Two mitigations:

- Register the peer with the service mesh and start its `Notify` subscription *before* `loadCacheInitElements` runs, then `loadCacheInitElements` after. Any write during init shows up in the cache twice (idempotent `Post`) or is delivered as `Notify` after init completes (idempotent `Post`/`Patch`).
- Or wrap init in a small reconcile pass: `loadCacheInitElements` → drain any `Notify` messages queued during init → done.

This is a known pattern for cache-with-replay-log; needs a designed choice, not a hand-wave.

### Why this matches what the framework already does for `ReplicationService`

`ReplicationService.Activate` (`vendor/.../l8services/services/replication/ReplicationService.go:47`) creates exactly this pattern for the `Replicas` service:
```go
this.cache = dcache.NewDistributedCache(
    sla.ServiceName(), sla.ServiceArea(),
    &l8services.L8ReplicationIndex{},
    nil, vnic, vnic.Resources())
```
…and its Post/Put/Patch/Delete pass `pb.Notification()` through to the cache so peer notifications don't re-fire. `OrmService` would mirror that pattern.

## Alternatives considered

1. **Disable the cache per-service** — set `enableCache=false` for any service that may be activated on multiple writers. Tiny patch, eliminates the bug, but every read hits postgres. Acceptable at small scale, lossy at large. Doesn't solve the architectural inconsistency; just removes the surface.
2. **Single-owner activation** — only one process registers the ORM service; others reach it via vnet. Breaks the current `replicationCount=3` voting expectation; the SLA layer rejects writes with "Cannot find active handler for service ... area ..." because there aren't enough voters. Would require changing the SLA defaults *and* losing HA.
3. **Operational restart** — restart the read-side process after each write storm. Not a fix; reasonable mitigation while the real fix lands.

Option 1 is the right temporary fix; Option 3 (this proposal) is the right permanent fix.

## Open questions / verification needed

Items that the implementer must verify before shipping. I haven't traced every edge:

1. **Notify receive-side dispatch.** `vnic/RX.go:154` shows `ifs.Notify` is handled, but which service-handler method actually runs on receipt? The `ifs.IServiceHandler` interface (`l8types/go/ifs/Services.go:38–39`) declares `Notify(IElements, IVNic, *Message, bool) IElements`. `OrmService` does not currently implement it. Need to confirm the dispatch path and add the method.
2. **Loop prevention.** Confirmed: `DCache.Post(v, sourceNotification=true)` suppresses outbound notification (DCachePost.go:24). The `Notify` handler in `OrmService` must call cache mutations with `sourceNotification=true`.
3. **Serialization of cache elements over the wire.** `L8NotificationSet` carries property-change descriptors — verify it round-trips full element state needed to rebuild the cache entry, or that the receiver can fetch the missing pieces. If the notification is property-level only (not full element), the receiver may need to handle "create" notifications differently from "update".
4. **Init-time race.** Pick one of the two mitigations under *Init-time consistency*; write a test that exercises the window.
5. **Interaction with `Replication()` semantics.** Currently `OrmService.Replication()` returns `false` to suppress transaction-layer replication. With cache notifications carrying writes between peers, do we still want voting/transaction replication off? Argument either way; needs a design call.
6. **Backpressure.** `DCache.nQueue` is bounded at 50000 (DCache.go:62). Under sustained write storms, queue overflow behavior needs to be defined (drop? block? trigger full re-sync?).
7. **Other consumers of `cache.NewCache` in `OrmService` style.** A grep across `l8*` modules for the same pattern (`cache.NewCache` + multi-process activation) will surface other services that may have the same bug.

## Suggested PR shape

- Patch 1: introduce `Notify` method on `OrmService` and switch `this.cache` to `IDistributedCache`. Tests for cross-process consistency.
- Patch 2: init-time race mitigation.
- Patch 3 (optional): audit other services using the same pattern and convert them.

Splitting reduces review surface and lets the init-time design call happen with a focused PR.
