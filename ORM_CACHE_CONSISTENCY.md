# ORM Cache Consistency Bug — Diagnosis and Fix

Status: Root cause identified. Fix is an architectural correction, not a cache infrastructure change.
Scope: `l8physio` service activation in `physio_demo` and `boostapp_demo`.

## Summary

`physio_demo` and `boostapp_demo` both call `ActivateAllServices(...)`, which activates the `PhyClient` ORM service in both processes. Both processes get their own in-memory cache and their own direct connection to the `physioclient` postgres table. When `boostapp_demo` writes clients, `physio_demo`'s cache never hears about it. The UI served by `physio_demo` shows stale data permanently.

## Reproduction

1. Both processes start; postgres is empty. Both caches initialize to `Size==0`.
2. `boostapp_demo` auto-onboards 25 clients via local `PhyClient` ORM handler → writes go directly to postgres and update boostapp's local cache.
3. Result: boostapp cache = 25, postgres = 25, **physio_demo cache = 0**.
4. A REST request hits `physio_demo`. Cache is empty → falls through to DB → reads 14 rows (mid-sync) → caches them.
5. `boostapp_demo` finishes the remaining 11 writes to postgres.
6. Every subsequent read on `physio_demo` returns those 14 from cache. Cache is non-empty, so the DB fallback never fires again. **physio_demo is permanently frozen at 14.** Postgres has 25. UI shows 14.

Confirmed via `/tmp/run.log` and direct postgres query:
- `select count(*) from physioclient` → 25
- `GET /physio/50/PhyClient` → 14 (with `metadata.keyCount.Total==14`)

## Root Cause

**This is not a cache synchronization problem. This is a design violation.**

Two processes are both acting as owners of the same database table. Each activates its own local ORM handler for `PhyClient`, giving each process direct read/write access to postgres and its own independent in-memory cache.

The correct architecture is: **only one process owns a Prime Object's database table.** Any other process that needs that data must interact with the owning service over the vnet (service mesh RPC), not activate its own local ORM handler.

The previous analysis proposed wiring `OrmService` into the `dcache` distributed cache machinery so that writes propagate between peer caches via `Notify` multicast. That would mask the symptom but is the wrong fix — it adds complexity to work around an architecture that shouldn't exist. If only one process owns the table, there is only one cache, and the problem disappears entirely.

## Fix

### What needs to change

`boostapp_demo` must NOT activate the `PhyClient` ORM service locally. Instead, when it needs to onboard clients, it must call the `PhyClient` service over the vnet — the same way any remote consumer would.

### Before (broken)
```go
// physio_demo
services.ActivateAllServices(...)  // activates PhyClient locally ✓ (owner)

// boostapp_demo
services.ActivateAllServices(...)  // also activates PhyClient locally ✗ (not owner)
// writes go directly to postgres, bypassing physio_demo's cache
```

### After (correct)
```go
// physio_demo — owns PhyClient
services.ActivateAllServices(...)  // activates PhyClient locally ✓

// boostapp_demo — consumer of PhyClient
// does NOT activate PhyClient locally
// calls the owning service over vnet:
vnic.Post("PhyClient", 50, clientData)  // routed to physio_demo via service mesh
vnic.Get("PhyClient", 50, query)        // routed to physio_demo via service mesh
```

### Implementation steps

1. **Change `boostapp_demo`'s service activation** to exclude services owned by `physio_demo` (specifically `PhyClient` and any other shared ORM services). Either use selective activation or filter `ActivateAllServices` to skip services already owned by another node.
2. **Change `boostapp_demo`'s client onboarding code** (`autoOnboardUnlinked` and similar) to call the `PhyClient` service over the vnet instead of using a local ORM handler.
3. **Verify** that after the change, `physio_demo` is the sole writer to the `physioclient` table, and `boostapp_demo`'s requests are routed through the service mesh.

### Why NOT distributed cache sync

The previous proposal suggested switching `OrmService` from `cache.NewCache` to `dcache.NewDistributedCache` and wiring up `Notify` handlers for cross-process cache propagation. This would work but is the wrong approach because:

- It adds complexity (distributed cache protocol, notification serialization, init-time race mitigation, loop prevention, backpressure handling) to solve a problem that shouldn't exist.
- It masks the architectural violation instead of fixing it.
- It creates a false sense of safety — if the notification machinery has a bug or lag, caches still diverge.
- The framework's `dcache` machinery exists for cases where distributed state is genuinely needed (like `ReplicationService`'s node index). ORM data tables are not that case — they have a single owner by design.

## Rule

This bug led to the creation of the `single-owner-database-table` rule: only one process may activate the ORM service for a given Prime Object. All other processes must access that data through the owning service via vnet RPC.
