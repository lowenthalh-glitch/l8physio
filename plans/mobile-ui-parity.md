# Mobile UI Parity Plan — l8physio (v2)

## Gap Analysis

### Desktop features with NO mobile equivalent

| # | Feature | Desktop File(s) | Lines | Gap Severity |
|---|---------|-----------------|-------|-------------|
| 1 | Head Therapist Dashboard | htdash-view.js, htdash-timeline.js | 238+156 | HIGH |
| 2 | Client Workout Plan (full CRUD) | clients-exercises.js, clients-exercises-actions.js | 404+~80 | HIGH |
| 3 | Session View (multi-client) | session-view.js | 499 | MEDIUM |
| 4 | Workout Builder | workout-builder.js, workout-builder-circuits.js, workout-builder-assign.js | ~400 | MEDIUM |
| 5 | Plan Editor | plans-editor.js | ~200 | MEDIUM |
| 6 | Client Session Reports tab | clients-session-reports.js | 143 | MEDIUM |
| 7 | Client Statistics (charts/KPI) | clients-session-stats.js | 151 | LOW |
| 8 | Client Appointments tab | clients-appointments.js | 118 | LOW |
| 9 | Client Home Feedback tab | clients-home-feedback.js | 309 | LOW |
| 10 | Therapist detail (clients list) | physio-init.js `_showTherapistClients` | ~60 | LOW |
| 11 | Exercise Info (video/image) | clients-exercises-info.js | 152 | LOW |
| 12 | Boostapp event -> Session popup | physio-init.js `_showSessionView` | ~40 | MEDIUM |

### Mobile features that exist but are INCOMPLETE

| # | Feature | Current State | Gap |
|---|---------|--------------|-----|
| A | Client row click | 2-tab popup (read-only exercises + details) | Missing: workout CRUD, reports, stats, feedback, appointments |
| B | Boostapp columns | Table renders, no custom row click | Missing: session view popup |
| C | Mobile forms | physio-forms-mobile.js wraps shared forms | Missing: home feedback custom form |
| D | Therapist row click | Standard form detail | Missing: clients list tab |

### Structural deviation from l8erp canonical pattern

l8erp loads desktop enums/columns/forms directly on mobile (`../hcm/core-hr/core-hr-enums.js`). l8physio has independent mobile-specific copies (`m/js/physio/clients-enums.js`). This doubles maintenance surface. Phase 0 consolidates to follow the l8erp pattern.

---

## Behavioral vs Configuration Audit (plan-duplication-audit compliance)

### Files with extractable shared logic

| Desktop File | Shareable Behavioral Logic | Platform-Specific Render |
|-------------|---------------------------|------------------------|
| htdash-view.js | `_getFilteredSortedRows()` (sort/filter, 38 lines) | `_render()` (HTML table + DOM events) |
| htdash-timeline.js | Entry transformation (lines 34-107, 73 lines), dedup (lines 110-119) | `_renderEntries()` (HTML divs + emoji) |
| session-view.js | `_loadClientsAndPlans()`, all CRUD delegated to PhysioPlanActions | `_renderPlanCircuits()` (HTML + DOM), `_renderSessionPopup()` |
| clients-exercises.js | `_buildCircuitRows()`, all CRUD delegated to PhysioPlanActions | `_renderPlanTable()` (Layer8DTable) |
| clients-session-stats.js | KPI calculation (lines 58-63), chart data transforms (lines 88-95, 120-127) | Layer8DWidget/Layer8DChart rendering |
| clients-home-feedback.js | `_checkDuplicateDate()`, `_calculateColor()` | Radio button DOM construction |
| clients-appointments.js | Event filtering (lines 39-47), status map (lines 59-67) | Layer8DTable rendering |
| clients-exercises-info.js | `_extractYoutubeId()`, `_fetchImageBlob()` | Video/image popup HTML |

**Duplication estimate:** Without extraction, mobile rewrites would duplicate ~250 lines of behavioral logic across htdash-timeline, session-view, clients-exercises, and stats. This exceeds the 100-line threshold. Phase 0 extraction is MANDATORY.

### Extraction strategy

Extract shared behavioral logic from mixed functions into platform-agnostic modules. Desktop and mobile both call shared functions, only the rendering differs.

**Shared modules to create (or refactor into):**
1. `htdash-timeline.js` -> extract `PhysioDashTimeline.buildEntries(feedbacks, reports, overrides, swaps, exMap)` returning entry array (no HTML)
2. `clients-session-stats.js` -> extract `PhysioSessionStats.compute(reports)` returning `{kpis, painData, statusData}` (no chart objects)
3. `clients-home-feedback.js` -> `_calculateColor()` and `_checkDuplicateDate()` are already isolated; usable by mobile
4. `clients-appointments.js` -> extract `PhysioClientAppointments.filterByClient(events, client)` returning filtered array
5. `session-view.js` and `clients-exercises.js` -> already delegate to `PhysioPlanActions` (no extraction needed)

---

## Data Flow Trace (platform-conversion-data-flow compliance)

### Step 0: Feature Inventory — Dashboard (htdash-view.js)

| Element | Type | Action |
|---------|------|--------|
| Table with 9 columns | Table chrome | Implement via Layer8MTable cards |
| Multi-column sort (shift+click) | Table chrome | Defer — mobile uses single sort via Layer8MTable |
| Per-column text filter | Table chrome | Defer — mobile uses Layer8MTable built-in filter |
| Refresh button | Supplementary | Implement |
| Row click -> detail popup | CRUD | Implement |
| Detail popup: Overview tab | CRUD | Implement — client info, status badges, override form |
| Detail popup: Workout Plan tab | CRUD | Phase 2 — full CRUD |
| Detail popup: Timeline tab | CRUD | Implement — entry list |
| Detail popup: Exercise Changes tab | CRUD | Implement — Layer8MTable |
| Override save (POST OvrdLog + PUT PhyClient) | CRUD | Implement |
| Default sort: override asc, session desc, feedback desc | State | Defer — not applicable to card-based mobile view |

### Step 0: Feature Inventory — Client Popup (clients-exercises.js)

| Element | Type | Action |
|---------|------|--------|
| 7 tabs (Exercises, Info, Reports, Stats, Feedback, Appointments, Details) | Navigation | Implement |
| Circuit-grouped exercise table | Table chrome | Implement |
| Fixed/Variable exercise labels | Table chrome | Implement |
| Inline sets/reps/notes/load editing | CRUD | Implement |
| Progression/Regression (+/-) buttons | CRUD | Implement |
| Move up/down buttons | CRUD | Implement |
| Add/Delete exercise | CRUD | Implement |
| Save with change logging | CRUD | Implement |
| Video popup (YouTube/Vimeo embed) | Supplementary | Implement |
| Image popup | Supplementary | Implement |
| Exercise checkbox selector | Supplementary | Defer — desktop-specific UX |
| Session report list + add form | CRUD | Implement |
| KPI cards (avg pain, session count) | Supplementary | Implement |
| Pain trend line chart | Supplementary | Implement |
| Status distribution pie chart | Supplementary | Implement |
| Home feedback list + custom form | CRUD | Implement |
| Appointments list (Boostapp events) | Table chrome | Implement |
| Client details (read-only form) | CRUD | Already exists |

### Step 0: Feature Inventory — Session View (session-view.js)

| Element | Type | Action |
|---------|------|--------|
| Multi-client tab popup | Navigation | Implement |
| Per-client workout plan (full CRUD) | CRUD | Implement (reuse Phase 2 renderer) |
| 1-on-1 shortcut (opens client popup directly) | Navigation | Implement |
| Tab switching with client names | Navigation | Implement |

### Step 1: Data Flow Tracing

**Dashboard row click:**
```
Table card tap -> Layer8MEditTable.onRowClick(item, id)
  -> item = full HeadThDashRow from table's loaded data (no server fetch needed)
  -> Custom handler opens Layer8MPopup with tabs
  -> Overview: renders from item data directly (client name, status, therapist, reason)
  -> Timeline: fetches HomeFdbk + SessRpt + OvrdLog + ExSwapLog + PhyExercis (5 parallel GETs)
  -> Exercise Changes: fetches ExSwapLog (1 GET)
  -> Workout Plan: fetches PhyClient + TreatmentPlan (2 GETs)
```

**Client row click:**
```
Table card tap -> Layer8MEditTable.onRowClick(item, id)
  -> physio-nav-config.js onRowClick: MobilePhysioClientExercises.open(id)
  -> Fetches PhysioClient (1 GET) — re-fetches for fresh data
  -> Opens Layer8MPopup with 7 tabs
  -> Exercises tab (active): fetches TreatmentPlan (1 GET), then PhysioExercise (1 GET)
  -> Other tabs: lazy-load on first click
```

**Override save:**
```
User taps Save Override button in popup
  -> POST /50/OvrdLog (override log entry)
  -> GET /50/PhyClient (fetch latest client)
  -> PUT /50/PhyClient (update overrideStatus)
  -> Refresh timeline in popup
```

### Step 2: Mobile Platform Equivalents

| Desktop Component | Mobile Equivalent | Notes |
|-------------------|-------------------|-------|
| Layer8DTable | Layer8MTable / Layer8MEditTable | Card-based, no multi-column sort |
| Layer8DPopup | Layer8MPopup | Built-in tab support via onTabChange |
| Layer8DChart | Layer8MChart | Same API, wraps desktop chart core |
| Layer8DWidget | Layer8DWidget | Shared component, works on both |
| Layer8DForms | Layer8MForms | Mobile-specific rendering |
| getAuthHeaders() | Layer8MAuth.get/post/put/delete | Mobile HTTP wrapper |
| Layer8DNotification | Layer8MUtils.showSuccess/showError | Mobile toast |
| document.querySelector | popup.body.querySelector | Scoped to popup body |

### Step 3: Intermediate Layer Verification

**Nav config -> table -> popup chain:**
```
physio-nav-config.js
  -> defines onRowClick per service (receives item, id)
  -> Layer8MNavData.loadServiceData() reads onRowClick from config
  -> Passes to Layer8MViewFactory.create('table', {onRowClick: ...})
  -> Layer8MViewFactory registers it as table.config.onRowClick
  -> Layer8MEditTable attaches click handler to .mobile-edit-table-card
  -> On card tap: extracts id from dataset, finds item via _findItemById(id)
  -> Calls config.onRowClick(item, id)
```

**Verify at each link:**
- Nav config `onRowClick` signature: `function(item, id)` — MATCH
- ViewFactory forwards `onRowClick` to table options — VERIFIED (layer8m-view-factory.js:48-65)
- EditTable calls `this.config.onRowClick(item, id)` — VERIFIED (layer8m-edit-table.js:334-346)
- `item` is full record from table data, `id` is from `getItemId(item)` — VERIFIED

### Hidden Container / Deferred Rendering

**Charts in tabs (Phase 3):**
- Statistics tab contains Layer8MChart (pain trend + status distribution)
- Tab is initially hidden (`display:none`) in Layer8MPopup
- Layer8MChart renders SVG that needs container dimensions
- **MUST defer chart init until tab is activated**

**Pattern:**
```javascript
onTabChange: function(tabId, popup) {
    if (tabId === 'stats' && !statsLoaded) {
        statsLoaded = true;
        _renderStats(popup.body.querySelector('#stats-container'), clientId);
    }
}
```

### Value Type Transform Parity

| Field | Server Type | Desktop Transform | Mobile Must Match |
|-------|-------------|-------------------|-------------------|
| lastFeedbackStatus | int (0-3) | `render.sessionStatus(value)` -> HTML badge | Use same `PhysioManagement.render.sessionStatus()` |
| lastSessionStatus | int (0-3) | Same as above | Same |
| overrideStatus | int (0-3) | Same as above | Same |
| lastFeedbackDate | int64 (unix) | `Layer8DUtils.formatDate()` | `Layer8MUtils.formatDate()` or `Layer8DUtils.formatDate()` (loaded on mobile) |
| swapDate | int64 (unix) | `Layer8DUtils.formatDateTime()` | Same (Layer8DUtils loaded on mobile) |
| status (HomeFeedback) | int (1-3) | `render.sessionStatus()` | Same |
| difficulty (HomeFeedback) | int (1-4) | `TRAINING` label map | Same label map |
| direction (ExSwapLog) | int (0-2) | `DIR` label map `{1:'Progression',2:'Regression'}` | Same label map |

**All transforms use shared enums/renderers already loaded on mobile. No value type mismatches.**

---

## Traceability Matrix

| # | Gap / Action Item | Phase |
|---|-------------------|-------|
| 1 | Consolidate mobile scripts to load desktop files (l8erp pattern) | Phase 0a |
| 2 | Add cross-platform guards to plan-actions.js (getAuthHeaders, Layer8DNotification) | Phase 0b |
| 3 | Add cross-platform guards to clients-exercises-info.js (Layer8DPopup) | Phase 0b |
| 4 | Rewrite mobile module registry to use desktop namespaces + column enrichment | Phase 0c |
| 5 | Extract shared behavioral logic from htdash-timeline.js | Phase 0d |
| 6 | Extract shared behavioral logic from clients-session-stats.js | Phase 0d |
| 7 | Extract shared behavioral logic from clients-appointments.js | Phase 0d |
| 8 | Dashboard (htdash) custom card view | Phase 1 |
| 9 | Dashboard detail popup (overview, timeline, exercise changes) | Phase 1 |
| 10 | Override save from mobile | Phase 1 |
| 11 | Shared mobile plan renderer (used by dashboard, client popup, session view, plan editor) | Phase 2 |
| 12 | Client workout plan full CRUD (calls shared renderer) | Phase 2 |
| 13 | Exercise info (video/image) popups | Phase 2 |
| 14 | Client session reports tab | Phase 3 |
| 15 | Client statistics tab (KPI + charts) | Phase 3 |
| 16 | Client home feedback tab (custom form) | Phase 3 |
| 17 | Client appointments tab | Phase 3 |
| 18 | Therapist detail popup (details + clients) | Phase 3 |
| 19 | Deferred chart rendering in hidden tabs | Phase 3 |
| 20 | Session view (multi-client from Boostapp, calls shared renderer) | Phase 4 |
| 21 | Boostapp row click -> session view | Phase 4 |
| 22 | Workout builder | Phase 5 |
| 23 | Plan editor (calls shared renderer) | Phase 5 |
| 24 | Therapist scoped permissions verification | Phase 6 |

---

## Implementation Phases

### Phase 0: Consolidate Shared Files + Extract Behavioral Logic

**Goal:** Eliminate duplicate code, establish shared modules, follow l8erp canonical pattern.

#### 0a: Load desktop enums/columns on mobile (l8erp pattern)

**Changes to `m/app.html`:**
Replace mobile-specific enum/column includes with desktop file paths:

```
REMOVE:                                    REPLACE WITH:
js/physio/clients-enums.js          ->     ../physio/clients/clients-enums.js
js/physio/clients-columns.js        ->     ../physio/clients/clients-columns.js
js/physio/exercises-enums.js        ->     ../physio/exercises/exercises-enums.js
js/physio/exercises-columns.js      ->     ../physio/exercises/exercises-columns.js
js/physio/plans-enums.js            ->     ../physio/plans/plans-enums.js
js/physio/plans-columns.js          ->     ../physio/plans/plans-columns.js
js/physio/appointments-enums.js     ->     ../physio/appointments/appointments-enums.js
js/physio/appointments-columns.js   ->     ../physio/appointments/appointments-columns.js
js/physio/progress-enums.js         ->     ../physio/progress/progress-enums.js
js/physio/progress-columns.js       ->     ../physio/progress/progress-columns.js
js/physio/protocols-columns.js      ->     ../physio/protocols/protocols-columns.js
js/physio/therapists-columns.js     ->     ../physio/therapists/therapists-columns.js
js/physio/sessionreport-enums.js    ->     ../physio/sessionreport/sessionreport-enums.js
js/physio/sessionreport-columns.js  ->     ../physio/sessionreport/sessionreport-columns.js
js/physio/homefeedback-enums.js     ->     ../physio/homefeedback/homefeedback-enums.js
js/physio/homefeedback-columns.js   ->     ../physio/homefeedback/homefeedback-columns.js
js/physio/boostapp-columns.js       ->     ../physio/boostapp/boostapp-columns.js
```

Also add desktop files needed for popups:
```
ADD:
../physio/sessionreport/sessionreport-forms.js
../physio/homefeedback/homefeedback-forms.js
../physio/plan-actions.js
../physio/clients/clients-exercises-info.js
../physio/boostapp/boostapp-enums.js
```

**Keep mobile-specific files:**
- `js/physio/physio-forms-mobile.js` (mobile form customizations)
- `js/physio/physio-index.js` (mobile module registry)
- `js/physio/physio-nav-patch-m.js` (form interception)
- `js/physio/physio-user-provisioning-m.js` (user creation)
- `js/physio/clients-exercises.js` (custom mobile popup — rewritten in Phase 2)

**Delete redundant mobile files:**
- All `m/js/physio/*-enums.js` and `m/js/physio/*-columns.js` files (17 files)

#### 0b: Make desktop shared files cross-platform safe

Several desktop files will be loaded on mobile. They must work on both platforms.

**File: `physio/plan-actions.js` -- add cross-platform guards**

The `_headers()` function uses `getAuthHeaders()` which is desktop-only. Add fallback (l8erp `mgr-actions.js` pattern):
```javascript
function _headers() {
    if (typeof getAuthHeaders === 'function') return getAuthHeaders();
    var token = (typeof Layer8MAuth !== 'undefined') ? Layer8MAuth.getBearerToken()
              : sessionStorage.getItem('bearerToken');
    return { 'Authorization': token ? 'Bearer ' + token : '', 'Content-Type': 'application/json' };
}
```

The `save()` and `swap()` functions use `Layer8DNotification`. Add guards:
```javascript
// Replace: Layer8DNotification.success('Plan saved.')
// With:
if (typeof Layer8DNotification !== 'undefined') Layer8DNotification.success('Plan saved.');
else if (typeof Layer8MUtils !== 'undefined') Layer8MUtils.showSuccess('Plan saved.');
```

Apply same pattern to all `Layer8DNotification.warning/error/info/success` calls in the file.

**File: `physio/clients/clients-exercises-info.js` -- add cross-platform guards**

`showVideoPopup()` and `showImagePopup()` call `Layer8DPopup.show()`. Add mobile fallback:
```javascript
function _showPopup(title, content, size) {
    if (typeof Layer8DPopup !== 'undefined') {
        Layer8DPopup.show({ title: title, content: content, size: size || 'large' });
    } else if (typeof Layer8MPopup !== 'undefined') {
        Layer8MPopup.show({ title: title, content: content, size: 'full' });
    }
}
```

Replace direct `Layer8DPopup.show()` calls with `_showPopup()`.

#### 0c: Update mobile module registry to use desktop namespaces

**File: `m/js/physio/physio-index.js` -- rewrite**

Follow l8erp `hcm-index.js` pattern: reference desktop namespace directly, enrich columns with `primary`/`secondary` via `.map()`:

```javascript
(function() {
    'use strict';

    // Enrich desktop columns with mobile card display markers
    function _addCardMarkers(columns, primaryKey, secondaryKey) {
        if (!columns) return columns;
        return columns.map(function(col) {
            if (col.key === primaryKey) return Object.assign({}, col, { primary: true });
            if (col.key === secondaryKey) return Object.assign({}, col, { secondary: true });
            return col;
        });
    }

    // Build enriched column set from desktop PhysioManagement.columns
    var desktopCols = PhysioManagement.columns || {};
    var enriched = {
        PhysioClient:       _addCardMarkers(desktopCols.PhysioClient, 'lastName', 'status'),
        PhysioTherapist:    _addCardMarkers(desktopCols.PhysioTherapist, 'lastName', 'specialization'),
        PhysioExercise:     _addCardMarkers(desktopCols.PhysioExercise, 'name', 'category'),
        TreatmentPlan:      _addCardMarkers(desktopCols.TreatmentPlan, 'title', 'status'),
        // ... remaining models
    };

    // Create registry using desktop namespace + enriched columns
    window.MobilePhysioManagement = Layer8MModuleRegistry.create('MobilePhysio', {
        'Management': PhysioManagement
    });

    // Override columns with enriched versions
    MobilePhysioManagement.getColumns = function(modelName) {
        return enriched[modelName] || desktopCols[modelName] || null;
    };
})();
```

This eliminates all 17 mobile enum/column files while preserving card display behavior.

#### 0d: Extract shared behavioral logic

**File: `physio/htdash/htdash-timeline.js` -- refactor**

Extract `buildEntries()` as a public method that returns an entry array (no HTML):
```javascript
PhysioDashTimeline.buildEntries = function(feedbacks, reports, overrides, swaps, exMap) {
    // Move lines 34-119 (entry transformation + sort + dedup) here
    // Returns: [{date, type, label, status, user, details}, ...]
};
```

`render()` calls `buildEntries()` then `_renderEntries()`. Mobile calls `buildEntries()` then its own renderer.

**File: `physio/clients/clients-session-stats.js` -- refactor**

Extract computation as a public method:
```javascript
PhysioSessionStats.compute = function(reports) {
    // KPI calculation (lines 58-63)
    // Pain data transform (lines 88-95)
    // Status data transform (lines 120-127)
    // Returns: {kpis: {totalSessions, avgPainBefore, ...}, painData: [...], statusData: [...]}
};
```

**File: `physio/clients/clients-appointments.js` -- refactor**

Extract filtering as a public method:
```javascript
PhysioClientAppointments.filterByClient = function(events, client) {
    // Lines 39-47, 59-67, 70-82 — filter, map, transform
    // Returns: [{title, date, type, coach, status, location}, ...]
};
```

**Estimated scope:** ~50 lines of refactoring across 3 files (extract, not rewrite).

**Total Phase 0 scope:** ~120 lines of changes across 6 files + 17 file deletions. No new behavioral code — only guards, extractions, and registry consolidation.

### Phase 1: Head Therapist Dashboard (mobile)

**New file: `m/js/physio/htdash-view-m.js`** (~200 lines)

Mobile dashboard using the shared `PhysioDashTimeline.buildEntries()`:
- Custom `onRowClick` handler for `HeadThDashRow` in nav config
- Row click opens `Layer8MPopup` with 4 tabs:
  - Overview: client info, status badges (reuse `PhysioManagement.render.sessionStatus()`), override form
  - Workout Plan: calls `MobilePlanRenderer.render(container, clientId)` (shared renderer from Phase 2)
  - Timeline: calls `PhysioDashTimeline.buildEntries()`, renders mobile-friendly list
  - Exercise Changes: `Layer8MTable` with ExSwapLog columns
- Override save: POST to OvrdLog + PUT to PhyClient via `Layer8MAuth.post/put`
- Deferred tab loading: all non-overview tabs load on first activation
- **NOTE:** Workout Plan tab depends on Phase 2 `plan-renderer-m.js`. If Phase 1 ships before Phase 2, show read-only plan summary instead.

**Changes:**
- `m/js/nav-config/physio-nav-config.js` -- add `htdash` service (first in list) with custom `onRowClick`
- `m/js/physio-nav-data-patch.js` -- add `HeadThDashRow` to custom handlers
- `m/app.html` -- add `../physio/htdash/htdash-timeline.js` and `js/physio/htdash-view-m.js`

### Phase 2: Shared Plan Renderer + Client Workout CRUD (mobile)

**Why a shared renderer:** The workout plan CRUD UI is needed in 4 places: client popup (Phase 2), dashboard Workout Plan tab (Phase 1), session view per-client tab (Phase 4), and plan editor (Phase 5). On desktop, `PhysioSessionPlanRenderer.render(container, clientId)` serves this role. Mobile needs an equivalent shared renderer to avoid duplicating ~250 lines of circuit rendering + event handling across 4 files.

**New file: `m/js/physio/plan-renderer-m.js`** (~250 lines)

Shared mobile workout plan renderer:
```javascript
window.MobilePlanRenderer = {
    render: function(container, clientId) { ... }
};
```

Internals:
- Fetches client + active TreatmentPlan + PhysioExercise map via `Layer8MAuth.get`
- Renders circuit-grouped exercises (Mobility, Rehab, Strength, Functional) as mobile card list
- Per-exercise: name, sets input, reps input, notes input, load select, action buttons
- Actions: progression (+), regression (-), move up/down, delete, add — all delegate to `PhysioPlanActions`
- Save: `PhysioPlanActions.save()` + `PhysioPlanActions.logChanges()`
- Originals captured from DOM after render (same pattern as desktop session-view.js)
- Video/image via `PhysioClientExerciseInfo.showVideoPopup/showImagePopup` (loaded from desktop)
- Per-container state via `container._planState`, single delegated click handler on container
- Uses `Layer8MAuth` for all API calls, `Layer8MUtils` for notifications

**Callers (config-only, no behavioral duplication):**
- Phase 1 `htdash-view-m.js`: `MobilePlanRenderer.render(planContainer, clientId)` in Workout Plan tab
- Phase 2 `clients-exercises.js`: `MobilePlanRenderer.render(exercisesContainer, clientId)` in Exercises tab
- Phase 4 `session-view-m.js`: `MobilePlanRenderer.render(clientContainer, clientId)` per client tab
- Phase 5 `plans-editor-m.js`: `MobilePlanRenderer.render(planContainer, clientId)` in plan view

**Rewrite: `m/js/physio/clients-exercises.js`** (~150 lines, down from 350)

Client popup is now a thin shell:
- Fetches client record via `Layer8MAuth.get`
- Opens `Layer8MPopup` with 7 tabs (Exercises, Info, Reports, Stats, Feedback, Appointments, Details)
- Exercises tab: calls `MobilePlanRenderer.render(container, clientId)` — no workout logic here
- Details tab: read-only form via `Layer8MForms.renderForm()`
- Other tabs: lazy-load on activation (Phase 3 adds content renderers)

**Changes:**
- `m/app.html` -- add `js/physio/plan-renderer-m.js`, ensure `../physio/plan-actions.js` and `../physio/clients/clients-exercises-info.js` are loaded

### Phase 3: Client & Therapist Popup Tabs (mobile)

**Expand `m/js/physio/clients-exercises.js`** to 7 tabs (from 2), or split tab content into separate files if approaching 500 lines.

**New file: `m/js/physio/clients-popup-tabs-m.js`** (~300 lines)

Tab content renderers for the client popup:
- **Session Reports tab:** `Layer8MTable` listing reports + "Add Report" button -> `Layer8MPopup` form using `sessionreport-forms.js`
- **Statistics tab:** KPI cards via `Layer8DWidget.render()` + charts via `Layer8MChart` using `PhysioSessionStats.compute()`. **CRITICAL: defer chart init until tab activation (hidden container rule).**
- **Home Feedback tab:** `Layer8MTable` listing feedback + "Add Feedback" button -> custom form with Hebrew labels, radio buttons, `_calculateColor()`, one-per-day check via `_checkDuplicateDate()`
- **Appointments tab:** `Layer8MTable` using `PhysioClientAppointments.filterByClient()` for data

**New file: `m/js/physio/therapist-detail-m.js`** (~100 lines)

Therapist popup with 2 tabs:
- Personal Details: read-only field grid (same pattern as desktop `_showTherapistClients`)
- Clients: `Layer8MTable` with `baseWhereClause: 'therapistId=' + tid`

**Changes:**
- `m/js/nav-config/physio-nav-config.js` -- add custom `onRowClick` for `PhysioTherapist`
- `m/app.html` -- add new script includes

### Phase 4: Session View & Boostapp Integration (mobile)

**New file: `m/js/physio/session-view-m.js`** (~180 lines)

Multi-client session popup:
- Boostapp event row click -> check participants
- 1-on-1: delegate to `MobilePhysioClientExercises.open(physioClientId)`
- Multi-client: `Layer8MPopup` with client name tabs
- Each tab: `MobilePlanRenderer.render(tabContainer, clientId)` — shared renderer, no duplication
- Uses `Layer8MAuth.get` for parallel client+plan fetching
- Tab switching via `onTabChange` callback, deferred rendering per tab

**Changes:**
- `m/js/nav-config/physio-nav-config.js` -- add custom `onRowClick` for `BoostappCalendarEvent`
- `m/app.html` -- add script include

### Phase 5: Workout Builder & Plan Editor (mobile)

**New file: `m/js/physio/workout-builder-m.js`** (~250 lines)

Simplified mobile workout builder:
- Step 1: `Layer8MPopup` form — posture, joint, phase, volume selects
- Step 2: Preview generated circuits (reuse `workout-builder-circuits.js` logic if extractable, otherwise re-implement)
- Step 3: Assign to client via reference picker + save

**New file: `m/js/physio/plans-editor-m.js`** (~100 lines)

Plan editor (TreatmentPlan row click):
- Plan details header (title, client, status, dates) — read-only summary
- Workout plan: `MobilePlanRenderer.render(container, clientId)` — shared renderer, no duplication
- Save delegated to shared renderer's built-in save button

**Changes:**
- `m/js/nav-config/physio-nav-config.js` -- add custom `onRowClick` for `TreatmentPlan`
- `m/app.html` -- add script includes, load `../physio/builder/workout-builder-circuits.js` if shared

---

## Phase 6: End-to-End Verification

For every feature implemented in Phases 0-5:

1. Navigate to each service on mobile
2. Verify table data loads (cards render, not blank)
3. Verify row click opens correct popup/detail
4. Verify popup content is populated (not empty)
5. Verify CRUD operations work (add, edit, delete where applicable)
6. Verify on admin user (full access)
7. Verify on therapist user (scoped permissions — only own clients visible)
8. Compare behavior with desktop equivalent — must be functionally identical
9. Verify deferred tab rendering (charts render correctly when tab is first activated)

**Sections to verify:**
- [ ] Phase 0: All existing mobile views still work after script consolidation
- [ ] Phase 1: Dashboard — cards load, row click opens 4-tab popup, override save works, timeline shows events with user names
- [ ] Phase 2: Clients — row click opens popup, workout CRUD (add/delete/move/swap/edit), save logs changes
- [ ] Phase 3: Client popup — all 7 tabs render, session reports CRUD, stats charts (deferred render), feedback form (Hebrew, radio, one-per-day), appointments list
- [ ] Phase 3: Therapists — row click opens 2-tab popup (details + clients list)
- [ ] Phase 4: Boostapp Calendar — row click opens session view (1-on-1 shortcut or multi-client tabs)
- [ ] Phase 5: Treatment Plans — row click opens plan editor with circuit CRUD
- [ ] Phase 5: Workout Builder — generates plan from protocol selection, assigns to client
- [ ] All changes logged to ExSwapLog with therapistId
- [ ] Dark mode: all custom views use --layer8d-* tokens, no hardcoded colors

---

## Rule Compliance

| Rule | Status | Notes |
|------|--------|-------|
| plan-duplication-audit | OK | Phase 0 extracts shared behavioral logic; l8erp pattern eliminates 17 duplicate files; Phase 2 `plan-renderer-m.js` shared by 4 callers (no CRUD duplication) |
| plan-traceability-and-verification | OK | Traceability matrix maps all 20 items to phases; Phase 6 verification |
| platform-conversion-data-flow | OK | Step 0 feature inventories, Step 1 data flow traces, Step 3 intermediate layer verification, hidden container analysis, value type parity table |
| mobile-rules | OK | Uses Layer8M* components; closes all desktop/mobile gaps; follows l8erp canonical pattern |
| maintainability — max 500 lines | OK | Each new file targets 100-350 lines |
| maintainability — no duplicate code | OK | Phase 0 extracts shared logic; desktop files loaded on mobile |
| maintainability — second instance rule | OK | `MobilePlanRenderer` is shared by 4 consumers; no second instances of workout CRUD |
| l8ui-no-project-specific-code | OK | All code in physio project dirs |
| l8ui-theme-compliance | OK | All custom HTML uses --layer8d-* tokens |
| canonical-project-selection | OK | ERP-style project, follows l8erp patterns |
| report-infra-bugs | N/A | No workarounds planned |

## Files Changed Summary

| File | Action | Phase |
|------|--------|-------|
| `m/app.html` | **Update** — replace mobile includes with desktop paths, add new scripts | 0a |
| `m/js/physio/*-enums.js` (8 files) | **Delete** — replaced by desktop files | 0a |
| `m/js/physio/*-columns.js` (9 files) | **Delete** — replaced by desktop files | 0a |
| `physio/plan-actions.js` | **Update** — cross-platform guards for `_headers()`, `Layer8DNotification` | 0b |
| `physio/clients/clients-exercises-info.js` | **Update** — cross-platform guard for popup (`_showPopup` helper) | 0b |
| `m/js/physio/physio-index.js` | **Rewrite** — use desktop namespace + column enrichment with `primary`/`secondary` | 0c |
| `physio/htdash/htdash-timeline.js` | **Refactor** — extract `buildEntries()` public method | 0d |
| `physio/clients/clients-session-stats.js` | **Refactor** — extract `compute()` public method | 0d |
| `physio/clients/clients-appointments.js` | **Refactor** — extract `filterByClient()` public method | 0d |
| `m/js/physio/htdash-view-m.js` | **New** (~200 lines) | 1 |
| `m/js/nav-config/physio-nav-config.js` | **Update** — add htdash, therapist, boostapp, plan row clicks | 1-5 |
| `m/js/physio-nav-data-patch.js` | **Update** — add custom handlers | 1-4 |
| `m/js/physio/plan-renderer-m.js` | **New** (~250 lines) — shared workout plan CRUD renderer | 2 |
| `m/js/physio/clients-exercises.js` | **Rewrite** (~150 lines) — thin popup shell, delegates to MobilePlanRenderer | 2 |
| `m/js/physio/clients-popup-tabs-m.js` | **New** (~300 lines) — reports, stats, feedback, appointments | 3 |
| `m/js/physio/therapist-detail-m.js` | **New** (~100 lines) | 3 |
| `m/js/physio/session-view-m.js` | **New** (~180 lines) — calls MobilePlanRenderer per client tab | 4 |
| `m/js/physio/workout-builder-m.js` | **New** (~250 lines) | 5 |
| `m/js/physio/plans-editor-m.js` | **New** (~100 lines) — calls MobilePlanRenderer | 5 |
