# Mobile Parity Plan — L8Physio

## Summary

The mobile UI is missing 3 services, several enum/column definitions, and the client popup has only 2 tabs vs 6 on desktop. This plan adds the missing services and enriches the client exercise popup to achieve feature parity.

---

## Gap Analysis

### Missing Services (not in mobile nav config)

| Service | Desktop Key | Endpoint | Model | Primary Key |
|---------|------------|----------|-------|-------------|
| Therapists | `therapists` | `/50/PhyTherapt` | `PhysioTherapist` | `therapistId` |
| Session Reports | `reports` | `/50/SessRpt` | `SessionReport` | `reportId` |
| Home Feedback | `feedback` | `/50/HomeFdbk` | `HomeFeedback` | `feedbackId` |

### Missing Mobile Module Data Files

| File Needed | Model | What It Contains |
|------------|-------|-----------------|
| `therapists-columns.js` | PhysioTherapist | ID, name, email, phone, specialization, license, isActive |
| `sessionreport-enums.js` | SessionReport | SESSION_STATUS, ADJUSTMENT_LEVEL, DIFFICULTY_TYPE, SESSION_PHASE |
| `sessionreport-columns.js` | SessionReport | reportId, date, client, status, pain levels, adjustment, follow-up, notes |
| `homefeedback-enums.js` | HomeFeedback | COMPLIANCE, DIFFICULTY, MOOD |
| `homefeedback-columns.js` | HomeFeedback | feedbackId, date, client, compliance, pain, difficulty, mood, status, notes |

### Forms — Reuse, Do Not Redefine

Desktop has dedicated form files (`sessionreport-forms.js`, `homefeedback-forms.js`) that define `PhysioManagement.forms.SessionReport` and `PhysioManagement.forms.HomeFeedback` directly. However, `PhysioSharedForms.build(enums)` does NOT generate SessionReport or HomeFeedback forms — it only generates: PhysioClient, PhysioExercise, TreatmentPlan, Appointment, ProgressLog, PhysioProtocol, PhysioTherapist.

Per `reuse-existing-module-forms.md`, we must NOT redefine these forms. Instead, we include the existing desktop form files (`sessionreport-forms.js`, `homefeedback-forms.js`) in mobile `app.html` and use them directly. These desktop form files write to `PhysioManagement.forms`, which is the desktop namespace. The mobile `physio-forms-mobile.js` must copy them into `MobilePhysioManagement.forms` and apply mobile-specific field removal (strip `therapistId`).

### Protobuf Field Name Verification

All field names verified against `go/types/physio/physio.pb.go` protobuf JSON tags (`json=<name>,proto3`):

**SessionReport:**
`reportId`, `clientId`, `therapistId`, `sessionDate`, `protocolId`, `currentPhase`, `painBefore`, `painDuring`, `painAfter`, `hadDifficulty`, `difficultyExerciseId`, `difficultyType`, `adjustmentMade`, `adjustmentDetails`, `adjustmentLevel`, `followupRequired`, `phaseChangeNeeded`, `status`, `notes`, `auditInfo`

**HomeFeedback:**
`feedbackId`, `clientId`, `therapistId`, `feedbackDate`, `planId`, `exercisesDone`, `compliance`, `painBefore`, `painDuring`, `painAfter`, `difficulty`, `mood`, `status`, `notes`, `additionalData`, `auditInfo`

**PhysioTherapist:**
`therapistId`, `firstName`, `lastName`, `email`, `phone`, `specialization`, `licenseNumber`, `isActive`, `auditInfo`

### Client Exercise Popup Tabs (Desktop: 6 tabs, Mobile: 2 tabs)

| Tab | Desktop | Mobile | Gap |
|-----|---------|--------|-----|
| Workout Plan / My Exercises | Yes | Yes (as "My Exercises") | Present |
| Exercise Info & Videos | Yes | No | **MISSING** - desktop shows detailed exercise info cards |
| Session Reports | Yes | No | **MISSING** - table of session reports + add button |
| Statistics | Yes | No | **MISSING** - KPI cards + pain trend chart + status pie chart |
| Home Feedback | Yes | No | **MISSING** - table of home feedback + add button |
| Details | Yes | Yes | Present |

### Data Flow Trace (Platform Conversion Protocol)

**Desktop Session Reports tab** (`clients-session-reports.js`):
1. Data source: `Layer8DTable` with `serverSide: true`, `baseWhereClause: 'clientId=<id>'`, endpoint `/50/SessRpt`
2. Table handles L8Query construction, pagination, and rendering automatically
3. "Add" button opens `Layer8DPopup` with `Layer8DForms.generateFormHtml()`, pre-populates clientId + date
4. Save via `Layer8DForms.saveRecord()` (POST)

**Mobile equivalent:**
1. Data source: `Layer8MEditTable` with same endpoint, same baseWhereClause — table handles L8Query automatically (same as desktop, no extra server calls)
2. "Add" button opens `Layer8MPopup` with `Layer8MForms.renderForm()`, same pre-population
3. Save via `Layer8MAuth.post()` (same single POST, no extra calls)
4. No unnecessary server calls introduced vs desktop

**Desktop Home Feedback tab** (`clients-home-feedback.js`):
- Identical pattern to Session Reports. Same data flow applies.

**Desktop Statistics tab** (`clients-session-stats.js`):
1. Data source: single L8Query fetch `select * from SessionReport where clientId=<id> limit 200`
2. Client-side aggregation (no server aggregation)
3. Renders KPI cards via `Layer8DWidget.render()` and charts via `Layer8DChart`

**Mobile equivalent:**
1. Same single L8Query fetch via `Layer8MAuth.get()` — no extra server calls
2. Same client-side aggregation
3. KPI cards via simple HTML (mobile doesn't use Layer8DWidget)
4. Chart via `Layer8MChart` — deferred until tab is visible (container needs non-zero dimensions)

### Workout Builder

Desktop has a full Workout Builder (3 files, ~43KB) accessible from the client popup. This is a complex desktop-oriented feature with drag-and-drop, circuit management, and exercise assignment. **Deferred** — the workout builder relies heavily on desktop-specific UI patterns (Layer8DTable with inline reordering, circuit tables, stacked popups) that don't have direct mobile equivalents. It should be redesigned for mobile touch patterns in a separate plan.

### Reference Registry

Mobile reference registry (`reference-registry-physio-m.js`) already registers: PhysioClient, PhysioTherapist, PhysioExercise, TreatmentPlan, Appointment, ProgressLog, PhysioProtocol. SessionReport and HomeFeedback are NOT used as `lookupModel` in any form definition, so no new registry entries are needed.

---

## Traceability Matrix

| # | Gap | Phase |
|---|-----|-------|
| 1 | Missing therapists-columns.js for mobile | Phase 1 |
| 2 | Missing sessionreport-enums.js for mobile | Phase 1 |
| 3 | Missing sessionreport-columns.js for mobile | Phase 1 |
| 4 | Missing homefeedback-enums.js for mobile | Phase 1 |
| 5 | Missing homefeedback-columns.js for mobile | Phase 1 |
| 6 | Therapists service missing from nav config | Phase 2 |
| 7 | Session Reports service missing from nav config | Phase 2 |
| 8 | Home Feedback service missing from nav config | Phase 2 |
| 9 | SessionReport + HomeFeedback forms missing from mobile | Phase 2 |
| 10 | physio-forms-mobile.js needs to copy + strip desktop forms for new models | Phase 2 |
| 11 | app.html missing script tags for new files + desktop form files | Phase 2 |
| 12 | physio-index.js — no change needed (writes to same MobilePhysioManagement namespace) | N/A |
| 13 | physio-nav-data-patch.js — no change needed (dynamically resolves any model from MobilePhysio registry) | N/A |
| 14 | reference-registry-physio-m.js — no change needed (SessionReport/HomeFeedback not used as lookupModel) | N/A |
| 15 | Shared behavioral helper for Session Reports + Home Feedback tabs (duplication prevention) | Phase 3 |
| 16 | Client popup missing Session Reports tab | Phase 3 |
| 17 | Client popup missing Home Feedback tab | Phase 3 |
| 18 | Client popup missing Statistics tab | Phase 3 |
| 19 | Client popup missing Exercise Info tab | Phase 3 |
| 20 | Dashboard KPI card counts should include Session Reports & Feedback | Phase 4 |
| 21 | Workout Builder for mobile | Deferred |

---

## Phase 1: Create Missing Mobile Module Data Files

Create 5 new files under `go/physio/ui/web/m/js/physio/`.

All enum files MUST use `Layer8MRenderers` (not `Layer8DRenderers`) for `createStatusRenderer` and `renderEnum`, matching the existing pattern in `clients-enums.js`.

All column files MUST include `primary: true` on the main display field and `secondary: true` on the secondary display field for mobile card rendering.

### 1.1 `therapists-columns.js`
- Namespace: `MobilePhysioManagement`
- Columns (all field names verified against pb.go):
  - `therapistId` — col.id, hidden on card
  - `firstName` — col.col, **primary: true**
  - `lastName` — col.col
  - `email` — col.col
  - `phone` — col.col
  - `specialization` — col.col, **secondary: true**
  - `licenseNumber` — col.col
  - `isActive` — col.boolean
- PrimaryKey: `therapistId`

### 1.2 `sessionreport-enums.js`
- Namespace: `MobilePhysioManagement`
- Use `Layer8MRenderers.createStatusRenderer` and `Layer8MRenderers.renderEnum`
- Enums (using `Layer8EnumFactory`):
  - SESSION_STATUS: `factory.create([['Unspecified', null, ''], ['Green', 'green', 'status-active'], ['Yellow', 'yellow', 'status-warning'], ['Red', 'red', 'status-error']])`
  - ADJUSTMENT_LEVEL: `factory.create([['Unspecified', null, ''], ['No Change', 'none', ''], ['Local Adjustment', 'local', 'status-warning'], ['Major Change', 'major', 'status-error']])`
  - DIFFICULTY_TYPE: `factory.simple(['Unspecified', 'Pain', 'ROM Limitation', 'Load Too Heavy', 'Coordination', 'Fatigue', 'Other'])`
  - SESSION_PHASE: `factory.simple(['Unspecified', 'Phase 1', 'Phase 2', 'Phase 3'])`
- Export to `MobilePhysioManagement.enums`: SESSION_STATUS, SESSION_STATUS_VALUES, SESSION_STATUS_CLASSES, ADJUSTMENT_LEVEL, ADJUSTMENT_LEVEL_VALUES, ADJUSTMENT_LEVEL_CLASSES, DIFFICULTY_TYPE, SESSION_PHASE
- Renderers on `MobilePhysioManagement.render`: sessionStatus, adjustmentLevel, difficultyType, sessionPhase

### 1.3 `sessionreport-columns.js`
- Namespace: `MobilePhysioManagement`
- Columns (all field names verified against pb.go):
  - `reportId` — col.id
  - `sessionDate` — col.date, **primary: true**
  - `clientId` — col.col
  - `status` — col.status with SESSION_STATUS_VALUES + render.sessionStatus, **secondary: true**
  - `painBefore` — col.number
  - `painDuring` — col.number
  - `painAfter` — col.number
  - `adjustmentLevel` — col.enum with ADJUSTMENT_LEVEL_VALUES + render.adjustmentLevel
  - `followupRequired` — col.boolean
  - `notes` — col.col
- PrimaryKey: `reportId`

### 1.4 `homefeedback-enums.js`
- Namespace: `MobilePhysioManagement`
- Use `Layer8MRenderers.createStatusRenderer` and `Layer8MRenderers.renderEnum`
- Enums (using `Layer8EnumFactory`):
  - COMPLIANCE: `factory.create([['Unspecified', null, ''], ['Full', 'full', 'status-active'], ['Partial', 'partial', 'status-warning'], ['Skipped', 'skipped', 'status-error']])`
  - DIFFICULTY: `factory.create([['Unspecified', null, ''], ['Easy', 'easy', 'status-active'], ['Moderate', 'moderate', 'status-warning'], ['Hard', 'hard', 'status-error'], ['Could Not', 'couldnot', 'status-error']])`
  - MOOD: `factory.simple(['Unspecified', 'Good', 'Neutral', 'Low'])`
- Export to `MobilePhysioManagement.enums`: COMPLIANCE, COMPLIANCE_VALUES, COMPLIANCE_CLASSES, DIFFICULTY, DIFFICULTY_VALUES, DIFFICULTY_CLASSES, MOOD
- Renderers on `MobilePhysioManagement.render`: compliance, difficulty, mood

### 1.5 `homefeedback-columns.js`
- Namespace: `MobilePhysioManagement`
- Columns (all field names verified against pb.go):
  - `feedbackId` — col.id
  - `feedbackDate` — col.date, **primary: true**
  - `clientId` — col.col
  - `compliance` — col.status with COMPLIANCE_VALUES + render.compliance, **secondary: true**
  - `painBefore` — col.number
  - `painAfter` — col.number
  - `difficulty` — col.status with DIFFICULTY_VALUES + render.difficulty
  - `mood` — col.enum with null + render.mood
  - `status` — col.status with SESSION_STATUS_VALUES + render.sessionStatus
  - `notes` — col.col
- PrimaryKey: `feedbackId`

---

## Phase 2: Wire New Services into Mobile Navigation

### 2.1 Update `physio-nav-config.js`
Add 3 new service entries to the `management` services array (insert `therapists` at the top, `reports` and `feedback` at the bottom, matching desktop order):
```js
{ key: 'therapists', label: 'Therapists', icon: 'person',
  endpoint: '/50/PhyTherapt', model: 'PhysioTherapist', idField: 'therapistId' },
```
```js
{ key: 'reports', label: 'Session Reports', icon: 'clipboard',
  endpoint: '/50/SessRpt', model: 'SessionReport', idField: 'reportId' },
{ key: 'feedback', label: 'Home Feedback', icon: 'clipboard',
  endpoint: '/50/HomeFdbk', model: 'HomeFeedback', idField: 'feedbackId' }
```

### 2.2 Include Desktop Form Files + Update `physio-forms-mobile.js`

`PhysioSharedForms.build(enums)` generates forms for PhysioClient, PhysioExercise, TreatmentPlan, Appointment, ProgressLog, PhysioProtocol, and PhysioTherapist — but NOT SessionReport or HomeFeedback.

Per `reuse-existing-module-forms.md`, include the existing desktop form definition files in mobile `app.html`:
```html
<script src="../physio/sessionreport/sessionreport-forms.js"></script>
<script src="../physio/homefeedback/homefeedback-forms.js"></script>
```

These files write to `PhysioManagement.forms.SessionReport` and `PhysioManagement.forms.HomeFeedback` (the desktop namespace). They depend on `PhysioManagement.enums.SESSION_STATUS`, `ADJUSTMENT_LEVEL`, `DIFFICULTY_TYPE`, `SESSION_PHASE`, `COMPLIANCE`, `DIFFICULTY`, `MOOD` — which are set by the desktop enum files.

**Problem:** Mobile loads `sessionreport-enums.js` and `homefeedback-enums.js` which write to `MobilePhysioManagement.enums`, not `PhysioManagement.enums`. The desktop form files read from `PhysioManagement.enums`.

**Solution:** Before loading the desktop form files, ensure `PhysioManagement.enums` contains the required enum values. The mobile `sessionreport-enums.js` and `homefeedback-enums.js` should ALSO write to `PhysioManagement.enums` (in addition to `MobilePhysioManagement.enums`), since the desktop form files depend on that namespace. This matches how desktop does it — the desktop enum files write to `PhysioManagement.enums`.

Then in `physio-forms-mobile.js`, after the `PhysioSharedForms.build(enums)` section, copy the desktop forms into the mobile namespace with field stripping:
```js
// Copy desktop-only forms into mobile namespace + strip therapistId
if (PhysioManagement.forms.SessionReport) {
    MobilePhysioManagement.forms.SessionReport = PhysioManagement.forms.SessionReport;
    _removeFields(MobilePhysioManagement.forms.SessionReport, ['therapistId']);
}
if (PhysioManagement.forms.HomeFeedback) {
    MobilePhysioManagement.forms.HomeFeedback = PhysioManagement.forms.HomeFeedback;
    _removeFields(MobilePhysioManagement.forms.HomeFeedback, ['therapistId']);
}
```

### 2.3 Update `m/app.html` Script Tags

Script loading order matters. Insert new scripts in dependency order:

After `protocols-columns.js` and before `../physio/physio-forms-shared.js`:
```html
<!-- Therapist columns -->
<script src="js/physio/therapists-columns.js"></script>
<!-- Session Report enums + columns (enums must load before forms) -->
<script src="js/physio/sessionreport-enums.js"></script>
<script src="js/physio/sessionreport-columns.js"></script>
<!-- Home Feedback enums + columns (enums must load before forms) -->
<script src="js/physio/homefeedback-enums.js"></script>
<script src="js/physio/homefeedback-columns.js"></script>
```

After `../physio/physio-forms-shared.js` and before `js/physio/physio-forms-mobile.js`:
```html
<!-- Desktop form files (reuse, not redefine) — depend on PhysioManagement.enums -->
<script src="../physio/sessionreport/sessionreport-forms.js"></script>
<script src="../physio/homefeedback/homefeedback-forms.js"></script>
```

After `js/physio/physio-index.js`, add the new client popup tab files (Phase 3):
```html
<script src="js/physio/clients-exercises-subtab.js"></script>
<script src="js/physio/clients-exercises-stats.js"></script>
```

### 2.4 Verified: No Changes Needed

- **`physio-index.js`**: Registers `MobilePhysioManagement` — all new files write to the same namespace. No change needed.
- **`physio-nav-data-patch.js`**: Dynamically resolves any model from `MobilePhysio` registry via `reg.getColumns(serviceConfig.model)`. Verified it handles any new model without code changes.
- **`reference-registry-physio-m.js`**: Already registers PhysioClient, PhysioTherapist, PhysioExercise, TreatmentPlan, Appointment, ProgressLog, PhysioProtocol. SessionReport and HomeFeedback are not used as `lookupModel` in any form, so no new entries needed.

---

## Phase 3: Enrich Client Exercise Popup

### 3.0 Extract Shared Sub-Tab Helper (Duplication Prevention)

Per `plan-duplication-audit.md`, the Session Reports tab and Home Feedback tab are behaviorally identical — they both:
1. Render an "Add" button + table container
2. Initialize a `Layer8MEditTable` with a `baseWhereClause` filtering by `clientId`
3. Open a `Layer8MPopup` with `Layer8MForms.renderForm()` on "Add" click
4. Pre-populate clientId + current date
5. Save via `Layer8MAuth.post()`
6. Refresh the table on success

This is ~80-100 lines of behavioral code that would be duplicated. Extract a shared helper:

**File:** `m/js/physio/clients-exercises-subtab.js` (~100 lines)

```js
window.MobilePhysioClientSubTab = {
    /**
     * Initialize a sub-tab with an add button + edit table for a child model.
     * @param {Object} config
     * @param {Element} config.container - Tab pane element
     * @param {string}  config.clientId  - Client ID for baseWhereClause
     * @param {string}  config.endpoint  - Service endpoint (e.g. '/50/SessRpt')
     * @param {string}  config.modelName - Protobuf type name (e.g. 'SessionReport')
     * @param {string}  config.primaryKey - Primary key field (e.g. 'reportId')
     * @param {Array}   config.columns   - Column definitions
     * @param {string}  config.formKey   - Key in MobilePhysioManagement.forms
     * @param {string}  config.addLabel  - Button text (e.g. '+ Add Report')
     * @param {string}  config.popupTitle - Popup title (e.g. 'Add Session Report')
     * @param {Object}  config.preData   - Additional pre-populated form data
     */
    init: function(config) { /* ... */ }
};
```

Both Session Reports and Home Feedback tabs call this helper with different config objects (~10 lines each). Statistics tab has unique logic (aggregation + charts) and does not use this helper.

### 3.1 Update `clients-exercises.js` — Add Tabs + Panes

Add 4 new tab buttons between "My Exercises" and "Details":
```
Session Reports | Statistics | Home Feedback | Exercise Info
```

Add corresponding pane containers. Tab switching uses deferred initialization — each tab's content loads only on first activation (matching desktop pattern, required for chart rendering per `platform-conversion-data-flow.md` rendering lifecycle rules).

### 3.2 Implement Session Reports Tab

Uses `MobilePhysioClientSubTab.init()` with config:
- endpoint: `/50/SessRpt`
- modelName: `SessionReport`
- primaryKey: `reportId`
- columns: from `MobilePhysioManagement.columns.SessionReport`
- formKey: `SessionReport`
- preData: `{ clientId, sessionDate: Math.floor(Date.now() / 1000) }`

### 3.3 Implement Home Feedback Tab

Uses `MobilePhysioClientSubTab.init()` with config:
- endpoint: `/50/HomeFdbk`
- modelName: `HomeFeedback`
- primaryKey: `feedbackId`
- columns: from `MobilePhysioManagement.columns.HomeFeedback`
- formKey: `HomeFeedback`
- preData: `{ clientId, feedbackDate: Math.floor(Date.now() / 1000) }`

### 3.4 Implement Statistics Tab

**File:** `m/js/physio/clients-exercises-stats.js` (~120 lines)

- Deferred init: only loaded when Statistics tab is first activated
- Fetch via `Layer8MAuth.get()` with L8Query: `select * from SessionReport where clientId=<id> limit 200`
- Client-side aggregation (matching desktop `clients-session-stats.js`):
  - Total sessions count
  - Latest session status (Green/Yellow/Red)
  - Average pain before / after
  - Adjustments count (where `adjustmentMade` is true)
  - Follow-ups count (where `followupRequired` is true)
- Render KPI cards as simple mobile HTML (styled cards, no `Layer8DWidget` dependency)
- Pain trend chart via `Layer8MChart` — rendered AFTER tab becomes visible (container needs non-zero dimensions per rendering lifecycle rules)
- Status distribution pie chart via `Layer8MChart`

### 3.5 Implement Exercise Info Tab

Added inline to `clients-exercises.js` — reuses the protocol exercise data already fetched for the "My Exercises" tab (no additional server call). For each exercise:
- Exercise name, category label, body region, joint
- Instructions text
- Video embed (YouTube iframe) if `videoStoragePath` exists
- Sets/reps/load notes from the protocol exercise

Display-only, no CRUD.

### 3.6 File Organization

| File | Responsibility | Est. Lines |
|------|---------------|------------|
| `clients-exercises.js` | Main popup, tab switching, My Exercises tab, Details tab, Exercise Info tab | ~250 |
| `clients-exercises-subtab.js` | Shared behavioral helper for add-button + table sub-tabs | ~100 |
| `clients-exercises-stats.js` | Statistics tab with KPIs + charts | ~120 |

Session Reports and Home Feedback tabs are config-only calls to the shared helper (~10 lines each inside `clients-exercises.js`).

---

## Phase 4: Dashboard Updates

### 4.1 Update `m/sections/dashboard.html`
Add 2 new KPI stat cards to the existing dashboard grid:
- **Session Reports** — count via L8Query: `select * from SessionReport`
- **Home Feedback** — count via L8Query: `select * from HomeFeedback`

---

## Phase 5: End-to-End Verification

For every section affected by this plan:

1. Navigate to Physiotherapy > Management on mobile
2. Verify **Therapists** service card appears and loads data in card list
3. Verify Therapists card click opens detail popup with all fields (firstName, lastName, email, phone, specialization, licenseNumber, isActive)
4. Verify Therapists Add/Edit/Delete works
5. Verify **Session Reports** service card appears and loads data
6. Verify Session Reports card click opens detail popup with all fields
7. Verify Session Reports Add works (form opens, saves, table refreshes)
8. Verify **Home Feedback** service card appears and loads data
9. Verify Home Feedback card click opens detail popup with all fields
10. Verify Home Feedback Add works
11. Navigate to Clients, click a client row
12. Verify client popup has **6 tabs**: My Exercises, Exercise Info, Session Reports, Statistics, Home Feedback, Details
13. Verify Session Reports tab shows card list filtered to this client's reports
14. Verify "Add Report" button in popup works (pre-populates clientId, saves correctly)
15. Verify Statistics tab shows KPI cards (total sessions, avg pain, etc.)
16. Verify Statistics charts render correctly (pain trend line, status pie) — must appear after tab activation, not blank
17. Verify Home Feedback tab shows card list filtered to this client's feedback
18. Verify "Add Feedback" button in popup works
19. Verify Exercise Info tab shows exercise detail cards with videos
20. Verify Dashboard KPI cards include Session Reports and Home Feedback counts
21. Verify on both mobile viewport and tablet viewport
22. Verify enum columns render labels (not raw numbers) in all new card lists
23. Verify status badge CSS classes display correct colors (green/yellow/red)

Sections to verify:
- [ ] Therapists (new)
- [ ] Session Reports (new)
- [ ] Home Feedback (new)
- [ ] Client Exercise Popup (enriched — 6 tabs)
- [ ] Dashboard (updated KPIs)
- [ ] Existing services regression check (Clients, Exercises, Plans, Appointments, Progress, Protocols)

---

## Mobile Checklist (per `checklist.md`)

- [ ] Per sub-module: enums with renderers using `Layer8MRenderers`
- [ ] Per sub-module: columns with `primary: true` / `secondary: true` for card display
- [ ] Per sub-module: forms (reused from desktop, stripped for mobile)
- [ ] Registry index file — no change needed (`physio-index.js` already registers `MobilePhysioManagement`)
- [ ] Nav config: services added with correct model names, endpoints, idFields
- [ ] Nav data patch — no change needed (dynamically resolves any model)
- [ ] `m/app.html`: script tags in correct dependency order (enums before columns before forms)
- [ ] Reference registry entries — no new entries needed (SessionReport/HomeFeedback not used as lookupModel)
- [ ] Field names verified against `.pb.go` protobuf JSON tags

---

## Deferred Items

| Item | Reason |
|------|--------|
| Workout Builder for mobile | Complex desktop-specific feature with circuit tables, drag-and-drop reordering, exercise assignment popups. Needs a separate design for mobile touch patterns. |
| User Provisioning on mobile | Desktop auto-creates user accounts when adding therapists/clients. This is an admin feature that can remain desktop-only. |
| Therapist Lookups cache on mobile | Desktop caches therapist names for display. Mobile reference registry already handles this via `Layer8MReferencePicker`. |
