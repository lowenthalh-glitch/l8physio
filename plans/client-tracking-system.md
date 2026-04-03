# Client Tracking & Program Adjustment System — Implementation Plan

## Context

The current l8physio system has an Exercise Bank, Workout Builder, Treatment Plans, and Progress Logs. However, there is no structured way for coaches to report on sessions, flag issues, or for the clinic owner to manage by exception. The PDF "Client Tracking & Program Adjustment System" defines the missing operational layer: a post-session report form, a Green/Yellow/Red status system, adjustment level tracking, and an exception-based management dashboard. This plan adds that layer to the existing Layer 8 ecosystem.

---

## What Exists vs What the PDF Requires

| PDF Concept | Current State | Action |
|-------------|--------------|--------|
| Exercise Bank | PhysioExercise service (working) | Keep as-is |
| Workout Builder | Builder JS (working) | Keep as-is |
| Client Copy Format | TreatmentPlan + PlanExercise (working) | Keep as-is |
| Post-Session Form (Google Form) | ProgressLog (different purpose — per-exercise tracking) | **NEW: SessionReport entity** |
| Client Tracking (Posture, Joint, Phase, Protocol, history) | Client has protocolId; phase/joint/posture on exercises | **MODIFY: Add tracking fields to PhysioClient** |
| Adjustment Levels (1/2/3) | Not modeled | **NEW: AdjustmentLevel enum** |
| Status System (Green/Yellow/Red) | Not modeled | **NEW: SessionStatus enum + client field** |
| Reports Dashboard | No dashboard | **NEW: Dashboard section** |
| Coach daily workflow | No session report form | **Enabled by SessionReport** |
| Management by exception | No filtering by status | **Enabled by Dashboard + status fields** |

**ProgressLog vs SessionReport — why both exist:**
- `ProgressLog` = per-exercise completion tracking (sets done, reps done, pain per exercise). Used by the client or coach to track what was physically accomplished.
- `SessionReport` = holistic post-session assessment by the coach. Captures pain trajectory, difficulty, adjustments made, follow-up needs, and operational status (Green/Yellow/Red). This is the PDF's "Google Form replacement."

---

## New Proto Definitions

### New Enums

```protobuf
enum PhysioDifficultyType {
  PHYSIO_DIFFICULTY_TYPE_UNSPECIFIED   = 0;
  PHYSIO_DIFFICULTY_TYPE_PAIN          = 1;
  PHYSIO_DIFFICULTY_TYPE_ROM_LIMITED   = 2;
  PHYSIO_DIFFICULTY_TYPE_FORM_BREAKDOWN = 3;
  PHYSIO_DIFFICULTY_TYPE_FATIGUE       = 4;
  PHYSIO_DIFFICULTY_TYPE_OTHER         = 5;
}

enum PhysioAdjustmentLevel {
  PHYSIO_ADJUSTMENT_LEVEL_UNSPECIFIED     = 0;
  PHYSIO_ADJUSTMENT_LEVEL_NO_CHANGE       = 1;  // Level 1 — progressing as planned
  PHYSIO_ADJUSTMENT_LEVEL_LOCAL_ADJUSTMENT = 2;  // Level 2 — reduced ROM/load, swapped variable exercise
  PHYSIO_ADJUSTMENT_LEVEL_MAJOR_CHANGE     = 3;  // Level 3 — flag for review, may need phase/protocol change
}

enum PhysioSessionStatus {
  PHYSIO_SESSION_STATUS_UNSPECIFIED = 0;
  PHYSIO_SESSION_STATUS_GREEN       = 1;  // Fine, continue as planned
  PHYSIO_SESSION_STATUS_YELLOW      = 2;  // Needs attention (pain, difficulty, mismatch)
  PHYSIO_SESSION_STATUS_RED         = 3;  // Significant issue, escalate to therapist/owner
}
```

### New Prime Object: SessionReport

```protobuf
message SessionReport {
  string                  report_id              = 1;
  string                  client_id              = 2;
  string                  coach_id               = 3;   // therapistId of the coach
  string                  plan_id                = 4;
  int64                   session_date           = 5;
  string                  protocol_code          = 6;   // e.g., "KYPH-SHO"
  PhysioPhase             current_phase          = 7;
  int32                   pain_before            = 8;   // 0-10 scale
  int32                   pain_during            = 9;   // 0-10 scale
  int32                   pain_after             = 10;  // 0-10 scale
  bool                    had_difficulty         = 11;
  string                  difficulty_exercise_id = 12;  // which exercise caused the issue
  PhysioDifficultyType    difficulty_type        = 13;
  PhysioAdjustmentLevel   adjustment_level       = 14;
  string                  adjustment_description = 15;
  bool                    follow_up_required     = 16;
  bool                    phase_change_needed    = 17;
  bool                    protocol_change_needed = 18;
  PhysioSessionStatus     session_status         = 19;  // Green / Yellow / Red
  string                  notes                  = 20;
  erp.AuditInfo           audit_info             = 30;
}

message SessionReportList {
  repeated SessionReport list     = 1;
  l8api.L8MetaData       metadata = 2;
}
```

### Modified: PhysioClient

Add one field to track the client's current operational status (derived from latest session report):

```protobuf
// Add to existing PhysioClient message:
PhysioSessionStatus  session_status  = 15;  // Latest Green/Yellow/Red from most recent SessionReport
```

---

## New Go Service

### SessionReport Service

| Property | Value |
|----------|-------|
| Directory | `go/physio/sessreport/` |
| ServiceName | `PhySessRpt` |
| ServiceArea | `byte(50)` |
| PrimaryKey | `reportId` |
| Type | `SessionReport` |

**ServiceCallback behavior:**
- `Before(POST)`: Auto-generate `reportId` via `common.GenerateID`
- `After(POST)`: Update the referenced client's `sessionStatus` field to match the report's `sessionStatus`. This is done by:
  1. GET the client by `clientId`
  2. Set `client.SessionStatus = report.SessionStatus`
  3. PUT the client back
  This ensures the client's status is always in sync with their latest session report.

**Security:** Add `*physio.SessionReport` to `ScopeView` switch in `physio_security.go` — filter by `clientId` same as other client-scoped entities. Coaches (therapists) can POST/PUT; clients can GET their own.

---

## UI Changes

### 1. Module Config — Add "Session Reports" service

**File:** `physio/physio-config.js`

Add to the management module's services:
```javascript
svc('reports', 'Session Reports', 'icon-clipboard', '/50/PhySessRpt', 'SessionReport')
```

This appears as a new sub-nav tab alongside Therapists, Clients, Exercises, etc.

### 2. Session Reports — Enums, Columns, Forms

**New files:**

`physio/reports/reports-enums.js`:
- `DIFFICULTY_TYPE`: Pain, ROM Limited, Form Breakdown, Fatigue, Other
- `ADJUSTMENT_LEVEL`: No Change (green), Local Adjustment (yellow), Major Change (red)
- `SESSION_STATUS`: Green (active), Yellow (warning), Red (error)
- Renderers for status badges

`physio/reports/reports-columns.js`:
- reportId (ID)
- clientId (custom render with PhysioLookups.clientName)
- coachId (custom render with PhysioLookups.therapistName)
- sessionDate (date)
- protocolCode (text)
- currentPhase (enum)
- painBefore, painDuring, painAfter (number)
- adjustmentLevel (enum)
- sessionStatus (status — Green/Yellow/Red badge)

`physio/reports/reports-forms.js`:
- Section "Session Info": clientId (reference), coachId (reference), planId (reference), sessionDate (date), protocolCode (text), currentPhase (select)
- Section "Pain Assessment": painBefore (number 0-10), painDuring (number 0-10), painAfter (number 0-10)
- Section "Difficulty & Adjustment": hadDifficulty (checkbox), difficultyExerciseId (reference to PhysioExercise), difficultyType (select), adjustmentLevel (select), adjustmentDescription (textarea)
- Section "Follow-Up": followUpRequired (checkbox), phaseChangeNeeded (checkbox), protocolChangeNeeded (checkbox), sessionStatus (select — Green/Yellow/Red), notes (textarea)

### 3. Client Columns — Add Status Badge

**File:** `physio/clients/clients-columns.js`

Add a `sessionStatus` column with Green/Yellow/Red badge rendering. This gives the therapist an at-a-glance view of which clients need attention directly in the clients table.

### 4. Client Popup — "Session History" Tab

**File:** `physio/clients/clients-exercises.js`

Add a fourth tab "Session History" to the client popup. When activated, it:
1. Fetches `SessionReport` records where `clientId` matches
2. Displays them in a Layer8DTable with columns: date, coach, protocol, pain (before/during/after), adjustment level, status, notes
3. Color-coded rows: Green rows normal, Yellow rows highlighted, Red rows red-tinted

### 5. Dashboard Section

**File:** `physio/physio-dashboard.js` (new)

A dashboard that renders at the top of the Physio section (or as a separate "Dashboard" service) showing:
- **KPI Cards** (Layer8DWidget): Count of Green / Yellow / Red clients
- **Attention List**: Table of clients with Yellow or Red status, sorted by most recent report date
- **High Pain Reports**: Recent reports where painAfter >= 7
- **Clients Without Recent Report**: Clients with no session report in the last 7 days

This directly implements sections 6 and 8 of the PDF ("Where Data Is Reviewed" and "How You Manage the System").

### 6. Lookups Update

**File:** `physio/physio-lookups.js`

Add `_coaches` cache (same as therapists, but named for clarity in session report context). The existing `_therapists` lookup already covers this — just ensure it's loaded before reports render.

---

## Mock Data

### New Generator: `gen_physio_session_reports.go`

- Generate 5-8 session reports per client
- Distribute statuses: ~60% Green, ~25% Yellow, ~15% Red
- Pain values: Green sessions = low (1-3), Yellow = moderate (3-6), Red = high (6-9)
- Adjustment levels correlated: Green -> Level 1, Yellow -> Level 2, Red -> Level 3
- Reference existing therapist IDs for coachId, client IDs for clientId, plan IDs for planId
- Set client `sessionStatus` to match their latest report's status

### Phase Ordering

Session reports depend on clients, therapists, and plans. Add after the plans phase:
```
Phase 1: Therapists
Phase 2: Clients
Phase 3: Exercises
Phase 4: Protocols
Phase 5: Plans
Phase 6: Session Reports (NEW) — also updates client sessionStatus
Phase 7: Appointments
Phase 8: Progress Logs
```

### Store Update: `store.go`

Add `SessionReportIDs []string` to `MockDataStore`.

---

## Security Update

**File:** `go/physio/common/physio_security.go`

Add to `ScopeView` switch:
```go
case *physio.SessionReport:
    return p.filterSessionReports(elems, info)
```

`filterSessionReports` follows the same pattern as `filterProgressLogs` — filter by `clientId` using `allowedClientIds`.

Add to `CanDoAction`: Allow therapist role to POST/PUT SessionReport (already covered by existing logic where therapists can do everything).

---

## Files Summary

### New Files
| File | Purpose |
|------|---------|
| `go/physio/sessreport/PhySessRptService.go` | Service definition |
| `go/physio/sessreport/PhySessRptServiceCallback.go` | Auto-ID + client status sync |
| `go/physio/ui/web/physio/reports/reports-enums.js` | Enum definitions |
| `go/physio/ui/web/physio/reports/reports-columns.js` | Table columns |
| `go/physio/ui/web/physio/reports/reports-forms.js` | CRUD form |
| `go/physio/ui/web/physio/physio-dashboard.js` | Dashboard KPI + attention list |
| `go/tests/mocks/gen_physio_session_reports.go` | Mock data generator |

### Modified Files
| File | Change |
|------|--------|
| `proto/physio.proto` | Add enums, SessionReport, client field |
| `go/types/physio/physio.pb.go` | Regenerated |
| `go/physio/common/physio_security.go` | Add SessionReport to ScopeView |
| `go/physio/ui/web/app.html` | Add script tags for new JS files |
| `go/physio/ui/web/physio/physio-config.js` | Add 'reports' service + dashboard |
| `go/physio/ui/web/physio/clients/clients-columns.js` | Add sessionStatus column |
| `go/physio/ui/web/physio/clients/clients-exercises.js` | Add "Session History" tab |
| `go/physio/ui/web/physio/physio-lookups.js` | Ensure therapist lookup available for reports |
| `go/physio/ui/web/physio/physio-init.js` | Wire dashboard initialization |
| `go/tests/mocks/store.go` | Add SessionReportIDs |
| `go/tests/mocks/physio_phases.go` | Add session reports phase |
| `go/physio/ui/main.go` | Register SessionReport type |

---

## Traceability Matrix

| # | PDF Section | Requirement | Phase |
|---|-------------|-------------|-------|
| 1 | 1. Core Principle | Centralized system, not Google Sheets | All — the entire plan |
| 2 | 2. Client Tracking | Track Posture, Joint, Phase, Protocol, session history | Phase 2 (client popup) + Phase 1 (SessionReport) |
| 3 | 3. Adjustment Levels | Level 1/2/3 in session reports | Phase 1 (AdjustmentLevel enum + form field) |
| 4 | 4. Coach Updates | Structured post-session form | Phase 2 (SessionReport form) |
| 5 | 4. Coach Updates | Fields: client, coach, date, protocol, phase, pain x 3, difficulty, adjustment, follow-up, status, notes | Phase 1 (proto) + Phase 2 (form) |
| 6 | 5. Status System | Green/Yellow/Red per client | Phase 1 (SessionStatus enum) + Phase 2 (client column) |
| 7 | 6. Data Review | Filter by Yellow/Red, high pain, repeated issues | Phase 4 (Dashboard) |
| 8 | 7. Daily Workflow | Before: review client; During: follow plan; After: fill report | Phase 2 (form) + Phase 2 (client popup session history tab) |
| 9 | 8. Management by Exception | Focus on Yellow/Red, not review every client | Phase 4 (Dashboard attention list) |
| 10 | 9. Information Layers | Program layer + Tracking layer | Existing (TreatmentPlan) + New (SessionReport) |
| 11 | 10. What Was Missing | Form, connected reports, management dashboard | Phase 2 + Phase 4 |

---

## Implementation Phases

### Phase 1 — Proto & Backend (SessionReport service)
1. Add 3 new enums to `physio.proto`
2. Add `SessionReport` + `SessionReportList` messages
3. Add `session_status` field (15) to `PhysioClient`
4. Run `make-bindings.sh`
5. Create `go/physio/sessreport/PhySessRptService.go`
6. Create `go/physio/sessreport/PhySessRptServiceCallback.go` (auto-ID + client status sync on POST)
7. Update `physio_security.go` — add SessionReport to ScopeView
8. Register SessionReport type in `go/physio/ui/main.go`
9. Verify: `go build ./...`

### Phase 2 — UI: Session Reports CRUD + Client Enhancements
1. Create `reports-enums.js`, `reports-columns.js`, `reports-forms.js`
2. Update `physio-config.js` — add 'reports' service
3. Update `clients-columns.js` — add sessionStatus column with Green/Yellow/Red badge
4. Update `clients-exercises.js` — add "Session History" tab in client popup
5. Update `app.html` — add script tags for new files
6. Verify: navigate to Session Reports tab, create a report, verify client status updates

### Phase 3 — Mock Data
1. Create `gen_physio_session_reports.go`
2. Update `store.go` — add SessionReportIDs
3. Update `physio_phases.go` — add session reports phase after plans
4. Update client generator to set initial sessionStatus
5. Verify: `go build ./tests/mocks/` passes; run mocks, verify data appears in UI

### Phase 4 — Dashboard
1. Create `physio-dashboard.js` — KPI cards + attention list + high pain reports
2. Add CSS for dashboard (if needed, in existing or new file)
3. Wire into `physio-init.js`
4. Update `app.html` — add script tag
5. Verify: dashboard shows correct counts matching mock data distribution

### Phase 5 — End-to-End Verification
1. Build and run locally via `run-local.sh`
2. Upload mock data
3. Navigate to Session Reports — verify table shows all reports with correct columns
4. Click a report row — verify detail popup shows all fields
5. Create a new session report — verify client's sessionStatus updates
6. Navigate to Clients — verify sessionStatus column shows Green/Yellow/Red badges
7. Click a client — verify "Session History" tab shows that client's reports
8. Verify Dashboard — Green/Yellow/Red counts match data
9. Verify Dashboard — Attention list shows only Yellow/Red clients
10. Verify Dashboard — High pain reports filter works
