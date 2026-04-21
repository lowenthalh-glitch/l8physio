# Head Therapist Dashboard + Exercise Swap Tracking (Service-Based)

## Context

The head therapist needs a single screen to track ALL clients — their latest feedback status, latest session report status, exercise progression/regression changes, and the ability to manually override the status color (RED/YELLOW/RED). When a therapist swaps an exercise to its progression or regression in a client's workout plan, that change needs to be logged. This replaces the earlier frontend-only plan with a proper backend service approach.

## Approach

Two new backend services:

1. **HTDash** — stored dashboard service with refresh-on-GET. The callback's Before hook on GET re-computes the dashboard data (queries PhysioClient + latest HomeFeedback + latest SessionReport + ExerciseSwapLog counts), writes/updates HeadThDashRow records into the HTDash table, then returns `continue=true` to let the normal ORM read proceed. This follows the standard service pattern — real table, real L8Query, real pagination — while keeping data fresh on every read.

2. **ExSwapLog** — standard CRUD service logging each exercise swap as an immutable record.

PhysioClient gets `override_status` (field 16, reuses SessionStatus enum) for manual color overrides via existing PhyClient PUT.

## Phase 1: Proto Changes

**File:** `proto/physio.proto`

Add enum:
```protobuf
enum SwapDirection {
  SWAP_DIRECTION_UNSPECIFIED = 0;
  SWAP_DIRECTION_PROGRESSION = 1;
  SWAP_DIRECTION_REGRESSION  = 2;
}
```

Add to PhysioClient: `SessionStatus override_status = 16;`

Add messages: `ExerciseSwapLog` (swap_id, client_id, plan_id, old_exercise_id, new_exercise_id, direction, swap_date, therapist_id, audit_info) + List, `HeadThDashRow` (row_id, client_id, client_name, therapist_id, therapist_name, last_feedback_date, last_feedback_status, last_session_date, last_session_status, override_status, swap_count, audit_info) + List.

Run `cd proto && ./make-bindings.sh`

## Phase 2: ExerciseSwapLog Service

**New:** `go/physio/exswaplog/ExSwapLogService.go` + `ExSwapLogServiceCallback.go`
- ServiceName: `"ExSwapLog"` (9 chars), ServiceArea: 50, PrimaryKey: `"SwapId"`
- Validate: ClientId, PlanId, OldExerciseId, NewExerciseId required

## Phase 3: Dashboard Service (Stored Entity, Explicit Refresh)

**New:** `go/physio/htdash/HTDashService.go` + `HTDashServiceCallback.go`
- ServiceName: `"HTDash"` (6 chars), ServiceArea: 50, PrimaryKey: `"RowId"`
- Standard service with real persistence table
- GET: pure read — no refresh logic, standard ORM read with full L8Query support (pagination, filtering, sorting)
- POST: triggers the refresh. The callback Before hook on POST:
  1. Ignores the incoming entity (POST body can be empty or a dummy)
  2. Batch query all active PhysioClients
  3. Batch query all PhysioTherapists (name map)
  4. Batch query all HomeFeedback — group by clientId, pick latest by feedbackDate
  5. Batch query all SessionReports — group by clientId, pick latest by sessionDate
  6. Batch query ExerciseSwapLog — count per clientId
  7. For each client, write a HeadThDashRow directly to the ORM (using the service handler's internal Put/Post)
  8. Return `continue=false` (the POST itself doesn't need to store anything — the refresh already wrote the rows)
- PUT/DELETE: rejected (read-only except refresh)

**UI Refresh Flow:**
1. Dashboard page loads → UI POSTs to `/50/HTDash` (triggers refresh)
2. On success → UI GETs `/50/HTDash` (reads fresh rows with L8Query)
3. "Refresh" button in toolbar repeats step 1+2

This avoids:
- Self-write recursion (POST handler writes rows, GET handler only reads)
- Concurrency issues (refresh is an explicit user action, not triggered on every GET)
- Wasteful refresh on filtered reads (GET is a pure read from stored data)

## Phase 4: Registration

**File:** `go/physio/services/activate_all.go` — add both services
**File:** `go/physio/ui/main.go` — RegisterType for ExerciseSwapLog + HeadThDashRow

## Phase 5: Security

**File:** `../l8secure/.../phy.json`
- Therapist role: GET + POST on HeadThDashRow (GET to read, POST to trigger refresh)
- Therapist role: GET + POST on ExerciseSwapLog (POST to create, GET to view history, no PUT/DELETE — swap history is immutable)

## Phase 6: UI — Swap Log POST

**File:** `go/physio/ui/web/physio/clients/clients-exercises.js`
- In `_swapExercise`, POST to `/50/ExSwapLog` with clientId, planId, oldExerciseId, newExerciseId, direction, swapDate

## Phase 7: UI — Dashboard View

**No htdash-enums.js** — the dashboard status columns reuse `PhysioManagement.enums.SESSION_STATUS_VALUES` and `PhysioManagement.render.sessionStatus` directly from sessionreport-enums.js (already loaded earlier in app.html). Creating an enums file that only aliases existing enums would violate the no-duplicate-code rule.

**New:** `go/physio/ui/web/physio/htdash/htdash-columns.js`
- Columns: Client Name, Therapist, Last Feedback Date, Feedback Status (colored dot), Last Session Date, Session Status (colored dot), Override (colored dot), Swap Count
- Status columns reference `PhysioManagement.enums.SESSION_STATUS_VALUES` and `PhysioManagement.render.sessionStatus` directly

**Update:** `go/physio/ui/web/sections/physio.html`
- Add sub-nav item: `<a class="l8-subnav-item" data-service="htdash">Dashboard</a>`
- Add service view: `<div class="l8-service-view" data-service="htdash"><div class="l8-table-container" id="management-htdash-table-container"></div></div>`

**Update:** `physio-config.js` — add `svc('htdash', 'Dashboard', 'chart', '/50/HTDash', 'HeadThDashRow')`

**Update:** `app.html`, `therapist-app.html` — add script include for htdash-columns.js (after sessionreport scripts, before physio-init.js)

**Update:** `therapist-sections.js` — show `'htdash'` in visible services

## Phase 8: Dashboard Detail Popup + Override Editing

In `physio-init.js`, override `_showDetailsModal` for HeadThDashRow. Popup has 2 tabs:

**Tab 1: Overview**
- Client info (name, therapist, status dots)
- Override dropdown (GREEN/YELLOW/RED/Clear) — on change, fetch PhysioClient, update `overrideStatus`, PUT to `/50/PhyClient`, refresh dashboard table

**Tab 2: Exercise Changes**
- Layer8DTable showing ExerciseSwapLog filtered by `clientId`
- Columns: Date, Old Exercise (name via lookup), New Exercise (name via lookup), Direction (Progression/Regression badge), Therapist
- Read-only (no edit/delete actions — immutable history)
- Query: `select * from ExerciseSwapLog where clientId={clientId}`

**New:** `go/physio/ui/web/physio/htdash/htdash-swaplog-columns.js`
- Column definitions for ExerciseSwapLog table inside the detail popup
- SwapDirection enum rendering: 1=Progression (green badge), 2=Regression (orange badge)

## Phase 9: Analytics (Progressive Enhancement)

After core works: trend arrows, compliance streak, pain sparkline, perception gap, alerts, client notes. UI-only computations — no backend changes.

## Phase 10: Mock Data

**ExerciseSwapLog** — no mock data needed. Swap logs are created by real user actions (exercise +/- buttons). The table starts empty and populates as therapists use the system.

**HeadThDashRow** — no mock data generator needed. Rows are computed and stored on every GET by the refresh-on-GET callback. As long as PhysioClient, HomeFeedback, and SessionReport have mock data (they already do), the dashboard will populate automatically.

**Reference registry** — neither HeadThDashRow nor ExerciseSwapLog are referenced by other forms via `lookupModel`. No reference registry entries needed. Documented as intentional.

## Phase 11: Mobile

**New:** `go/physio/ui/web/m/js/physio/htdash-m.js` — mobile card-based dashboard
**Update:** `m/app.html` — script include

## Phase 12: Verification

1. `go build ./...` passes after proto + service changes
2. Admin: physio section → "Dashboard" sub-nav visible → table loads all active clients with colored status dots
3. Therapist portal: "Dashboard" sub-nav visible → same data
4. Swap exercise (+/-) in workout plan → ExSwapLog record created → dashboard swap count increments on refresh
5. Override dropdown → PhysioClient overrideStatus updates → persists across refresh
6. L8Query works: filter by client name, sort by status, pagination
7. Mobile: dashboard card view loads
8. Client portal: no dashboard access (security blocks GET on HeadThDashRow)
9. No regressions: client detail view, feedback tab, reports tab still work

## Traceability

| Requirement | Phase |
|-------------|-------|
| Dashboard service (stored, refresh-on-GET) | Phase 3 |
| Exercise swap tracking | Phase 2 (service) + Phase 6 (UI POST) |
| Manual override color | Phase 1 (proto) + Phase 8 (UI) |
| Latest feedback per client | Phase 3 (callback aggregation) |
| Latest session report per client | Phase 3 (callback aggregation) |
| Swap count per client | Phase 3 (callback aggregation) |
| Section HTML sub-nav + container | Phase 7 |
| Enums/renderers for status columns | Phase 7 (direct reuse of sessionreport-enums, no new enums file) |
| View individual swap records | Phase 8 (swap log tab in dashboard detail popup) |
| Swap history immutable | Phase 5 (POST + GET only, no PUT/DELETE) |
| Dashboard refresh explicit | Phase 3 (POST triggers refresh, GET is pure read) |
| Visible to therapists | Phase 5 (security) + Phase 7 (UI) |
| Mock data | Phase 10 (not needed — documented) |
| Reference registry | Phase 10 (not needed — documented) |
| Mobile parity | Phase 11 |
| Analytics | Phase 9 |

## Files

| File | Action |
|------|--------|
| `proto/physio.proto` | Modify — SwapDirection, override_status, ExerciseSwapLog, HeadThDashRow |
| `go/types/physio/*.pb.go` | Regenerate |
| `go/physio/exswaplog/ExSwapLogService.go` | **New** |
| `go/physio/exswaplog/ExSwapLogServiceCallback.go` | **New** |
| `go/physio/htdash/HTDashService.go` | **New** |
| `go/physio/htdash/HTDashServiceCallback.go` | **New** |
| `go/physio/services/activate_all.go` | Modify — add 2 services |
| `go/physio/ui/main.go` | Modify — register 2 types |
| `go/physio/ui/web/physio/clients/clients-exercises.js` | Modify — POST swap log |
| `go/physio/ui/web/physio/htdash/htdash-columns.js` | **New** — uses sessionreport enums directly, no separate enums file |
| `go/physio/ui/web/physio/htdash/htdash-swaplog-columns.js` | **New** — ExerciseSwapLog columns for detail popup tab |
| `go/physio/ui/web/sections/physio.html` | Modify — add dashboard sub-nav + service view container |
| `go/physio/ui/web/physio/physio-config.js` | Modify — add service |
| `go/physio/ui/web/physio/physio-init.js` | Modify — override detail modal |
| `go/physio/ui/web/app.html` | Modify — script includes |
| `go/physio/ui/web/therapist-app.html` | Modify — script includes |
| `go/physio/ui/web/js/therapist-sections.js` | Modify — show htdash |
| `../l8secure/.../phy.json` | Modify — therapist security rules |
| `go/physio/ui/web/m/js/physio/htdash-m.js` | **New** — mobile |
| `go/physio/ui/web/m/app.html` | Modify — script include |

## Rule Compliance

| Rule | Status |
|------|--------|
| maintainability — max 500 lines | OK — each file well under limit |
| maintainability — ServiceName max 10 chars | OK — ExSwapLog (9), HTDash (6) |
| maintainability — no duplicate code | OK — reuses sessionreport enums/renderers directly, no alias file |
| no-go-generics | OK |
| protobuf-generation — make-bindings.sh | OK — Phase 1 |
| proto-enum-zero-value — UNSPECIFIED | OK — SwapDirection has UNSPECIFIED=0 |
| proto-list-convention — list + metadata | OK |
| prime-object-references — ID fields only | OK — string IDs, no struct refs |
| demo-directory-sync — never touch demo | OK |
| l8ui-no-project-specific-code | OK — all code in physio/ |
| l8ui-theme-compliance — --layer8d-* tokens | OK |
| mobile-rules — desktop/mobile parity | OK — Phase 11 |
| data-completeness-pipeline | OK — Phase 10 documents no mock data needed |
| reference-registry-completeness | OK — Phase 10 documents no registry needed |
| js-protobuf-field-names — verify json tags | OK — verify after proto gen |
| plan-traceability-and-verification | OK — traceability matrix + Phase 12 |
| plan-approval-workflow — write to ./plans/ | OK — will sync to ./plans/ on approval |
| checklist — config, enums, columns, section HTML, app.html | OK — all covered in Phase 7 |
| report-infra-bugs — don't work around | OK — chose stored entity to avoid framework bypass |
