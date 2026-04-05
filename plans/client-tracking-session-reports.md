# Client Tracking — Session Reports

## Objective
Implement the Client Tracking & Program Adjustment System described in `Client_Tracking_System_Full.pdf`. After every session, the coach/therapist submits a structured report for the client. The system tracks pain, difficulty, adjustments, and a Green/Yellow/Red status. Management works by exception — focus on Yellow and Red cases.

---

## Proto Design

### New Enums

```protobuf
enum SessionStatus {
  SESSION_STATUS_UNSPECIFIED = 0;
  SESSION_STATUS_GREEN       = 1;  // Progressing as planned
  SESSION_STATUS_YELLOW      = 2;  // Needs attention
  SESSION_STATUS_RED         = 3;  // Significant issue, escalation needed
}

enum AdjustmentLevel {
  ADJUSTMENT_LEVEL_UNSPECIFIED = 0;
  ADJUSTMENT_LEVEL_NONE        = 1;  // Level 1: No change needed
  ADJUSTMENT_LEVEL_LOCAL       = 2;  // Level 2: Reduced ROM/load, regression, swap variable
  ADJUSTMENT_LEVEL_MAJOR       = 3;  // Level 3: Phase/protocol change or escalation
}

enum DifficultyType {
  DIFFICULTY_TYPE_UNSPECIFIED   = 0;
  DIFFICULTY_TYPE_PAIN          = 1;
  DIFFICULTY_TYPE_ROM           = 2;  // Range of motion limitation
  DIFFICULTY_TYPE_LOAD          = 3;  // Load too heavy
  DIFFICULTY_TYPE_COORDINATION  = 4;
  DIFFICULTY_TYPE_FATIGUE       = 5;
  DIFFICULTY_TYPE_OTHER         = 6;
}
```

### New Prime Object: SessionReport

```protobuf
message SessionReport {
  string              report_id            = 1;
  string              client_id            = 2;
  string              therapist_id         = 3;
  int64               session_date         = 4;
  string              protocol_id          = 5;
  PhysioPhase         current_phase        = 6;
  int32               pain_before          = 7;   // 0-10 scale
  int32               pain_during          = 8;   // 0-10 scale
  int32               pain_after           = 9;   // 0-10 scale
  bool                had_difficulty       = 10;
  string              difficulty_exercise_id = 11;
  DifficultyType      difficulty_type      = 12;
  bool                adjustment_made      = 13;
  string              adjustment_details   = 14;
  AdjustmentLevel     adjustment_level     = 15;
  bool                followup_required    = 16;
  bool                phase_change_needed  = 17;
  SessionStatus       status               = 18;
  string              notes                = 19;
  l8common.AuditInfo  audit_info           = 30;
}

message SessionReportList {
  repeated SessionReport list     = 1;
  l8api.L8MetaData       metadata = 2;
}
```

### Prime Object Test
- **Independence**: A session report exists on its own — it records what happened at a specific session
- **Own lifecycle**: Created after each session, never edited (historical record), queried independently
- **Direct query need**: "Show all Yellow/Red reports", "Show all reports for client X", "Show reports from this week"
- **No parent dependency**: Meaningful on its own without referencing a parent

---

## Service Design

| Property | Value |
|----------|-------|
| ServiceName | `SessRpt` (8 chars, under 10) |
| ServiceArea | `byte(50)` (same as all physio services) |
| PrimaryKey | `ReportId` |
| Package | `go/physio/sessionreport/` |

### Service Callback
- **POST**: Auto-generate `ReportId`, validate required fields (`ClientId`, `TherapistId`, `SessionDate`, `Status`)
- **PUT**: Allow updates (coach may revise a report)
- No special validation beyond required fields

---

## UI Design

### Enums — `physio/sessionreport/sessionreport-enums.js`

```javascript
PhysioManagement.enums.SESSION_STATUS = factory.create([
    ['Unspecified', null, ''],
    ['Green', 'green', 'layer8d-status-active'],
    ['Yellow', 'yellow', 'layer8d-status-warning'],
    ['Red', 'red', 'layer8d-status-error']
]);

PhysioManagement.enums.ADJUSTMENT_LEVEL = factory.create([
    ['Unspecified', null, ''],
    ['No Change', 'none', ''],
    ['Local Adjustment', 'local', 'layer8d-status-warning'],
    ['Major Change', 'major', 'layer8d-status-error']
]);

PhysioManagement.enums.DIFFICULTY_TYPE = factory.simple([
    'Unspecified', 'Pain', 'ROM Limitation', 'Load Too Heavy',
    'Coordination', 'Fatigue', 'Other'
]);
```

### Columns — `physio/sessionreport/sessionreport-columns.js`

Key columns: Session Date, Client (reference), Therapist (reference), Status (status badge), Pain Before/During/After, Adjustment Level, Difficulty, Follow-up Required.

### Forms — `physio/sessionreport/sessionreport-forms.js`

Two sections:
1. **Session Info**: client (reference), therapist (reference, readOnly when pre-filled), date, protocol (reference, readOnly when pre-filled), current phase (select, pre-filled from plan), status
2. **Assessment**: pain before/during/after (number 0-10), had difficulty (checkbox), difficulty exercise (reference with `baseWhereClause` to filter by client's active plan exercises), difficulty type (select), adjustment made (checkbox), adjustment details (text), adjustment level (select), followup required (checkbox), phase change needed (checkbox), notes (textarea)

**Auto-population pattern:** When the form is opened from the client popup (Phase 4), the `generateFormHtml(formDef, prePopulatedData)` call passes pre-filled data from the active treatment plan. When opened from the main Session Reports table, the form starts empty.

### Config — add to `physio-config.js`

Add `'reports'` service entry under `management` module:
```javascript
svc('reports', 'Session Reports', 'clipboard-icon', '/50/SessRpt', 'SessionReport')
```

### Section HTML — add to `physio.html`

Add subnav item and table container for `reports`:
```html
<a class="l8-subnav-item" data-service="reports">Session Reports</a>
...
<div class="l8-service-view" data-service="reports">
    <div class="l8-table-container" id="management-reports-table-container"></div>
</div>
```

### Type Registration — add to `go/physio/ui/main.go`

```go
l8c.RegisterType(resources, &physio.SessionReport{}, &physio.SessionReportList{}, "ReportId")
```

---

## Integration with Client Popup

In the client's Workout Plan popup (`clients-exercises.js`), add a new tab **"Session Reports"** that shows a filtered table of all session reports for that client.

**"Add Report" button** opens the session report form pre-filled with context from the active treatment plan:
- `clientId` — from the client record
- `therapistId` — from `sessionStorage.getItem('currentUser')` mapped to the therapist record (same pattern as `workout-builder-assign.js` line 103)
- `protocolId` — from the active treatment plan's `protocolId`
- `currentPhase` — from the active treatment plan or the first exercise's phase
- `difficultyExerciseId` reference picker — filtered with `baseWhereClause` to only show exercises in this client's active plan (uses exercise IDs from `_currentPlan.exercises`)

Pre-populated data is passed via `generateFormHtml(formDef, prePopulatedData)` — the existing pattern supported by both desktop and mobile form rendering.

---

## Traceability Matrix

| # | Item | Phase |
|---|------|-------|
| 1 | Add enums to `proto/physio.proto` | Phase 1 |
| 2 | Add `SessionReport` + `SessionReportList` messages to proto | Phase 1 |
| 3 | Run `make-bindings.sh` | Phase 1 |
| 4 | Create `go/physio/sessionreport/SessRptService.go` | Phase 2 |
| 5 | Create `go/physio/sessionreport/SessRptServiceCallback.go` | Phase 2 |
| 6 | Add `sessionreport.Activate()` to `activate_all.go` | Phase 2 |
| 7 | Add type registration to `go/physio/ui/main.go` | Phase 2 |
| 8 | Verify proto JSON field names against generated .pb.go | Phase 3 (precondition) |
| 9 | Create `sessionreport-enums.js` | Phase 3 |
| 10 | Create `sessionreport-columns.js` | Phase 3 |
| 11 | Create `sessionreport-forms.js` | Phase 3 |
| 12 | Verify/add reference registry entries for Client, Therapist, Protocol, Exercise | Phase 3 |
| 13 | Add `reports` service to `physio-config.js` | Phase 3 |
| 14 | Add subnav + table container to `physio.html` | Phase 3 |
| 15 | Add script tags to `app.html` (enums, columns, forms — before init) | Phase 3 |
| 16 | Add "Session Reports" tab to client popup | Phase 4 |
| 17 | `go build ./...` and `go vet ./...` pass | Phase 5 |
| 18 | End-to-end verification with `run-local.sh` | Phase 5 |

---

## Phase 1 — Proto

1. Add `SessionStatus`, `AdjustmentLevel`, `DifficultyType` enums to `proto/physio.proto`
2. Add `SessionReport` and `SessionReportList` messages
3. Run `cd proto && ./make-bindings.sh`
4. Verify: `go build ./...`

## Phase 2 — Backend Service

1. Create `go/physio/sessionreport/SessRptService.go`:
   - ServiceName: `"SessRpt"`, ServiceArea: `byte(50)`
   - PrimaryKey: `"ReportId"`
   - Functions: `Activate()`, `Reports()`, `Report()`
   - Follow exact pattern from `PhyLogService.go`

2. Create `go/physio/sessionreport/SessRptServiceCallback.go`:
   - Type check: `*physio.SessionReport`
   - SetID: `GenerateID(&entity.ReportId)`
   - Validate: `ClientId`, `TherapistId`, `SessionDate`, `Status` required

3. Add to `activate_all.go`:
   ```go
   sessionreport.Activate(creds, dbName, vnic)
   ```

4. Add to `go/physio/ui/main.go`:
   ```go
   l8c.RegisterType(resources, &physio.SessionReport{}, &physio.SessionReportList{}, "ReportId")
   ```

5. Verify: `go build ./...`

## Phase 3 — UI (Desktop)

### 3.0 Precondition: Verify proto JSON field names

Before writing any JS, extract JSON field names from generated .pb.go:
```bash
grep -A 30 "type SessionReport struct" go/types/physio/physio.pb.go | grep 'json='
```
Verify each field name used in enums/columns/forms matches the `json=fieldName,proto3` value exactly.

### 3.1 Create `go/physio/ui/web/physio/sessionreport/sessionreport-enums.js`
   - Session status, adjustment level, difficulty type enums + renderers

### 3.2 Create `go/physio/ui/web/physio/sessionreport/sessionreport-columns.js`
   - Columns: date, client, therapist, status, pain (before/during/after), adjustment level, followup

### 3.3 Create `go/physio/ui/web/physio/sessionreport/sessionreport-forms.js`
   - Two sections: Session Info + Assessment
   - Reference fields use `lookupModel`: `PhysioClient`, `PhysioTherapist`, `PhysioProtocol`, `PhysioExercise`

### 3.4 Verify/add reference registry entries

Check that every `lookupModel` used in forms has a corresponding reference registry entry. Verify existing registries:
```bash
grep -r "PhysioClient\|PhysioTherapist\|PhysioProtocol\|PhysioExercise" go/physio/ui/web/js/reference-registry*.js
```
If any are missing, add them. Required entries:
- `PhysioClient` — idColumn: `clientId`, displayColumn: `lastName`, displayFormat: `lastName, firstName`
- `PhysioTherapist` — idColumn: `therapistId`, displayColumn: `lastName`, displayFormat: `lastName, firstName`
- `PhysioProtocol` — idColumn: `protocolId`, displayColumn: `name`
- `PhysioExercise` — idColumn: `exerciseId`, displayColumn: `name`

### 3.5 Add `'reports'` service to `physio-config.js`:
   ```javascript
   svc('reports', 'Session Reports', '\uD83D\uDCCB', '/50/SessRpt', 'SessionReport')
   ```

### 3.6 Add subnav item + service view to `physio.html`

### 3.7 Add script tags to `app.html` (before `physio-init.js`):
   ```html
   <script src="physio/sessionreport/sessionreport-enums.js"></script>
   <script src="physio/sessionreport/sessionreport-columns.js"></script>
   <script src="physio/sessionreport/sessionreport-forms.js"></script>
   ```

### 3.8 Verify: JS syntax check, restart demo

## Phase 4 — Client Popup Integration

Add a "Session Reports" tab to the client popup in `clients-exercises.js` (or extract to `clients-session-reports.js` if file exceeds 500 lines):

### 4.1 Add tab button + pane
Add `"Session Reports"` tab alongside existing Workout Plan / Exercise Info / Details tabs.

### 4.2 Session reports table
Shows a `Layer8DTable` filtered by `clientId` with `baseWhereClause: 'clientId=' + clientId`.
- Table shows status badges (Green/Yellow/Red) for quick visual scanning
- Columns: date, status, pain before/during/after, adjustment level, notes

### 4.3 "Add Report" button with auto-population
When clicked, builds pre-populated data from the active treatment plan:
```javascript
var preData = {
    clientId:    client.clientId,
    therapistId: self._currentPlan ? self._currentPlan.therapistId : '',
    protocolId:  self._currentPlan ? self._currentPlan.protocolId  : '',
    sessionDate: Math.floor(Date.now() / 1000)  // today
};
// therapistId fallback: sessionStorage.getItem('currentUser')
```
Opens the form via `generateFormHtml(formDef, preData)` — fields pre-filled, coach only enters pain/difficulty/status/notes.

### 4.4 Difficulty exercise picker filtering
The `difficultyExerciseId` reference field uses a dynamic `baseWhereClause` built from the client's active plan exercises:
```javascript
// Build exerciseId filter from plan exercises
var planExIds = (self._currentPlan.exercises || []).map(function(pe) { return pe.exerciseId; });
// Pass as baseWhereClause to reference picker config
```

## Phase 5 — Verification

- [ ] `go build ./...` passes
- [ ] `go vet ./...` passes
- [ ] Start system with `run-local.sh`
- [ ] Navigate to Physio > Session Reports — table loads
- [ ] Click "Add" — form opens with all fields empty (no pre-population from main table)
- [ ] Fill in report with Yellow status, save — record appears in table with yellow badge
- [ ] Open a client popup — "Session Reports" tab shows filtered reports for that client
- [ ] Click "Add Report" from client popup:
  - [ ] `clientId` is pre-filled and read-only
  - [ ] `therapistId` is pre-filled from the active plan
  - [ ] `protocolId` is pre-filled from the active plan
  - [ ] `sessionDate` defaults to today
  - [ ] Difficulty exercise dropdown only shows exercises from the client's active plan
- [ ] Save report from client popup — record appears in both client tab and main table
- [ ] Filter session reports table by status — Yellow/Red cases highlighted

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `proto/physio.proto` | **Modify** — add 3 enums + SessionReport + SessionReportList |
| `go/types/physio/physio.pb.go` | **Regenerate** |
| `go/physio/sessionreport/SessRptService.go` | **Create** |
| `go/physio/sessionreport/SessRptServiceCallback.go` | **Create** |
| `go/physio/services/activate_all.go` | **Modify** — add sessionreport.Activate() |
| `go/physio/ui/main.go` | **Modify** — add RegisterType for SessionReport |
| `go/physio/ui/web/physio/sessionreport/sessionreport-enums.js` | **Create** |
| `go/physio/ui/web/physio/sessionreport/sessionreport-columns.js` | **Create** |
| `go/physio/ui/web/physio/sessionreport/sessionreport-forms.js` | **Create** |
| `go/physio/ui/web/physio/physio-config.js` | **Modify** — add reports service |
| `go/physio/ui/web/sections/physio.html` | **Modify** — add subnav + container |
| `go/physio/ui/web/app.html` | **Modify** — add script tags |
| `go/physio/ui/web/physio/clients/clients-exercises.js` | **Modify** — add Session Reports tab |

---

## Known Risks

| Risk | Mitigation |
|------|-----------|
| File size of `clients-exercises.js` after adding tab | Extract session reports tab to `clients-session-reports.js` if over 500 lines |
| `difficulty_exercise_id` reference picker needs exercise data | Use same `_exerciseMap` already loaded in client popup |
| Pain fields (0-10) need input validation | Use `type: 'number'` with `min: 0, max: 10` in form definition |
| Missing reference registry entries | Phase 3.4 verifies and adds missing entries before forms are created |
| JS field name mismatch with proto | Phase 3.0 precondition verifies all JSON names from .pb.go before writing any JS |
