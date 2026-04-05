# Client Home Exercise Feedback

## Objective
Allow clients to report back to their therapist on home exercises: what they did, how it felt, pain levels, compliance, and general notes. The therapist sees all feedback in the client popup. The system is designed to be extensible for additional feedback types in the future.

---

## Design

### What the Client Reports (per home session)
- **Date** — when they did the exercises
- **Exercises completed** — which exercises from their plan they performed (multi-select)
- **Compliance level** — did they do all prescribed sets/reps, partial, or skipped
- **Pain before / during / after** — 0-10 scale (same as session reports)
- **Difficulty** — easy / moderate / hard / could not complete
- **Mood / energy** — how they felt (good / neutral / low)
- **Notes** — free text for anything else (questions, concerns, observations)
- **Status** — auto-derived or manual: Green (all good) / Yellow (some issues) / Red (significant problem)

### Extensibility
The proto includes a `string additional_data` field (JSON) for future structured data that doesn't warrant a schema change yet (e.g., sleep quality, medication taken, home environment notes). This keeps the proto stable while allowing experimentation.

### Who Submits
- **Client** submits their own feedback (client role needs POST on this entity)
- **Therapist** views feedback for their clients (filtered by therapistId/clientId)
- **Admin** sees all feedback

### Where It Lives in the UI
1. **Client popup** — new "Home Feedback" tab showing all feedback from that client, with "Add Feedback" button (for therapist to add on behalf of client)
2. **Main table** — "Home Feedback" service in the Management subnav (for overview across all clients)
3. **Future: Client portal** — when client logs in with client role, they see their own feedback form directly

---

## Proto Design

### New Enums

```protobuf
enum ComplianceLevel {
  COMPLIANCE_LEVEL_UNSPECIFIED = 0;
  COMPLIANCE_LEVEL_FULL        = 1;  // Did all prescribed exercises
  COMPLIANCE_LEVEL_PARTIAL     = 2;  // Did some exercises or reduced sets/reps
  COMPLIANCE_LEVEL_SKIPPED     = 3;  // Did not exercise
}

enum DifficultyLevel {
  DIFFICULTY_LEVEL_UNSPECIFIED  = 0;
  DIFFICULTY_LEVEL_EASY         = 1;
  DIFFICULTY_LEVEL_MODERATE     = 2;
  DIFFICULTY_LEVEL_HARD         = 3;
  DIFFICULTY_LEVEL_COULD_NOT    = 4;  // Could not complete
}

enum MoodLevel {
  MOOD_LEVEL_UNSPECIFIED = 0;
  MOOD_LEVEL_GOOD        = 1;
  MOOD_LEVEL_NEUTRAL     = 2;
  MOOD_LEVEL_LOW         = 3;
}
```

### New Prime Object: HomeFeedback

```protobuf
message HomeFeedback {
  string              feedback_id          = 1;
  string              client_id            = 2;
  string              therapist_id         = 3;
  int64               feedback_date        = 4;
  string              plan_id              = 5;
  string              exercises_done       = 6;   // comma-separated exerciseIds
  ComplianceLevel     compliance           = 7;
  int32               pain_before          = 8;   // 0-10
  int32               pain_during          = 9;   // 0-10
  int32               pain_after           = 10;  // 0-10
  DifficultyLevel     difficulty           = 11;
  MoodLevel           mood                 = 12;
  SessionStatus       status               = 13;  // reuse Green/Yellow/Red
  string              notes                = 14;
  string              additional_data      = 15;  // JSON for future extensibility
  l8common.AuditInfo  audit_info           = 30;
}

message HomeFeedbackList {
  repeated HomeFeedback list     = 1;
  l8api.L8MetaData      metadata = 2;
}
```

### Prime Object Test
- **Independence**: A feedback entry is a standalone record of what happened at home
- **Own lifecycle**: Created by client, read by therapist, never edited (historical)
- **Direct query need**: "Show all feedback for client X", "Show Red/Yellow feedback across all clients"
- **No parent dependency**: Meaningful on its own

---

## Service Design

| Property | Value |
|----------|-------|
| ServiceName | `HomeFdbk` (8 chars) |
| ServiceArea | `byte(50)` |
| PrimaryKey | `FeedbackId` |
| Package | `go/physio/homefeedback/` |

### Service Callback
- **POST**: Auto-generate `FeedbackId`, validate `ClientId` required
- **Validation**: `ClientId` required, `FeedbackDate` required

---

## UI Design

### Enums — `physio/homefeedback/homefeedback-enums.js`

```javascript
COMPLIANCE_LEVEL  = factory.create([...])   // Full, Partial, Skipped
DIFFICULTY_LEVEL  = factory.create([...])   // Easy, Moderate, Hard, Could Not
MOOD_LEVEL        = factory.simple([...])   // Good, Neutral, Low
// Reuse SESSION_STATUS for Green/Yellow/Red
```

### Columns — `physio/homefeedback/homefeedback-columns.js`

Key columns: Date, Client, Compliance, Pain Before/After, Difficulty, Mood, Status, Notes.

### Forms — `physio/homefeedback/homefeedback-forms.js`

Two sections:
1. **Session Info**: client (reference, readOnly when pre-filled), date, plan (reference)
2. **Feedback**: exercises done (multi-select from plan, same pattern as session report difficulty exercises), compliance (select), pain before/during/after (number 0-10), difficulty (select), mood (select), status (select Green/Yellow/Red), notes (textarea)

**Auto-population** (when opened from client popup):
- `clientId` from client record
- `therapistId` from active plan or `sessionStorage.getItem('currentUser')`
- `planId` from active treatment plan
- `feedbackDate` defaults to today
- Exercises multi-select filtered to client's active plan exercises (same pattern as session report)

### Config — add to `physio-config.js`

```javascript
svc('feedback', 'Home Feedback', 'clipboard', '/50/HomeFdbk', 'HomeFeedback')
```

### Verify proto JSON field names before writing JS

```bash
grep -A 25 "type HomeFeedback struct" go/types/physio/physio.pb.go | grep 'json='
```

### Verify/add reference registry entries

`HomeFeedback` uses `lookupModel` references to `PhysioClient` and `TreatmentPlan` — both already registered.

---

## Client Popup Integration

Add a **"Home Feedback"** tab to the client popup:
- Filtered table: `baseWhereClause: clientId={id}`
- "Add Feedback" button with auto-populated form (same pattern as Session Reports tab)
- Exercises multi-select from active plan exercises (reuse `_buildExerciseCheckboxes` pattern from `clients-session-reports.js`)

**Deferred init**: init on first tab activation (same pattern as Statistics tab) to avoid hidden container issues.

---

## Traceability Matrix

| # | Item | Phase |
|---|------|-------|
| 1 | Add enums to `proto/physio.proto` | Phase 1 |
| 2 | Add `HomeFeedback` + `HomeFeedbackList` messages | Phase 1 |
| 3 | Run `make-bindings.sh` | Phase 1 |
| 4 | Verify proto JSON field names | Phase 2 (precondition) |
| 5 | Create `go/physio/homefeedback/HomeFdbkService.go` | Phase 2 |
| 6 | Create `go/physio/homefeedback/HomeFdbkServiceCallback.go` | Phase 2 |
| 7 | Add `homefeedback.Activate()` to `activate_all.go` | Phase 2 |
| 8 | Add type registration to `go/physio/ui/main.go` | Phase 2 |
| 9 | Create `homefeedback-enums.js` | Phase 3 |
| 10 | Create `homefeedback-columns.js` | Phase 3 |
| 11 | Create `homefeedback-forms.js` | Phase 3 |
| 12 | Add `feedback` service to `physio-config.js` | Phase 3 |
| 13 | Add subnav + table container to `physio.html` | Phase 3 |
| 14 | Add script tags to `app.html` | Phase 3 |
| 15 | Create `clients-home-feedback.js` — tab in client popup | Phase 4 |
| 16 | Add "Home Feedback" tab to `clients-exercises.js` | Phase 4 |
| 17 | Add script tag for `clients-home-feedback.js` to `app.html` | Phase 4 |
| 18 | `go build ./...` and `go vet ./...` pass | Phase 5 |
| 19 | End-to-end verification | Phase 5 |

---

## Phase 1 — Proto

1. Add `ComplianceLevel`, `DifficultyLevel`, `MoodLevel` enums
2. Add `HomeFeedback` and `HomeFeedbackList` messages
3. Run `cd proto && ./make-bindings.sh`
4. Verify: `go build ./...`

## Phase 2 — Backend Service

1. Verify proto JSON field names from generated `.pb.go`
2. Create `go/physio/homefeedback/HomeFdbkService.go` (ServiceName: `"HomeFdbk"`, ServiceArea: `byte(50)`)
3. Create `go/physio/homefeedback/HomeFdbkServiceCallback.go` (validate `ClientId` required)
4. Add to `activate_all.go` and `ui/main.go`
5. Verify: `go build ./...`

## Phase 3 — UI (Desktop)

1. Create enums, columns, forms JS files under `physio/homefeedback/`
2. Add `feedback` service to `physio-config.js`
3. Add subnav item + table container to `physio.html`
4. Add script tags to `app.html` (before `physio-init.js`)
5. Verify: JS syntax check

## Phase 4 — Client Popup Integration

1. Create `clients-home-feedback.js` with:
   - `PhysioClientHomeFeedback.init(container, client, parentCtx)`
   - Filtered table + "Add Feedback" button
   - Auto-populated form with exercises multi-select from active plan
2. Add "Home Feedback" tab to `clients-exercises.js` (deferred init on tab click)
3. Add script tag to `app.html`

## Phase 5 — Verification

- [ ] `go build ./...` passes
- [ ] `go vet ./...` passes
- [ ] All JS files pass syntax check and are under 500 lines
- [ ] Start system with `run-local.sh`
- [ ] Navigate to Physio > Home Feedback — table loads
- [ ] Click "Add" — form opens with all fields
- [ ] Open client popup → Home Feedback tab:
  - [ ] Table shows filtered feedback for that client
  - [ ] "Add Feedback" pre-fills clientId, therapistId, planId, date
  - [ ] Exercises multi-select shows only exercises from active plan
  - [ ] Save feedback — record appears in table
- [ ] `clients-exercises.js` still under 500 lines

---

## Duplication Audit

**Existing patterns reused (not reimplemented):**
- Tab initialization: same deferred-init-on-tab-click pattern as Statistics and Session Reports tabs
- Auto-populated form: same `generateFormHtml(formDef, preData)` pattern as Session Reports
- Exercises multi-select: same `_buildExerciseCheckboxes` + `_replaceDifficultyField` pattern from `clients-session-reports.js`
- Table with `baseWhereClause`: standard Layer8DTable pattern

**Shared code extraction opportunity:**
The exercises multi-select checkbox builder (`_buildExerciseCheckboxes`) is currently private in `clients-session-reports.js`. Phase 4 should extract it to `clients-exercises-info.js` (already the shared helper file) so both Session Reports and Home Feedback use the same function.

**No duplicate behavioral code.** All patterns are configuration-only differences (different field names, labels, endpoints).

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `proto/physio.proto` | **Modify** — add 3 enums + HomeFeedback + HomeFeedbackList |
| `go/types/physio/physio.pb.go` | **Regenerate** |
| `go/physio/homefeedback/HomeFdbkService.go` | **Create** |
| `go/physio/homefeedback/HomeFdbkServiceCallback.go` | **Create** |
| `go/physio/services/activate_all.go` | **Modify** — add homefeedback.Activate() |
| `go/physio/ui/main.go` | **Modify** — add RegisterType |
| `go/physio/ui/web/physio/homefeedback/homefeedback-enums.js` | **Create** |
| `go/physio/ui/web/physio/homefeedback/homefeedback-columns.js` | **Create** |
| `go/physio/ui/web/physio/homefeedback/homefeedback-forms.js` | **Create** |
| `go/physio/ui/web/physio/physio-config.js` | **Modify** — add feedback service |
| `go/physio/ui/web/sections/physio.html` | **Modify** — add subnav + container |
| `go/physio/ui/web/app.html` | **Modify** — add script tags |
| `go/physio/ui/web/physio/clients/clients-home-feedback.js` | **Create** |
| `go/physio/ui/web/physio/clients/clients-exercises.js` | **Modify** — add tab |
| `go/physio/ui/web/physio/clients/clients-exercises-info.js` | **Modify** — extract shared checkbox builder |
| `go/physio/ui/web/physio/clients/clients-session-reports.js` | **Modify** — use shared checkbox builder |

## What This Does NOT Change
- No changes to security/roles (client POST permission is a separate concern)
- No mock data
- No mobile UI changes (future)

## Known Risks

| Risk | Mitigation |
|------|-----------|
| `clients-exercises.js` at 495 lines — adding another tab | Tab is one line + one div; deferred init keeps logic in separate file |
| Exercises multi-select duplicated between Session Reports and Home Feedback | Phase 4 extracts shared builder to `clients-exercises-info.js` |
| Client role needs POST permission on HomeFeedback | Separate security concern — add to phy.json when client portal is built |
| `additional_data` JSON field not validated | Intentional — free-form for future experimentation |
