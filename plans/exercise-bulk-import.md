# Exercise Bulk Import

## Status

**REWRITTEN 2026-07-09 — reuse-first restructure.** The previous
draft (bespoke `/50/PhysioExerciseImport` endpoint, custom
`Layer8ExerciseImport` JS helper, parallel desktop/mobile Import
UI) violated `plan-duplication-audit`: the l8physio project already
vends a generic import framework (`L8DataImport` UI +
`l8services/dataimport` backend) and a CSV export
(`Layer8CsvExport`). This plan now composes those primitives; only
the genuinely novel work (Override, snapshot, type-to-confirm,
post-import validation event) is bespoke.

**Amended 2026-07-09 — CSV is the default format.** Both CSV
(default) and JSON are supported. This aligns with
`Layer8CsvExport`'s default output and the framework's
`FileParser.go`, which handles both formats natively. Repeated /
nested fields on `PhysioExercise` (`joints`, `categories`,
`postures`, `AuditInfo`) require careful column-mapping treatment
in CSV — see Data model.

**Amended 2026-07-09 — Export/import format asymmetry documented.**
The shared export helpers offer three buttons per table (CSV,
Excel, PDF) but only **CSV round-trips back through import**.
"Excel" is not real XLSX — see the File formats section for
details. XLSX (real) and PDF import are explicitly out of scope
here; deferred as a separate framework contribution if ever
needed.

**Amended 2026-07-09 — Ecosystem-mechanics gaps folded in.** After
searching `/home/ubuntu/proj/src/github.com/saichler/` across ~30
projects, five concerns turned out to have no ecosystem precedent
(l8orm distributed locking, retention policies,
`L8ImportTemplate.IsDefault`, mobile `Layer8MModal`, import-template
migration) and four are partial (framework auth on `ImprtExec`,
multi-node seed race, caller-identity resolution in handlers, alarm
emission for admin-destructive ops). Sections below cite the
verified precedents where they exist (VNIC dispatch, snapshot
naming via `ArchivedAlarm`, mock phase-ordering, reference
registry) and pin down design responses where they don't.

## Goal (intent unchanged)

Admins can bulk-export and bulk-import `PhysioExercise` (area 50)
via the existing L8 data-import framework, in **CSV (default) or
JSON** format, with two modes:

- **Append** — reuse `L8DIExecute` + `/erp/0/ImprtExec` with a
  seeded `PhysioExercise` template. Blind upsert semantics depend
  on the target service's `Post` handler (verify at execution;
  extend upstream if needed).
- **Override** — bespoke physio composition (the generic framework
  has no destructive-replace path). Composes: existing export →
  bulk delete → generic import loop, wrapped in a transaction
  with a snapshot and a type-to-confirm guard.

## Non-goals

- **Any bespoke duplicate** of `L8DataImport`, `L8DIExecute`,
  `L8DITemplates`, `L8DITransfer`, `Layer8CsvExport`,
  `/erp/0/ImprtExec`, `/erp/0/ImprtTmpl`, `/erp/0/CsvExport`,
  `l8services/dataimport/*`.
- Parallel `/50/PhysioExerciseImport` or `/50/PhysioExerciseExport`
  endpoints. Reuse or extend the framework instead.
- Bespoke desktop/mobile Import UI, file-upload widget, envelope
  parser, or import result renderer.
- Diff-preview / fuzzy-name matching (as before).
- XML format. Framework supports it, but neither our export nor
  import UX exposes XML — CSV and JSON only.
- **Real XLSX** (zipped-XML modern Excel) support on either side.
  Neither the shared export helpers nor `FileParser.go` handle
  true `.xlsx` today. Deferred as a separate framework
  contribution.
- **PDF import.** PDF is fundamentally a presentation format, not
  a data format. `Layer8PdfExport` produces PDFs client-side from
  CSV; there is no reverse path.
- **Re-import of `Layer8ExcelExport` output.** The helper writes
  HTML-table bytes with an `.xls` extension (see File formats).
  `FileParser.go` will fail on that content. If a user wants the
  Excel export to round-trip, they must open it in Excel /
  LibreOffice and "Save as CSV" first — a manual step outside
  this plan.
- Bulk import for entities other than `PhysioExercise`.
- Recovery / undo after Override beyond the snapshot mechanism.

## Ecosystem-verified findings summary

Result of a `/home/ubuntu/proj/src/github.com/saichler/`-wide
audit (~30 projects) run before Phase 3 design was finalized:

**Solved by existing patterns:**
- **VNIC service registration + HTTP dispatch** —
  `l8services/dataimport/DataImport.go:82-108` (canonical
  invocation of `web.New / AddEndpoint / SetWebService /
  Activate`); `l8web/…/ServiceHandler.go:41-47` (HTTP → VNIC
  forward).
- **Snapshot/history entity convention** — `l8alarms`
  `ArchivedAlarm` (sibling service `ArcAlarm`, sibling area 10)
  is the precedent. Adopted in PR3.1 for
  `PhysioExerciseSnapshot` (service `PhyExSnap`, area 60
  proposed).
- **`IServiceCacheListener`** — interface at
  `l8types/go/ifs/Services.go:106-110` with forward-to-listener
  idiom at `l8services/dcache/DCache.go:31,77`. No application
  precedent — we're establishing use.
- **Mock generator phase-ordering** — `l8erp`
  `tests/mocks/main_phases.go` calling per-domain
  `*_phases.go` files in dependency order.
- **Reference registry** — `l8ui/shared/layer8d-reference-registry.js`
  and `l8ui/m/js/layer8m-reference-registry.js` with per-domain
  overlays (physio already has both wired).

**Partial precedents:**
- **Framework auth on `ImprtExec`** — front-door gates via
  bearer + `CanDoAction`, but `DataImportExecute.go:83` calls
  `handler.Post` directly, **bypassing per-row auth**. Target
  `PhysioExercise.Post` must enforce its own admin gate.
- **Multi-node startup seed race** — `ServiceManager.IsLeader()`
  exists but no project seeds under a leader guard. PR0.3
  establishes the pattern.
- **Caller identity in handlers** — framework has `msg.AAAId()`
  but `IServiceHandler.Post(elems, vnic)` does not receive the
  message. Workaround: client-supplied `caller_user_id` +
  server-side cross-check against front-door identity (PR3.2).
- **Alarm emission for admin-destructive ops** — alarms API
  exists; no ecosystem precedent for using it this way. Open
  decision #8.

**Not in the ecosystem — designed here:**
- l8orm row/table lock primitives (open decision #1).
- Persistent-record retention ("keep last N") — inline trim in
  PR3.1.
- `L8ImportTemplate.IsDefault` — hard-coded UI pre-selection in
  PR4.1/PR4.2.
- `Layer8MModal` — replaced with existing `Layer8MPopup`.
- Import-template drift on proto change — versioned re-seed
  logic in PR0.3.

## Mandatory reuses

Verified to exist and cover their portion of the workflow:

| Component | Location | Reused for |
| --- | --- | --- |
| `L8DataImport` UI framework | `go/physio/ui/web/l8ui/sys/dataimport/` (4 JS files + CSS) | Append-side upload + run + results UI on desktop and mobile |
| `L8DIExecute` | `l8dataimport-execute.js` | Execute-tab flow (template select → file upload → run → results) |
| `L8DITemplates` | `l8dataimport-templates.js` | `PhysioExercise` import template CRUD (target model, service, area, JSON format, column mappings) |
| `POST /erp/0/ImprtExec` | `l8services/dataimport/DataImportExecute.go` | Target-agnostic import loop; walks rows and calls `handler.Post(record)` |
| `POST /erp/0/ImprtTmpl` (CRUD) | `l8services/dataimport/*` | Template storage |
| `Layer8CsvExport` | shared JS | Base export mechanism; extended to JSON in Phase 2 (or composed physio-side) |
| `POST /erp/0/CsvExport` | `l8services/…/CsvExport` | Backend export pagination |
| `l8services/transaction/states/T05_Rollback.go` | vendored | Override transaction envelope |
| `l8events.EventRecord` | vendored (`l8types/go/types/l8events`); already registered in `main.go:159` | Post-import validation event |
| Existing `admin` role | `../../saichler/l8secure/go/secure/plugin/phy/phy.json` | Access control on all new endpoints |

## Data model

No `PhysioExercise` proto changes.

**File formats — export vs import asymmetry (verified against
shared helpers and `l8services/dataimport/FileParser.go`):**

| Format | Export today | Import today | Round-trips? |
| --- | --- | --- | --- |
| CSV | ✅ `Layer8CsvExport` (backend `POST /erp/0/CsvExport`) | ✅ `FileParser.go` → `parseCSV` | ✅ Primary round-trip path |
| JSON | ➕ Adds via PR2.2 (upstream) or physio-side fallback | ✅ `FileParser.go` → `parseJSON` | ✅ Lossless, secondary |
| Excel (`.xls` filename) | ✅ `Layer8ExcelExport` — **but not real XLSX**: it fetches CSV then writes an HTML-table with an `.xls` extension (per `shared/layer8-excel-export.js:18–20`) that Excel/LibreOffice/Sheets happen to open. | ❌ `FileParser.go` cannot read HTML — `parseCSV` will fail on the tags. | ❌ Export-only. |
| PDF | ✅ `Layer8PdfExport` (client-side PDF 1.4 built from CSV) | ❌ Not a data format | ❌ Export-only. |
| XLSX (real, zipped-XML) | ❌ Not implemented | ❌ Not implemented | N/A — deferred. |
| XML | ❌ Not exposed by shared export | ✅ `FileParser.go` → `parseXML` (framework capability, but our UI won't emit it) | Not surfaced. |
| TSV | ❌ Not exposed | ✅ Same code path as CSV | Not surfaced. |

**CSV** (default). Each row is a `PhysioExercise`. Repeated /
nested fields (`joints`, `categories`, `postures`, `AuditInfo`)
encoded per column-mapping convention — decided at execution by
reading how `l8services/dataimport/RecordBuilder.go` and
`ValueTransformer.go` handle repeated proto fields today.
Candidates: pipe-separated (`joints=HIP|KNEE`), JSON-encoded cell
(`joints=["HIP","KNEE"]`), or multiple columns (`joints_1`,
`joints_2`). Pick whichever the framework already supports.

**JSON** (optional). Each object is a protojson-serialized
`PhysioExercise`. No column-mapping ambiguity — field names and
repeated fields serialize natively.

**Excel and PDF exports** are **cosmetic transformations of the CSV
export**, generated client-side by `Layer8ExcelExport` and
`Layer8PdfExport`. Both are output-only. The Danger zone import
UI's file-input `accept` attribute is set to `.csv,.json,text/csv,
application/json` (not `.xls`, `.pdf`) so users don't inadvertently
try to re-import the wrong artifact and get an opaque parse error.

**Reused wire types** (no new definitions needed):
- `L8ImportTemplate`, `L8ImportExecuteRequest`,
  `L8ImportExecuteResponse` — from the generic framework.

**New physio-local proto types** (only for the bespoke Override
path — not a duplicate of the framework's shapes):

```proto
message PhysioExerciseOverrideRequest {
  string template_id      = 1;   // reuses L8ImportTemplate seeded in PR0.3
  string file_data        = 2;   // base64 file, same shape L8ImportExecuteRequest uses
  string file_name        = 3;
  string confirm_token    = 4;   // must equal "DELETE ALL"
  string caller_user_id   = 5;   // client-supplied; server cross-checks against bearer token identity (PR3.2 step 2b)
}

message PhysioExerciseOverrideResponse {
  int32                       inserted            = 1;
  int32                       deleted             = 2;
  repeated l8api.L8ImportRowError row_errors      = 3;   // reused framework type
  string                      snapshot_id         = 4;
  string                      validation_event_id = 5;
}

message PhysioExerciseSnapshot {
  string                    snapshot_id = 1;
  string                    created_by  = 2;
  string                    created_at  = 3;
  repeated PhysioExercise   exercises   = 4;
}
```

`PhysioExerciseSnapshot` uses `l8orm` storage via the standard prime-object
pattern (retention: last N snapshots, see open decisions).

**AuditInfo handling** (unchanged rules):
- Append updates: preserve target's `created_by` / `created_at`;
  stamp `updated_by = importing_admin`. Enforcement lives inside
  the target service's `Post`/`Put` handler — verify existing
  physio behavior at execution and reconcile if it stamps
  differently.
- Override inserts: preserve source `created_by` if present, else
  importing_admin; `updated_by = importing_admin`.

**Referential integrity & media paths.** No blocking validation
at ingest — surfaced by the post-import validation event
(Phase 5). Media path strings are imported as-is; missing blobs
are event warnings.

## Access control

Admin-only, reusing the existing `admin` role from
`../../saichler/l8secure/go/secure/plugin/phy/phy.json`.

**Backend enforcement:**
- `POST /erp/0/ImprtExec`: front-door validates the bearer token
  (`l8web/…/ServiceHandler.go:98`) and `ServiceManager.Handle`
  runs `Security().CanDoAction(...)` (`ServiceManager.go:83`).
  **But**: `DataImportExecute.Post` calls the target service's
  `handler.Post(elems, vnic)` **directly**
  (`DataImportExecute.go:83`), bypassing `ServiceManager.Handle`
  — no per-row auth recheck. Consequence: the target
  `PhysioExercise.Post` handler must itself enforce admin-only
  when the caller is coming through the import loop. Verify
  physio's existing `Post` handler applies the same role gate
  used by direct CRUD; if not, add it. Not sufficient to rely on
  the front-door bearer alone if `PhysioExercise.Post` is
  otherwise open to `therapist`.
- `PhysioExerciseOverride` VNIC handler (physio-local, sibling of
  `PhysioExercise` — see PR3.2): role-check inside the handler,
  and defense-in-depth check on the wire-payload `caller_user_id`
  against the front-door identity (see PR3.2 step 2b).
- `PhysioExerciseSnapshot` service (see PR3.1): role-check on
  Get/List endpoints.

**Frontend enforcement:**
- `L8DataImport` tab entry point hidden for non-admin (existing
  role-check pattern — verify at execution).
- Physio "Danger zone: Override library" section (Phase 4) hidden
  for non-admin.

## Phased milestones

### Phase 0 — Wire the generic framework into physio

**PR0.1 — Mount `L8DataImport` in desktop therapist admin.**
Verify script tags in `physio/app.html` (or `therapist-app.html`)
per the `data-import-system` rule: `l8dataimport.js`,
`l8dataimport-templates.js`, `l8dataimport-transfer.js`,
`l8dataimport-execute.js`, and `l8dataimport.css`, in the required
order. Ensure `L8DataImport.initialize()` is called from the
therapist-admin nav / section wiring so the tab appears.

**PR0.2 — Mount `L8DataImport` in mobile.** Same in `m/app.html`
per data-import-system rule (script order differs — verify).

**PR0.3 — Seed `PhysioExercise` import templates (CSV + JSON).**
At physio service startup, **gated on `ServiceManager.IsLeader()`
so multi-node deployments don't race** (leader-election API at
`l8services/…/manager/ServiceManager.go:233-241`; no existing
project seeds this way, so we're establishing the pattern),
seed **two** templates if they don't exist, via the
`/erp/0/ImprtTmpl` CRUD service (or ORM-direct):

- **`physio-exercise-csv` (default)** — used by every UI entry
  point that doesn't explicitly override format:
  - `TargetModelType`: `PhysioExercise`
  - `TargetServiceName`: `PhysioExercise`
  - `TargetServiceArea`: `50`
  - `SourceFormat`: `CSV`
  - `ColumnMappings`: enumerate `PhysioExercise` proto fields at
    seed time. For repeated / nested fields (`joints`,
    `categories`, `postures`, `AuditInfo`), use the encoding
    convention chosen in the Data model section — verify against
    `RecordBuilder.go` / `ValueTransformer.go` at execution.
  - `Name`: `PhysioExercise Bulk Import (CSV)`

- **`physio-exercise-json`** — alternative for lossless
  round-trip:
  - Same target config as CSV.
  - `SourceFormat`: `JSON`
  - `ColumnMappings`: identity (each field maps to itself).
  - `Name`: `PhysioExercise Bulk Import (JSON)`

**Default template mechanism (confirmed).** `L8ImportTemplate`
proto (`l8types/proto/api.proto:329-340`) has **no** `IsDefault`
field. Default selection is purely a UI concern: the
physio-scoped Danger zone (PR4.1/PR4.2) hard-codes
`physio-exercise-csv` as the pre-selected template ID. The
shared `L8DIExecute` tab (used for Append) has no per-domain
default; users pick from the dropdown each time. If a
domain-aware default becomes important, it's an upstream
contribution (`IsDefault` on `L8ImportTemplate` or a
per-domain-default-template registry).

**Template drift on proto change.** No ecosystem primitive for
this. If `PhysioExercise` proto gains or loses fields, the
seeded templates' `ColumnMappings` will silently miss them.
Mitigation: (a) bump a physio-side seed version constant; (b)
on startup, if the constant is newer than what's recorded on
the seeded templates, re-seed them (delete + re-create).
Implement as part of PR0.3.

**PR0.4 — Admin-only visibility.** Gate the `L8DataImport` tab
so it renders only for users holding the `admin` role. Reuse the
role-check pattern used by other admin-gated UI elements — verify
at execution (likely a session role lookup via `Layer8DAuth` /
`Layer8MAuth`).

### Phase 1 — Verify upsert semantics for Append

**PR1.1 — Verify.** Read `PhysioExercise` service handlers under
`go/physio/services/`. Determine `Post` behavior when a row with
the given `exercise_id` already exists:
- (a) **Upsert on POST** → Append works out of the box; PR1.2 not
  needed. Document the fact in the plan and move on.
- (b) **Insert-only, errors on existing** → PR1.2 required.
- (c) **Mixed / handler routes to Put internally** → document,
  possibly no PR1.2.

**PR1.2 — Framework-level upsert mode (conditional on PR1.1 = b).**
Contribute a `Mode` field to `L8ImportTemplate` upstream in
`l8services/dataimport`. Values: `INSERT_ONLY` (default),
`UPSERT_BY_PK`. In `DataImportExecute.Post`, when `UPSERT_BY_PK`
is set and a Get by PK finds an existing row, route to
`handler.Put(record)` instead of `handler.Post(record)`. This is
a framework-level contribution benefiting all target domains.

- Alternate route if upstream contribution is not immediately
  feasible: extend the physio `PhysioExercise.Post` handler to be
  upsert. Verify no side effects on other callers before doing
  this (CRUD UI, mocks, tests).

### Phase 2 — Export (CSV default; JSON optional)

**PR2.1 — Wire the existing exports for `PhysioExercise`.** The
shared `Layer8ExportHelper` auto-mounts **three** export buttons
(CSV, Excel, PDF) on any pagination bar whose owner sets
`endpoint` and `modelName`. Verify the `PhysioExercise` list
table (desktop and mobile) has those attributes set. If not, add
them — one-liner per platform. This makes all three exports
**available with zero new code**. Note that only CSV round-trips
back through import (see Data model asymmetry table); Excel and
PDF are export-only artifacts. Buttons appear for admins only
(existing role check on the pagination bar; verify at execution).

**PR2.2 — Optional JSON format (upstream contribution,
recommended).** Contribute a `format` field to
`Layer8CsvExport` / `POST /erp/0/CsvExport`: `csv` (default) or
`json`. When `json`, the server emits a protojson-marshaled
`{records: [...]}` (framework-level; per-domain layout can
override) rather than CSV. UI: add a small format toggle next to
the auto-mounted Export button. Benefits every domain that uses
`Layer8CsvExport`.

- **Fallback if upstream contribution is deferred:** add a
  physio-side "Export JSON" button that fetches
  `PhysioExercise` rows via the existing paginated area-50 list
  endpoint, protojson-marshals the payload, and triggers a
  browser download. Reuses framework serialization; no new
  endpoint. Kept as fallback, not the goal.

### Phase 3 — Override backend (bespoke composition)

**PR3.1 — `PhysioExerciseSnapshot` storage.** Follows the
**`ArchivedAlarm` precedent** verified in the ecosystem
(`l8alarms/proto/alm-archive.proto` and
`l8alarms/go/alm/archivedalarms/ArchivedAlarmService.go`):
snapshots live in a **sibling service** with a **sibling
service area** — not embedded in `PhysioExercise` and not sharing
its service. Concrete choices:
- **Service name:** `PhyExSnap` (mirrors alarms' `ArcAlarm`).
- **Service area:** sibling of physio exercise's area 50 — use
  area 60 unless a physio area convention already reserves that
  number (verify at execution).
- **VNIC registration:** standard pattern —
  `web.New("PhyExSnap", 60, 0)` + `ws.AddEndpoint(...)` +
  `sla.SetWebService(ws)` + `Services().Activate(sla, vnic)`
  (pattern at `l8services/dataimport/DataImport.go:82-108`).
- **Endpoints:** Create (private — only PR3.2 invokes it),
  Get(id), List (admin-only). No public "restore" endpoint —
  restoration is a manual Override re-import of the snapshot
  payload.
- **Retention: keep last N.** No ecosystem retention primitive
  exists (`l8utils/…/cache/TTL.go` is memory only; `l8alarms`
  archiving is unbounded). Trim inline: at the end of `Create`,
  count snapshots; if `count > N`, delete oldest until
  `count == N`. Suggest `N = 10`.
- Register the type in physio's `main.go` alongside existing
  registrations (`ui/main.go:159` pattern for `EventRecord`).

**PR3.2 — `PhysioExerciseOverride` VNIC handler.**

Registered as a physio-local VNIC service via
`web.New("PhyExOverride", 50, 0) + ws.AddEndpoint(...) +
Services().Activate(sla, vnic)` — same pattern as
`l8services/dataimport/DataImport.go:82-108`. The HTTP route
lands via `l8web/…/ServiceHandler.go:41-47` and dispatches into
this handler.

**Wire request** must carry `caller_user_id` explicitly.
Rationale: verified in the ecosystem audit —
`IServiceHandler.Post(elems, vnic)` receives only `IElements +
IVNic`, no `*ifs.Message`, so a custom handler **cannot read
`msg.AAAId()`** to identify the caller. Two options
considered; picked (a):
- **(a) chosen:** client extracts its own session's user_id and
  sends it in the request body. Server double-checks: the
  front-door bearer's identity (accessible via
  `Security().ValidateToken` on the way in) must resolve to the
  same user_id, else 400.
- (b) rejected for now: upstream contribution to expose
  `AAAId()` on `IVNic`. Cleaner but blocks this plan on a
  framework PR.

**Handler steps:**
1. **Admin role check.**
2. **Confirm token check**: `confirm_token == "DELETE ALL"`
   (exact, case-sensitive). 400 otherwise.
   **2b. Caller-identity double-check** (see above): body
   `caller_user_id` must match the front-door-resolved user
   from the bearer token; else 400.
3. **Concurrency lock — reality note.** l8orm exposes **no
   row/table-level lock primitive** (verified: only
   process-local `sync.Mutex` in
   `l8orm/…/plugins/postgres/Write.go`). No
   `SELECT ... FOR UPDATE`, no distributed-lock primitive.
   **Concurrent-write protection therefore depends on the chosen
   deployment strategy — see Open decision #1 (l8orm-lock
   strategy).** Under a single-node deployment (current physio
   default, per operator confirmation), an in-process
   `sync.Mutex` on the handler is sufficient and returns 409 for
   any `PhysioExercise` CRUD attempt while held. Under a
   clustered deployment, this mutex does not protect concurrent
   writes from other nodes; the deployment must adopt one of the
   options in Open decision #1 first.
4. **Parse `file_data`** (base64 → protojson OR CSV via
   `l8services/dataimport/FileParser.go`'s `ParseFile`; the
   handler picks parser based on the selected template's
   `SourceFormat`).
5. **Snapshot**: call the `PhyExSnap` service Create to
   materialize a `PhysioExerciseSnapshot` of the current table
   with `created_by = caller_user_id`. Retention trim runs
   inline (PR3.1). Snapshot is preserved even on subsequent
   rollback.
6. **Transaction envelope** (via
   `l8services/transaction/states/T05_Rollback.go`):
   a. Enumerate current `PhysioExercise` rows and delete.
   b. Insert the parsed exercises. Apply AuditInfo rules
      (Data-model section) using `caller_user_id` as
      `updated_by`. Prefer routing through the ORM directly
      rather than the target `PhysioExercise.Post` handler
      here — Post already applies the admin-only gate this
      handler has just performed, so re-entry would double-check
      the same request.
   c. Commit.
7. **On error → rollback.**
8. **Publish cache invalidation** via `IServiceCacheListener`
   (interface at `l8types/go/ifs/Services.go:106-110`,
   signature `PropertyChangeNotification(*l8notify.L8NotificationSet)`).
   Note: **no ecosystem project uses `IServiceCacheListener` for
   this purpose today** — verified. We're establishing the
   pattern; match `l8services/dcache/DCache.go:31,77` for the
   forward-to-listener idiom.
9. Return `PhysioExerciseOverrideResponse` with counts,
   `snapshot_id`, and `validation_event_id` (Phase 5).

### Phase 4 — Override UI ("Danger zone")

Not a duplicate of `L8DIExecute`. This is a small physio-scoped
destructive-action panel; the shared framework has no concept of
"replace all" and its Execute tab is exclusively additive.

**PR4.1 — Desktop Override panel.** In the therapist-admin
Exercises tab (or a `System → Danger zone` sub-section), render a
small panel:
- Template dropdown (fetches from `/erp/0/ImprtTmpl`, filtered to
  `TargetModelType == PhysioExercise`). Pre-selects
  `physio-exercise-csv` on load (CSV is the default format).
  Switching to the JSON template updates the file-input `accept`
  hint from `.csv,text/csv` to `.json,application/json`.
- File input (`accept` derived from the currently selected
  template's `SourceFormat`).
- Type-to-confirm input, placeholder `Type DELETE ALL to confirm`.
- Submit button, disabled until the input value exactly equals
  `DELETE ALL` (case-sensitive).
- Red warning banner: *"⚠ Deletes ALL existing exercises and
  replaces them with the file contents. Cannot be undone. A
  snapshot will be taken before deletion."*
- On submit → `POST /50/PhysioExerciseOverride`.
- Result modal shows `inserted / deleted / row_errors.length /
  snapshot_id / validation_event_id`, with link/hint to open event
  details.
- Visible only to admin (PR0.4-style role check).

**PR4.2 — Mobile Override panel.** Parity via **`Layer8MPopup`**
(`l8ui/m/js/layer8m-popup.js:25` — full-screen modal component;
verified this is the mobile modal primitive — no `Layer8MModal`
exists). Same fields, same predicate. Uses `Layer8MConfirm`
(`l8ui/m/js/layer8m-confirm.js:21`) for the destructive
confirmation flow if it fits better than a plain popup.

**Duplication note.** Desktop and mobile panels each carry ~30–50
LOC of behavioral logic (template fetch, gesture predicate, submit,
result render). `30–50 × 2 = 60–100 LOC` — at the edge of, but not
crossing, the 100-LOC threshold in `plan-duplication-audit`. To
prevent silent drift on the gesture predicate specifically, extract
a **3-line** shared function `Layer8DeleteAllGuard.validate(input)`
returning bool. Everything else stays platform-local.

### Phase 5 — Post-import validation event

**PR5.1 — Validation pass.** Physio-side function
`ValidatePhysioExerciseState(vnic) → ValidationResult` that walks:
1. **Chain refs.** For every `PhysioExercise`, resolve
   `progression_exercise_id`, `regression_exercise_id`,
   `rotation_group_id` against the current exercise set. Broken →
   `{exercise_id, field, missing_id}`.
2. **Plan refs.** Enumerate active `TreatmentPlan` /
   `PlanExercise` and `ProtocolExercise` records; verify each
   referenced `PhysioExercise.exercise_id` exists. Broken →
   `{owner_type, owner_id, missing_exercise_id}`.
3. **Media paths.** For each exercise with non-empty
   `image_storage_path` / `video_storage_path`, check the blob
   exists on the target. Missing → warning entry
   `{exercise_id, field, path}`.

**PR5.2 — Event emission.** If any list is non-empty, emit an
`EventRecord` via the physio event pathway (physio already imports
`l8events` — see `main.go:17,159`). Category:
`PhysioExerciseImportValidation`. Severity: `error` if chain or
plan refs are broken; `warning` if only media missing. Payload
carries the three lists. Return the event ID.

**Trigger points:**
- **Override:** invoke `ValidatePhysioExerciseState` directly at
  the end of PR3.2's handler (before returning response); embed
  event ID into `PhysioExerciseOverrideResponse.validation_event_id`.
- **Append via `/erp/0/ImprtExec`:** the generic response
  (`L8ImportExecuteResponse`) has no free field for us to hang an
  event ID on. Two acceptable paths:
  - **(a) Register a physio-side `IServiceCacheListener` on
    `PhysioExercise`** that detects a burst of writes (heuristic:
    >5 writes in <2s from the same principal) and triggers
    validation asynchronously. Event lands in the admin's event
    stream, not the import response. **Note:** no ecosystem
    project uses `IServiceCacheListener` this way today
    (verified); we're establishing the pattern. Interface at
    `l8types/go/ifs/Services.go:106-110`, forward-to-listener
    idiom at `l8services/dcache/DCache.go:31,77`.
  - **(b) Contribute a `run_post_import_hook` toggle to
    `L8ImportTemplate` upstream**, so the framework calls back
    into a physio-registered hook that returns an event ID
    appended to `L8ImportExecuteResponse`. Cleaner but upstream.
  - Recommend (a) for now; (b) as an open decision.

### Phase V — Verification

- **V1a** — Append via `L8DIExecute` with `physio-exercise-csv`
  (default): rows inserted, existing rows updated (depending on
  Phase 1 outcome). `L8ImportExecuteResponse.ImportedRows`
  matches payload; `RowErrors` empty on a clean CSV.
- **V1b** — Append via `L8DIExecute` with `physio-exercise-json`:
  same assertions, JSON path.
- **V2a** — CSV export (PR2.1) produces a payload that
  round-trips via Append, including repeated fields (`joints`,
  `categories`, `postures`).
- **V2b** — JSON export (PR2.2 or fallback) produces a payload
  that round-trips via Append. Lossless — every field preserved.
- **V2c** — **Asymmetry guard.** Uploading the file produced by
  `Layer8ExcelExport` (HTML-in-`.xls`) or `Layer8PdfExport` to
  the import framework fails cleanly with a parse-error row-error
  or 400. No silent partial import; error message names the
  format mismatch.
- **V3** — Override happy path: snapshot created, delete + insert
  atomic, `snapshot_id` populated in response, DB matches payload.
- **V4** — Override rollback: inject an error between delete and
  insert; assert previous table restored; response is 5xx;
  snapshot still exists.
- **V5** — Concurrent-write lock: while Override is running, a
  concurrent `PhysioExercise` CREATE returns 409. Reads succeed.
  After Override, subsequent writes succeed.
- **V6** — Override type-to-confirm: submit disabled until input
  matches `DELETE ALL` exactly. `delete all`, `DELETE`,
  `DELETE ALL ` (trailing space) all leave it disabled.
  Server-side check (PR3.2 step 2) rejects with 400 if the token
  is wrong even when a client bypasses the UI.
- **V7** — Post-import validation event fires (severity `error`)
  for broken `progression_exercise_id`.
- **V8** — Post-import validation event fires (severity `error`)
  for `TreatmentPlan`/`PlanExercise` referencing a
  now-missing `exercise_id` after Override.
- **V9** — Post-import validation event fires (severity `warning`)
  for missing `image_storage_path` blob.
- **V10** — Admin-only: non-admin therapist cannot see the
  `L8DataImport` tab or the Override Danger zone. Direct
  `POST /erp/0/ImprtExec` with the exercise template as non-admin
  returns 403 **because `PhysioExercise.Post` enforces the admin
  gate downstream** (framework's per-row auth bypass verified —
  Access Control section). Direct call to the Override VNIC
  handler as non-admin returns 403.
- **V10b** — Caller identity double-check: submit an Override
  request with `caller_user_id` set to a different user than the
  bearer resolves to → 400, no writes.
- **V11** — AuditInfo (Append update): existing row's `created_by`
  preserved; `updated_by = importing_admin`.
- **V12** — AuditInfo (Override insert): source `created_by`
  preserved when present.
- **V13** — Snapshot restore round-trip: run Override with
  payload A; capture `snapshot_id`; run Override with the snapshot
  payload; DB matches pre-first-Override state.
- **V13b** — Retention trim: run Override N+1 times (with
  `N = 10`); assert only the last N snapshots survive; oldest
  is deleted.
- **V14** — L8DataImport UI mounted correctly on desktop and
  mobile (script order per `data-import-system` rule; CSS loaded).
- **V15** — Multi-node seed race guard: simulate concurrent
  physio startup on two nodes; assert only one node performs
  the seed (the leader per
  `ServiceManager.IsLeader()`); the follower observes the
  seeded template and does not duplicate.
- **V16** — Framework auth bypass check: register a stub
  `PhysioExercise.Post` that logs the caller role; drive a
  non-admin `POST /erp/0/ImprtExec` and assert the log shows the
  non-admin role reached the handler (i.e., front-door didn't
  reject) **and** the handler's own role gate rejected. Confirms
  the "framework doesn't re-authorize per row" reality is being
  handled at the target-handler level.

## Duplication audit (post-restructure)

Per `plan-duplication-audit`:

- **Reused from framework (no new instances):** upload UI, run
  UI, results UI, template CRUD, import loop, export pagination.
- **New behavioral UI instances:** Override "Danger zone" panel
  × 2 platforms. Estimated 30–50 LOC each; 60–100 LOC total —
  below the 100-LOC extraction threshold. `Layer8DeleteAllGuard`
  (3-line shared predicate) extracted anyway to prevent
  case-sensitivity drift between platforms.
- **New backend paths:** Override endpoint + snapshot service +
  validation pass. All physio-local, no upstream duplicate.
- **Verdict:** No mandatory Phase 0 extraction required by the
  rule. Framework reuse retires the biggest duplication risk
  entirely.

## Traceability

| Gap | Addressed in | Platform |
| --- | --- | --- |
| G1: Bulk seed exercises | Phase 0 (framework mount) + Phase 1 (upsert), Phase 4 for Override | Backend + Desktop + Mobile |
| G2: Full library reset | PR3.2 + PR4.1/PR4.2 | Backend + Desktop + Mobile |
| G3: Mid-Override half-wipe protection | PR3.2 (T05_Rollback) | Backend |
| G4: iPad import path | PR0.2 + PR4.2 (framework and Danger zone in `/m/`) | Mobile |
| G5: Stale caches after bulk mutation | PR3.2 cache invalidation; framework inherits from target `Post` | Backend |
| G6: Silent per-row Append failures | Framework `L8ImportExecuteResponse.RowErrors` (existing) | Backend + surfaced by framework UI |
| G7: Produce import file (CSV default, JSON optional) | Phase 2 PR2.1 (CSV via existing `Layer8CsvExport`) + PR2.2 (optional JSON upstream contribution) | Backend + Desktop + Mobile |
| G8: Admin gating on all endpoints and UI | PR0.4 (UI), PR3.2 (Override), Access control section | Backend + Desktop + Mobile |
| G9: Override confirmation hard to trip | PR4.1/PR4.2 type-to-confirm + PR3.2 server-side check + `Layer8DeleteAllGuard` shared predicate | Desktop + Mobile |
| G10: Broken chain refs | PR5.1 + PR5.2 (event, error severity) | Backend |
| G11: Broken `TreatmentPlan`/`PlanExercise` refs after Override | PR5.1 + PR5.2 (event, error severity) | Backend |
| G12: Missing media blobs | PR5.1 + PR5.2 (event, warning severity) | Backend |
| G13: AuditInfo lineage | PR3.2 (Override) + verified reuse of `PhysioExercise.Post` audit rules (Append) | Backend |
| G14: Concurrent writes during Override | PR3.2 write lock | Backend |
| G15: Recovery after mistaken Override | PR3.1 snapshot + `snapshot_id` in response | Backend + Desktop + Mobile |
| G16: Framework duplication risk retired | Reuse-first plan; only genuinely new pieces are bespoke | (meta) |

## Resolved decisions

1. Match key: `exercise_id`.
2. Append: blind upsert; verify or extend upstream (Phase 1).
3. Override: full replace + `DELETE ALL` type-to-confirm.
4. Access: admin-only, reuse `admin` role from `phy.json`.
5. Media handling: paths imported as strings; missing blobs are
   validation-event warnings.
6. Broken refs (chain + plan + media): post-import validation
   event, no rollback of the import itself.
7. AuditInfo: preserve `created_by`, stamp `updated_by =
   importing_admin`.
8. Concurrent writes during Override: reject with 409.
9. Auto-snapshot on Override: yes, always.
10. Reuse policy: any function offered by another project /
    vendored framework MUST be reused. No internal duplication.
    This restructure is the direct consequence.
11. **File format:** CSV is the default; JSON is supported as an
    optional alternative for lossless round-trip. XML deferred.
    Two templates seeded (`physio-exercise-csv`,
    `physio-exercise-json`); CSV template pre-selected in UI.
12. **Export/import asymmetry:** the shared export helpers offer
    CSV, Excel, and PDF, but only CSV round-trips. `.xls`
    (HTML-in-Excel-extension) and PDF are export-only. Real
    XLSX support is deferred as a separate framework
    contribution. UI file-input `accept` restricts to `.csv` /
    `.json` to prevent users from re-uploading `.xls` or `.pdf`
    exports.

## Open decisions

1. **l8orm-lock strategy for Override concurrency.** Verified:
   l8orm has no row/table lock primitives; only process-local
   `sync.Mutex`. Three options:
   - **(a) Single-node-only guarantee.** Document that Override
     protection assumes single-node physio; use an in-process
     mutex in the Override handler. Deployment must not run
     multiple physio nodes writing to the same DB. Simplest and
     matches likely current deployment reality.
   - **(b) Make `PhysioExercise` a transactional service** —
     adopt `l8services/…/services/transaction/states/T0[123]_*.go`
     patterns and `ServiceManager.GetLeader/IsLeader`. All
     `PhysioExercise` writes (CRUD + Override) route through the
     leader; concurrent writes serialize. Impacts CRUD latency
     and complexity beyond Override.
   - **(c) Distributed lock via l8events.** Handler publishes a
     "lock claim" event; competitors observe and back off. No
     ecosystem precedent; heavy for a rarely-used feature.
   - **Recommend (a)** for now, with an explicit doc-string on
     the Override handler stating the single-node assumption;
     revisit when clustering is adopted.

2. **Upsert semantics (Phase 1).** Depends on PR1.1 findings.
   Contribute upstream (`Mode` field on `L8ImportTemplate`) or
   extend physio-side.
2. **JSON export path (Phase 2).** Upstream contribution to
   `Layer8CsvExport` (preferred) or physio-local composition.
3. **Validation event delivery for Append.** Heuristic
   `IServiceCacheListener` (physio-local) or upstream
   post-import hook contribution.
4. **Snapshot retention count.** Suggest last 10; verify against
   any project-wide retention policy at execution.
5. **Snapshot storage mechanism.** ORM row (`PhysioExerciseSnapshot`
   as a first-class prime object) is the plan's default; consider
   blob storage if payload size becomes problematic.
6. **Template-seeding mechanism.** Startup ORM insert vs
   `/erp/0/ImprtTmpl` POST from a bootstrap routine — pick at
   execution.
7. **CSV encoding for repeated / nested fields**
   (`joints`, `categories`, `postures`, `AuditInfo`). Confirm
   the convention `l8services/dataimport/RecordBuilder.go` and
   `ValueTransformer.go` already implement (pipe-separated,
   JSON-in-cell, numbered columns, etc.) and configure
   `physio-exercise-csv`'s column mappings accordingly. If none
   is well-supported, contribute one upstream or fall back to
   JSON-in-cell.
8. **Emit `l8alarms` alarm for Override in addition to the
   validation event.** Alarms API exists (`alm.Alarm{}` service
   at area 0) but no ecosystem project uses alarms for
   admin-destructive operations. Establishing that pattern here
   is a design call. Options:
   - (a) No alarm; event-only. Simplest, matches current lack of
     precedent.
   - (b) Emit a high-severity alarm on every Override so a
     dashboard can surface "someone wiped the exercise library
     at T with N rows." Better observability.
   - Recommend (b) but defer to execution.
9. **Caller identity mechanism** — locked to option (a) in
   PR3.2 (client-supplied `caller_user_id` cross-checked against
   the bearer). If an upstream contribution surfaces `AAAId()`
   on `IVNic` later, drop the wire-payload field.

## Related plans

- `plans/consumer-mobility-app.md` — parked; same reuse-first
  principle applies there when it resumes.
- `plans/consumer-mobility-security.md` — provides the
  `T05_Rollback.go` precedent used in PR3.2.
- `plans/multi-joint-category-exercises.md` — most recent change
  to `PhysioExercise` shape; verify template column mappings
  cover the fields it added.

## Rough sizing

- Phase 0 (mount + 2 templates seeded + admin gate + leader-guard
  + versioned re-seed logic): ~2–3h
- Phase 1 (verify + conditional upstream `Mode` contribution): ~1–3h
- Phase 2 (PR2.1 CSV wiring: ~0.5h; PR2.2 optional JSON
  upstream: ~1–1.5h): ~1.5–2h
- Phase 3 (Override backend: `PhyExSnap` sibling service + snapshot
  create + retention trim + Override handler + caller-identity
  cross-check + T05_Rollback envelope + single-node mutex): ~4–5h
- Phase 4 (Override UI desktop + mobile via `Layer8MPopup`,
  hard-coded default template): ~2–2.5h
- Phase 5 (validation pass + event emission +
  `IServiceCacheListener` first-use registration): ~2.5–3.5h
- Phase V verification (V1a/V1b + V2a/V2b/V2c + V3–V16): ~3–4h
- **Total: ~16–23h** — up from the previous ~13.5–20.5h,
  absorbing sibling snapshot service (PR3.1 upgrade),
  caller-identity mechanism, leader-guarded seed, retention
  trim, and additional verification (V10b, V13b, V15, V16). The
  ecosystem audit converted several "verify at execution" items
  into design work that needs explicit hours.

## Rule compliance checklist

- **`plan-duplication-audit`** ✅ PASS — reuse-first restructure
  eliminates the biggest duplication risk (bespoke Import UI +
  bespoke `/50/PhysioExerciseImport`). Remaining new UI (Override
  Danger zone × 2 platforms) is under 100-LOC threshold; the one
  behavioral bit at risk of drift (`DELETE ALL` predicate) is
  extracted as a 3-line shared function.
- **`plan-traceability-and-verification`** ✅ PASS — G1–G16 matrix
  with a Platform column; Phase V has V1–V14.
- **`plan-platform-completeness`** ✅ PASS — desktop and mobile
  covered by the mount of `L8DataImport` (PR0.1/PR0.2) and the
  Danger zone (PR4.1/PR4.2). Per-platform verification via V14
  and V6.
- **`data-import-system`** ✅ APPLIED — plan mounts and configures
  the framework rather than reinventing it. Script-load order and
  CSS load order per the rule are honored.
- **`layer8-csv-export`** ✅ APPLIED — Phase 2 extends
  `Layer8CsvExport` rather than building a bespoke export.
- **`associate-ids-scope-view`** ✅ N/A — `PhysioExercise` is a
  shared library, not user-scoped. Role-based access only.
- **`never-import-l8secure`** ✅ PASS — plan references `phy.json`
  for role names only; no l8secure imports.
- **`never-edit-vendor`** ✅ PASS — no vendor edits. Framework
  contributions (Phase 1 `Mode`, Phase 2 `format`) are upstream
  PRs to saichler, not local vendor edits.

Other l8book rules (proto conventions, service location,
protobuf generation, K8s deployment, etc.) apply at execution
time and are captured implicitly by "verify at execution"
callouts throughout the phases.
