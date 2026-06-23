# Realtime WebSocket Adoption — l8physio

## Status

**DEFERRED (Option γ).** This plan is parked until an upstream framework gap is
closed. Do not start implementation until the blocker in [Blocker](#blocker) is
resolved upstream.

## Goal

Push-based, in-place updates for tables and detail popups in l8physio: when a
record changes server-side, the relevant rows on every connected client refresh
within ~1s without manual reload.

Reference plan in the saichler ecosystem (mostly merged upstream):
`../saichler/probler/plans/realtime-change-notifications.md`
Follow-on:
`../saichler/probler/plans/live-ui-components.md`

## Current state (as of 2026-06-23)

### Server-side (vendored)
- `/ws` endpoint is auto-registered by `common.CreateWebServer(...)` →
  `WebService.Activate()` (`vendor/.../l8web/.../WebService.go:124`).
- `WsNotifyService` (area 0, name `"websock"`) is auto-activated and forwards
  `L8NotificationSet` multicasts to `WebSocketManager.OnNotification`
  (`vendor/.../l8web/.../WsNotifyService.go`).
- `WebSocketManager.OnNotification` ships `{action, modelType, primaryKey}` to
  WS clients. Empty `AaaIds` ⇒ broadcast-to-all.
- `register=true` keyword is parsed by `l8ql` and surfaces on `IQuery.Register()`
  (`vendor/.../l8ql/.../interpreter/Query.go:496-498`).
- `Cache.RegisterSubscription` / `UnregisterSubscription` exist
  (`vendor/.../l8utils/.../cache/Cache.go:206,216`) — see [Blocker](#blocker).

### Client-side (vendored via l8ui submodule)
- `l8ui/shared/layer8d-websocket.js` — `Layer8DWebSocket.{init,subscribe,disconnect}`.
- `l8ui/shared/layer8d-data-source.js` — appends `register=true` when
  `realtime: true`; subscribes via `Layer8DWebSocket.subscribe(modelName, cb)`.
  Bug: on `update`, sets `data[index] = msg.record` without nil-guarding
  (`shared/layer8d-data-source.js:251`). Newer `Layer8DTable._handleChangeNotification`
  in `edit_table/layer8d-table-data.js:248-258` handles missing `msg.record`
  by falling back to `fetchData`. l8physio loads both — Layer8DTable is the
  one used by main tables.
- `m/js/layer8m-table-realtime.js` + `m/js/layer8m-data-source.js` — mobile
  equivalents.

### l8physio
- None of the four portals (`app.html`, `client-app.html`, `therapist-app.html`,
  `m/app.html`) load `layer8d-websocket.js`. `Layer8DWebSocket` is `undefined`
  at runtime.
- No table sets `realtime: true`.
- All physio services activate via `common.ActivateService` (`vendor/.../l8common/.../service_factory.go:42`)
  which uses `OrmService` (stateful + voter) with `BaseService.do()` for the
  notification path. See [Blocker](#blocker).

## Sibling-project reference points

- **probler + l8erp** both already wire the client. Their pattern is the
  reference for our Phase 1 (script tag in 4 portals, `init()` after auth,
  per-table `realtime: true`).
- probler's data services use `l8inventory.InventoryService.notifyWs(...)`
  (`saichler/l8inventory/go/inv/service/InventoryService.go:118-152`) which
  multicasts to `"websock"` **unconditionally**, bypassing `HasSubscribers()`.
  That's why their WS works without `RegisterSubscription` ever being called.
- l8physio cannot use that pattern: PhysioClient/TreatmentPlan/Appointment/etc.
  need Postgres persistence, which lives in `OrmService`, not InventoryService.

## Blocker

In `vendor/.../l8services/.../BaseServiceNotifications.go:31-89`, every CRUD
through `BaseService.do()` calls `this.cache.Post/Put/Patch/Delete(elem, createNotification)`,
which returns `(n, cn, e)`. `cn` is built by
`Cache.createClientNotification(n)` (`vendor/.../l8utils/.../cache/notifications.go:27`)
which short-circuits with:

```go
if delta == nil || !this.HasSubscribers() { return nil }
```

`HasSubscribers()` is only true if `Cache.RegisterSubscription(aaaId, ...)` has
been called. **Across every saichler repo (not just vendored), nothing calls
`RegisterSubscription` outside its own unit tests.** The Read-path service
handler that was supposed to call it when `q.Register() == true` was never
written. This is the missing Phase 3.5 of
`probler/plans/realtime-change-notifications.md`.

Net effect for l8physio: every CRUD produces `cn == nil` → `Multicast(WsServiceName, ...)`
is skipped → zero WS notifications are emitted → wiring the client side
accomplishes nothing.

### Unblocks when ONE of the following lands upstream
- (β) `OrmService.Get()` (or the Read path in `l8orm/.../persist/`) is patched
  to call `cache.RegisterSubscription(q.AAAId(), q.Hash(), q.Text())` when
  `q.Register()` is true. Then per-user scoping works as designed and `cn` is
  emitted to subscribed AAAIds.
- OR the `!HasSubscribers()` gate is removed from `createClientNotification` so
  ORM-backed services emit unconditionally (broadcast-to-all), matching the
  InventoryService behaviour. Less correct, simpler.

Once either lands, bump the saichler libs in `go.mod` and proceed with the
phases below.

## Phase 1 — wire the client + verify the pipeline (single PR)

Pre-flight (do these before any code change):

1. **Model-name alignment.** Run
   `grep -oP "type \K\w+" go/types/physio/*.pb.go | sort -u`. Confirm the
   chosen opt-in table's `modelName` config string matches one of the protobuf
   type names exactly (per global rule "JavaScript UI Model Names Must Match
   Protobuf Types"). For the first target (Appointments) this should be
   `"Appointment"`.
2. **AaaIds population.** With the blocker resolved, open two browser sessions
   (different AAAIds). Connect both to `/ws`. Edit one user's entity, watch the
   other user's WS frames. Confirm only authorised AAAIds receive the
   notification. If the inactive user receives notifications they shouldn't,
   the upstream fix didn't fully wire AaaIds — gate adoption to admin/therapist
   portals only and re-open the upstream issue.

Implementation:

3. **Add script tags:**
   - `go/physio/ui/web/app.html`, `client-app.html`, `therapist-app.html`:
     `<script src="l8ui/shared/layer8d-websocket.js"></script>` after
     `layer8d-utils.js`, before `layer8d-data-source.js`.
   - `go/physio/ui/web/m/app.html`:
     `<script src="../l8ui/shared/layer8d-websocket.js"></script>` and
     `<script src="../l8ui/m/js/layer8m-table-realtime.js"></script>`.
4. **Boot the client:**
   - Desktop `go/physio/ui/web/js/app.js`: call `Layer8DWebSocket.init()`
     immediately after the auth check passes (mirror `probler/.../newui/web/js/app.js:202`).
   - Mobile `go/physio/ui/web/m/js/app-core.js`: call `Layer8DWebSocket.init()`
     in `MobileApp.init()` after `Layer8MAuth.requireAuth()` and
     `Layer8MConfig.load()` (mirror `probler/.../newui/web/m/js/app-core.js:19`).
5. **Opt one table in.** Add `realtime: true` to the Appointments table config
   (`go/physio/ui/web/physio/appointments/...`). Confirm `modelName: 'Appointment'`.
6. **Two-browser verification.** Edit an appointment in browser A; row updates
   in browser B within ~1s without manual refresh. If `msg.record` is missing
   (server doesn't push the row), the Layer8DTable fallback (`fetchData` on
   missing record) handles it — verify visually that the row reflects the new
   value.

## Phase 2 — opt in selectively (one PR per surface)

Targets, in priority order:

| Surface | Reason | Risk |
|---|---|---|
| TreatmentPlan rows in client portal | Clients see therapist edits live during a session | Edit-mode collision (see Phase 3) |
| Appointment list (therapist) | High view frequency | Low |
| Home Feedback | Status changes therapists want to see immediately | Low |
| Boostapp Calendar Events | Multi-binary fanout test (see [Open questions](#open-questions)) | Medium |

Skip:
- Exercises catalog (134 rows, low change rate, mostly read-only).
- Mock-seeded tables during active seeder runs (flood risk).

## Phase 3 — edit-mode policy

Adopt the probler plan's design decision #9 verbatim: detail popups in **edit
mode** do not receive notifications; only **view mode** popups update live.
Implementation point: the table's `_handleChangeNotification` (in
`Layer8DTable`) already only updates closed/non-edit rows. For our custom
popups (PhysioClient detail, Workout Plan editor, etc.), the WS subscription
must be paused on popup-open-edit and resumed on popup-close. Mirror
probler's `LivePopup` utility (`saichler/probler/.../js/live-popup.js`) — or
adopt it directly if the namespace permits.

## Phase 4 — iPad/iOS reliability

`layer8d-websocket.js:44-47` already does exponential backoff up to 30s on
close, but iOS Safari aggressively kills WS in background. Add a
`visibilitychange` listener that force-reconnects when the page becomes
visible again, and show a subtle "data may be stale" indicator while
disconnected. Wire in `app-core.js` (mobile only — desktop browsers handle
this fine).

## Out of scope (do not include in any phase)

- Server-side push of the full record payload (`msg.record`). The newer
  `Layer8DTable` already falls back to `fetchData` when `record` is missing,
  and re-fetch is permission-gated, so the round-trip is acceptable. Pushing
  the record would also require re-evaluating permission scopes server-side.
- A physio-side wrapper around `Layer8DWebSocket`. Per global rule "Facades Are
  a Code Smell" — call the shared component directly from `app.js` /
  `app-core.js`.
- Backporting WS support to log-vnet / log-agent / boostapp-collector. None of
  those have UIs.

## Compliance check (against Global-Rules.md)

| Rule | Status |
|---|---|
| Mobile Parity | Compliant — Phase 1 covers `m/app.html` and the mobile realtime helper. |
| Maintainability — files under 500 lines | Compliant — no new files; per-table flag + a few HTML/JS lines. |
| No Duplicate Code / Facades Are a Code Smell | Compliant — uses shared `Layer8DWebSocket`; no physio wrapper. |
| JavaScript UI Model Names Must Match Protobuf Types | Enforced via Phase 1 pre-flight grep. |
| Read Before Implementing | Compliant — research notes above. |
| Vendor All Third-Party Dependencies | Compliant — no new Go deps until the blocker is fixed; at that point, `go mod vendor` after bumping. |
| never-edit-vendor | Compliant — fix lands upstream (Option β); we do not patch the vendor copy. |

## Open questions (resolve during Phase 1)

1. **Multi-binary fanout.** physio runs five binaries on shared L8Bus
   (`physio/main`, `physio/ui`, `boostapp`, `log-vnet`, `log-agent`). The
   `WsNotifyService` lives on the *web* vnic only. Confirm the `"websock"`
   multicast from `main`'s ORM services reaches `web`'s `WsNotifyService`.
   Likely yes (multicasts are network-wide), but unverified — add a trace test.
2. **Replication × voter.** Each ORM service has replication count 3
   (`service_factory.go:60`) and is a voter. Confirm only the leader emits the
   notification, not all three replicas.
3. **Subscription TTL.** `Subscriptions.go:21` sets a 300s TTL. Once Option β
   is wired, idle tabs would silently fall off the bus after 5 min. Determine
   whether the data source needs to periodically re-issue `register=true`
   queries or whether the table's existing refresh cadence covers this.

## Resumption checklist

When picking this up (probably after Sharon merges the upstream fix):

- [ ] Confirm `RegisterSubscription` is called from `OrmService.Get()` (or
      equivalent) in upstream `l8orm`.
- [ ] Bump the affected saichler libs in `go/go.mod`; run `go mod vendor`.
- [ ] Write a tiny integration test that POSTs an entity and asserts a WS
      frame is received by a subscribed client.
- [ ] Execute Phase 1 above.
- [ ] If Phase 1 verification passes, proceed to Phase 2 surfaces in order.
- [ ] Update this file's Status to "IN PROGRESS" when work resumes; archive it
      when Phase 4 lands.
