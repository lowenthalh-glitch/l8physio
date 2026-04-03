# Plan: Edit Workout from Treatment Plan

## Goal

Add an **Edit Workout** action to the Treatment Plans table. Clicking it opens a full-featured workout builder popup pre-populated with the plan's protocol and volume. The therapist can adjust settings, rebuild, and save the updated exercise list back to the plan. The builder tab and the edit popup share all rendering and fetch logic — no duplication.

---

## Current State Analysis

### Treatment Plans table
- Defined via `Layer8DTable` in `physio-init.js` / `Layer8DModuleFactory` (Layer8-standard)
- Row click → `_showDetailsModal` → falls through to `origShowDetails` (standard form popup)
- Columns: `planId`, `title`, `clientId`, `status`, `startDate`, `endDate`, `goals`
- No "Edit Workout" action exists

### Workout Builder
- Lives in `physio/builder/workout-builder.js` (IIFE, ~265 lines)
- Exposed as `window.PhysioWorkoutBuilder` with `init(containerId)` — tab-only
- `_initialized` flag blocks re-init — prevents reuse inside a popup
- Private functions `_renderPanel`, `_addExtraRow`, `_build`, `_renderCircuit`, `_assemble` are not accessible externally
- "Assign to Client" button is hardcoded inside `_build()` — not switchable for edit mode

### Protocol Reconstruction Limitation
`TreatmentPlan.protocolId` stores a single primary protocol reference. Multi-protocol workouts save exercises from all protocols to `plan.exercises`, but the extra protocols' posture+joint are NOT stored separately. At edit time, primary posture+joint is recoverable (via `protocolId → PhysioProtocol`); extra protocols are NOT auto-reconstructed (user re-adds them if needed).

---

## Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| Edit popup vs page | `Layer8DPopup` (xlarge) | Consistent with existing custom popups (PhysioClient, PhysioTherapist patterns in physio-init.js) |
| Code sharing | Expose `PhysioWorkoutBuilder.setupInContainer()` | No duplication; both tab and popup use identical render/fetch functions |
| Edit mode signalling | `container.dataset` attributes | Decouples mode from function signatures; works across async boundaries |
| Plan detail popup | Intercept `_showDetailsModal` for TreatmentPlan | Same pattern already used for PhysioClient and PhysioTherapist |
| Table format | `Layer8DTable` throughout | Already used for plans table; edit popup adds a Layer8DTable for the plan's exercises summary |
| Extra protocols | Not auto-reconstructed (user re-adds) | Requires no proto changes; primary protocol always recoverable |
| New file | `physio/plans/plans-editor.js` | Single responsibility; keeps workout-builder.js focused on rendering/fetch logic |
| PUT strategy | Fetch full plan → merge exercises → PUT whole object | Pattern from `clients-exercises.js`; avoids partial-update data loss |
| Detail popup content | Full plan fetched before popup opens | Ensures `plan.exercises` is populated (list response may omit repeated fields) |
| Auth helpers | Thin wrappers delegating to globals | Pattern from `clients-exercises.js` lines 7–17; no auth logic duplication |
| Edit Workout button | Content button (not `onSave`) | `onSave` semantics = save data; navigation belongs in content area |
| Table refresh | Callback passed through to `_updatePlan` | Cleanest decoupled refresh without reaching into module internals |

---

## Sibling Project Findings (addresses review concerns)

Researched: `l8physio/physio/clients/clients-exercises.js`, `l8ui/edit_table/layer8d-table-core.js`, `l8ui/shared/layer8d-forms-modal.js`, `l8ui/shared/layer8d-module-crud.js`.

| # | Concern | Finding | Plan Action |
|---|---|---|---|
| C1 | Partial PUT wipes plan fields | `clients-exercises.js`: modify full `self._currentPlan` object, PUT full object | Fetch full plan before PUT; merge exercises onto full plan |
| C2 | `item.exercises` null from list | List query may omit repeated fields | `PhysioPlanEditor.open()` fetches full plan by planId before popup |
| C3 | Duplicate auth/prefix helpers | `clients-exercises.js` lines 7–17: thin wrappers delegating to `getAuthHeaders()` and `Layer8DConfig.getApiPrefix()` | Remove inline logic; delegate to globals |
| C4 | Custom HTML vs generateFormHtml | `layer8d-forms-modal.js`: pairs `generateFormHtml(formDef, data)` with `Layer8DPopup.show()` | Plan uses `Layer8DForms.generateFormHtml(PhysioManagement.forms.TreatmentPlan, item)` for plan fields section |
| C5 | `onSave` used for navigation | `layer8d-forms-modal.js`: `onSave` means save data | "Edit Workout" rendered as a button in popup content; `showFooter: false` |
| C6 | No table refresh after save | `layer8d-module-crud.js`: pass `onSuccess` callback that calls `table.fetchData(1)` | Pass `onRefresh` callback through popup chain; call after PUT success |
| C7 | `Layer8DTable` without endpoint | `layer8d-table-core.js`: `endpoint` optional when `serverSide: false` | No change needed — confirmed safe |
| C8 | `holdSeconds`/`frequency` not saved | Verify against `PlanExercise` in `.pb.go` | Added to exercise push in `_updatePlan`; verify field names against proto |
| C9 | L8Query missing `limit 1` | L8Query rules: explicit limit avoids over-fetching | Add `limit 1` to `_fetchProtocol` query |
| C10 | Exercise table shows UUID | `PhysioManagement.lookups` provides `exerciseName(id)` if available | Enrich exercises with name before `table.setData()`; fallback to ID |

---

## Gap Analysis

| # | Location | Gap | Action |
|---|---|---|---|
| G1 | `workout-builder.js` | `_initialized` blocks popup reuse | Refactor: expose `setupInContainer(container, opts)` as public method; keep `_initialized` guarding only `init()` |
| G2 | `workout-builder.js` | "Assign to Client" button not swappable | Add `container.dataset.editMode` check in `_build()`; render "Save Changes" in edit mode |
| G3 | `workout-builder.js` | `_updatePlan()` does not exist | Add `_updatePlan(container)` — fetch full plan, merge exercises, PUT complete object |
| G4 | `physio-init.js` | TreatmentPlan row click → default form | Add `else if (service.model === 'TreatmentPlan')` branch in `_showDetailsModal` override |
| G5 | `plans-editor.js` | Does not exist | Create: fetches full plan, opens detail popup with `generateFormHtml` + exercises table + Edit button |
| G6 | `plans-columns.js` | `clientId` renders raw UUID | Replace with custom renderer via `PhysioManagement.lookups.clientName()` |
| G7 | `app.html` | No `<script>` for plans-editor.js | Add after `plans-forms.js`, before `physio-lookups.js` |

---

## Traceability Matrix

| # | Gap / Concern | Phase |
|---|---|---|
| G1 | Expose `setupInContainer` on builder | Phase 1 |
| G2 | Edit mode → "Save Changes" button in `_build()` | Phase 1 |
| G3 | `_updatePlan(container)` — fetch-full-plan-then-PUT | Phase 1 |
| C1 | Partial PUT fix | Phase 1 (inside G3) |
| C8 | `holdSeconds`/`frequency` in exercise push | Phase 1 (inside G3) |
| G4 | `_showDetailsModal` override for TreatmentPlan | Phase 2 |
| G5 | Create `plans-editor.js` | Phase 2 |
| C2 | Fetch full plan before popup | Phase 2 (inside G5) |
| C3 | Auth/prefix delegate to globals | Phase 2 (inside G5) |
| C4 | Use `generateFormHtml` for plan fields | Phase 2 (inside G5) |
| C5 | Edit Workout as content button, not `onSave` | Phase 2 (inside G5) |
| C6 | Table refresh callback | Phase 2 (inside G5 + G4) |
| C9 | `limit 1` on protocol query | Phase 2 (inside G5) |
| C10 | Exercise name lookup in table | Phase 2 (inside G5) |
| G6 | `clientId` column renderer | Phase 2 |
| C7 | `Layer8DTable` without endpoint — confirmed safe | No action |
| G7 | `app.html` script tag | Phase 3 |

---

## Implementation Phases

### Phase 1 — Refactor `workout-builder.js` to support popup/edit mode

**File:** `go/physio/ui/web/physio/builder/workout-builder.js`

**1a. Extract `_setupBuilder(container, opts)` internal function**

Move the current `init()` body logic (panel render, event listeners, sync) into a shared internal function:
```javascript
// opts.mode      = 'create' | 'edit'
// opts.planId    = plan's planId (edit mode only)
// opts.onRefresh = callback after successful save (edit mode)
// opts.preset    = { posture, joint, volume, phase } (optional pre-population)
function _setupBuilder(container, opts) {
    container.innerHTML = _renderPanel();

    var postureEl  = container.querySelector('#wb-posture');
    var jointEl    = container.querySelector('#wb-joint');
    var protocolEl = container.querySelector('#wb-protocol');

    if (opts && opts.preset) {
        if (opts.preset.posture) postureEl.value = String(opts.preset.posture);
        if (opts.preset.joint)   jointEl.value   = String(opts.preset.joint);
        if (opts.preset.volume)  container.querySelector('#wb-volume').value = String(opts.preset.volume);
        if (opts.preset.phase)   container.querySelector('#wb-phase').value  = String(opts.preset.phase);
    }

    if (opts && opts.mode === 'edit') {
        container.dataset.editMode  = 'true';
        container.dataset.planId    = opts.planId || '';
        container.dataset.onRefresh = '';  // callback stored on window to avoid serialisation issues
        if (typeof opts.onRefresh === 'function') {
            window._wbRefreshCallback = opts.onRefresh;
        }
    }

    function _syncCode() {
        protocolEl.textContent = _protocolCode(postureEl.value, jointEl.value);
    }
    postureEl.addEventListener('change', _syncCode);
    jointEl.addEventListener('change', _syncCode);
    _syncCode();

    container.querySelector('#wb-add-protocol').addEventListener('click', function() {
        _addExtraRow(container);
    });
    container.querySelector('#wb-build').addEventListener('click', function() {
        _build(container);
    });
}
```

**1b. Simplify `init()` to delegate**
```javascript
init: function(containerId) {
    var container = document.getElementById(containerId);
    if (!container || this._initialized) return;
    this._initialized = true;
    _setupBuilder(container, { mode: 'create' });
},
```

**1c. Add public `setupInContainer(container, opts)`**
```javascript
// Called by plans-editor.js — always fresh, no _initialized guard
setupInContainer: function(container, opts) {
    _setupBuilder(container, opts);
},
```

**1d. Edit mode in `_build()` — swap "Assign to Client" → "Save Changes"**

Replace the hardcoded assign button section in `_build()`:
```javascript
var editMode = container.dataset.editMode === 'true';
var actionBtn = editMode
    ? '<button class="layer8d-btn layer8d-btn-primary layer8d-btn-small wb-save-btn">&#128190; Save Changes</button>'
    : '<button class="layer8d-btn layer8d-btn-primary layer8d-btn-small wb-assign-btn" ' +
      'data-posture="' + posture + '" data-joint="' + joint + '" ' +
      'data-phase="' + phase + '" data-volume="' + volume + '">&#128100; Assign to Client</button>';

html += '<div class="wb-assign-row">' + actionBtn + '</div>';
output.innerHTML = html;

if (editMode) {
    output.querySelector('.wb-save-btn').addEventListener('click', function() {
        _updatePlan(container);
    });
} else {
    output.querySelector('.wb-assign-btn').addEventListener('click', function() {
        _showAssignPopup(this.dataset);
    });
}
```

**1e. Add `_updatePlan(container)` — fetch full plan, merge, PUT**

```javascript
async function _updatePlan(container) {
    var planId = container.dataset.planId;
    if (!planId) { Layer8DNotification.error('No plan ID — cannot save.'); return; }

    // Step 1: Fetch the full plan to avoid partial-update data loss (C1/C2)
    var query  = 'select * from TreatmentPlan where planId=' + planId + ' limit 1';
    var getUrl = _apiPrefix() + '/50/PhyPlan?body=' + encodeURIComponent(JSON.stringify({ text: query }));
    var fullPlan;
    try {
        var gr = await fetch(getUrl, { headers: _authHeaders() });
        if (!gr.ok) throw new Error('HTTP ' + gr.status);
        var gd = await gr.json();
        fullPlan = (gd.list && gd.list[0]) || null;
    } catch(e) {
        Layer8DNotification.error('Failed to load plan before saving: ' + e.message);
        return;
    }
    if (!fullPlan) { Layer8DNotification.error('Plan not found.'); return; }

    // Step 2: Build new exercise list from last build
    var exercises = [];
    var idx = 1;
    (window.PhysioWorkoutBuilder._lastCircuits || []).forEach(function(circuit) {
        circuit.slots.forEach(function(ex) {
            if (!ex) return;
            exercises.push({
                exerciseId:   ex.exerciseId,
                sets:         ex.defaultSets    || 0,
                reps:         ex.defaultReps    || 0,
                holdSeconds:  ex.holdSeconds    || 0,   // C8: include if field exists in proto
                frequency:    ex.frequency      || 0,   // C8: include if field exists in proto
                notes:        ex.loadNotes      || '',
                orderIndex:   idx++
            });
        });
    });

    // Step 3: Merge onto full plan and PUT complete object (C1)
    fullPlan.exercises = exercises;
    var putUrl = _apiPrefix() + '/50/PhyPlan';
    try {
        var pr = await fetch(putUrl, {
            method:  'PUT',
            headers: _authHeaders(),
            body:    JSON.stringify(fullPlan)   // Full object — no field loss
        });
        if (!pr.ok) throw new Error('HTTP ' + pr.status);
        Layer8DNotification.success('Workout plan updated successfully.');
        Layer8DPopup.close();
        // Step 4: Refresh plans table via callback (C6)
        if (typeof window._wbRefreshCallback === 'function') {
            window._wbRefreshCallback();
            window._wbRefreshCallback = null;
        }
    } catch(e) {
        Layer8DNotification.error('Failed to update plan: ' + e.message);
    }
}
```

**Line count impact:** workout-builder.js grows from ~265 to ~345 lines (well under 500 ✓)

---

### Phase 2 — Create `plans-editor.js` and wire detail popup

**File:** `go/physio/ui/web/physio/plans/plans-editor.js` (new)

```javascript
(function() {
    'use strict';

    // Thin wrappers delegating to globals — established pattern from clients-exercises.js:7-17 (C3)
    function _authHeaders() { return getAuthHeaders(); }
    function _apiPrefix()   { return Layer8DConfig.getApiPrefix(); }

    // Fetch full plan by ID — ensures exercises are populated (C2)
    async function _fetchPlan(planId) {
        var query = 'select * from TreatmentPlan where planId=' + planId + ' limit 1';
        var url   = _apiPrefix() + '/50/PhyPlan?body=' + encodeURIComponent(JSON.stringify({ text: query }));
        var resp  = await fetch(url, { headers: _authHeaders() });
        if (!resp.ok) return null;
        var data  = await resp.json();
        return (data.list && data.list[0]) || null;
    }

    // Fetch protocol — limit 1 prevents over-fetch (C9)
    async function _fetchProtocol(protocolId) {
        if (!protocolId) return null;
        var query = 'select * from PhysioProtocol where protocolId=' + protocolId + ' limit 1';
        var url   = _apiPrefix() + '/50/PhyProto?body=' + encodeURIComponent(JSON.stringify({ text: query }));
        var resp  = await fetch(url, { headers: _authHeaders() });
        if (!resp.ok) return null;
        var data  = await resp.json();
        return (data.list && data.list[0]) || null;
    }

    // Build the exercise summary Layer8DTable inside the popup (C10: name enrichment)
    function _renderExercisesTable(containerId, exercises) {
        var col    = window.Layer8ColumnFactory;
        var lookup = PhysioManagement.lookups;

        // Enrich exercises with display name (C10)
        var rows = (exercises || []).map(function(ex) {
            return Object.assign({}, ex, {
                _name: (lookup && lookup.exerciseName)
                    ? (lookup.exerciseName(ex.exerciseId) || ex.exerciseId)
                    : ex.exerciseId
            });
        });

        var cols = [
            ...col.number('orderIndex', '#'),
            ...col.col('_name',      'Exercise'),
            ...col.number('sets',    'Sets'),
            ...col.number('reps',    'Reps'),
            ...col.col('notes',      'Load / Notes')
        ];

        var table = new Layer8DTable({
            containerId: containerId,
            modelName:   'PlanExercise',
            primaryKey:  'exerciseId',
            columns:     cols,
            serverSide:  false,     // C7: confirmed safe without endpoint
            showActions: false,
            pageSize:    30
        });
        table.init();
        table.setData(rows);
    }

    // Show plan detail popup with generateFormHtml + exercises table + Edit Workout button (C4, C5)
    function _showPlanDetail(plan, onRefresh) {
        // Use Layer8DForms.generateFormHtml for plan fields (C4)
        var formHtml = Layer8DForms.generateFormHtml(
            PhysioManagement.forms.TreatmentPlan, plan, { readonly: true }
        );
        var exercisesId = 'plan-detail-exercises-' + plan.planId;
        var content = [
            formHtml,
            '<div style="padding:0 20px 16px;">',
              '<div style="font-size:11px;font-weight:600;color:var(--layer8d-text-medium);',
                    'text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">',
                'Current Exercises</div>',
              '<div id="' + exercisesId + '"></div>',
              // C5: Edit Workout is a content button, not the footer onSave
              '<div style="margin-top:16px;text-align:right;">',
                '<button class="layer8d-btn layer8d-btn-primary layer8d-btn-small wb-edit-btn">',
                  '&#9998; Edit Workout',
                '</button>',
              '</div>',
            '</div>'
        ].join('');

        Layer8DPopup.show({
            title:      'Treatment Plan \u2014 ' + Layer8DUtils.escapeHtml(plan.title || plan.planId),
            content:    content,
            size:       'large',
            showFooter: false,
            onShow: function(body) {
                // Render exercises table (C10)
                _renderExercisesTable(exercisesId, plan.exercises);

                // Wire Edit Workout button (C5)
                var editBtn = body.querySelector('.wb-edit-btn');
                if (editBtn) {
                    editBtn.addEventListener('click', function() {
                        Layer8DPopup.close();
                        setTimeout(function() {
                            PhysioPlanEditor._openEditorPopup(plan, onRefresh);
                        }, 100);
                    });
                }
            }
        });
    }

    // Open the builder in edit mode inside a popup
    function _openEditorPopup(plan, onRefresh) {
        var tempId = 'plan-editor-builder-container';
        Layer8DPopup.show({
            title:      'Edit Workout \u2014 ' + Layer8DUtils.escapeHtml(plan.title || 'Treatment Plan'),
            content:    '<div id="' + tempId + '"></div>',
            size:       'xlarge',
            showFooter: false,
            noPadding:  true,
            onShow: function(body) {
                var container = body.querySelector('#' + tempId);
                if (!container || typeof PhysioWorkoutBuilder === 'undefined') return;
                PhysioWorkoutBuilder.setupInContainer(container, {
                    mode:      'edit',
                    planId:    plan.planId,
                    onRefresh: onRefresh,
                    preset: {
                        posture: plan._preset ? plan._preset.posture : 1,
                        joint:   plan._preset ? plan._preset.joint   : 1,
                        volume:  plan.volume  || 3,
                        phase:   1
                    }
                });
            }
        });
    }

    window.PhysioPlanEditor = {

        // Entry point called from physio-init.js _showDetailsModal override
        open: async function(item, onRefresh) {
            if (!item || !item.planId) return;

            // Fetch the full plan (C2 — list response may omit exercises)
            var plan = await _fetchPlan(item.planId);
            if (!plan) { Layer8DNotification.error('Could not load plan.'); return; }

            // Fetch primary protocol for preset (C9 — limit 1)
            var protocol = await _fetchProtocol(plan.protocolId);
            plan._preset = {
                posture: protocol ? protocol.posture : 1,
                joint:   protocol ? protocol.joint   : 1
            };

            _showPlanDetail(plan, onRefresh);
        },

        // Exposed for internal use only
        _openEditorPopup: _openEditorPopup
    };
})();
```

**Wire into `physio-init.js` — `_showDetailsModal` override:**

Add TreatmentPlan branch (parallel to PhysioClient and PhysioTherapist):
```javascript
} else if (service.model === 'TreatmentPlan') {
    _showTreatmentPlan(item, itemId);
} else {
```

Add `_showTreatmentPlan` function at the bottom of physio-init.js:
```javascript
function _showTreatmentPlan(item, planId) {
    var pid = planId || (item && item.planId);
    if (!pid || typeof PhysioPlanEditor === 'undefined') return;

    // onRefresh: refreshes the plans table row after a successful edit save (C6)
    // The plans table is managed by Layer8DModuleFactory; grab the table element
    // and call fetchData on the Layer8DTable instance if available.
    var onRefresh = function() {
        // Layer8DModuleFactory stores tables in namespace._state.serviceTables
        var state = window.Physio && window.Physio._state;
        var tbl   = state && state.serviceTables && state.serviceTables['management-plans-table'];
        if (tbl && typeof tbl.fetchData === 'function') {
            tbl.fetchData(1, tbl.pageSize);
        }
    };

    PhysioPlanEditor.open(item || { planId: pid }, onRefresh);
}
```

**Wire `plans-columns.js` — client name renderer (G6):**

Replace the `clientId` column with a custom renderer using lookups:
```javascript
// Replace: ...col.col('clientId', 'Client')
// With:
{
    key: 'clientId', label: 'Client',
    render: function(item) {
        var name = PhysioManagement.lookups && PhysioManagement.lookups.clientName
            ? PhysioManagement.lookups.clientName(item.clientId)
            : null;
        return Layer8DUtils.escapeHtml(name || item.clientId || '—');
    }
}
```

---

### Phase 3 — Wire `app.html`

**File:** `go/physio/ui/web/app.html`

Add one script tag after `plans-forms.js`, before `physio-lookups.js`:
```html
<script src="physio/plans/plans-forms.js"></script>
<script src="physio/plans/plans-editor.js"></script>   <!-- ADD THIS -->
<script src="physio/physio-lookups.js"></script>
```

---

### Phase 4 — End-to-End Verification

- [ ] Navigate to Physiotherapy → Plans
- [ ] Confirm plans load in `Layer8DTable`; `clientId` column shows name, not UUID (G6)
- [ ] Click a plan row → detail popup opens with `generateFormHtml` field display + exercises table
- [ ] Exercises table shows exercise names (or IDs as fallback), not raw UUIDs (C10)
- [ ] "Edit Workout" button visible inside popup content area (not footer) (C5)
- [ ] Click "Edit Workout" → detail popup closes → builder popup opens (xlarge)
- [ ] Builder pre-populated: posture/joint match the plan's protocol, volume matches `plan.volume`
- [ ] Protocol badge in builder updates when dropdowns change
- [ ] "+ Add Protocol" adds extra protocol rows correctly
- [ ] "Build Workout" fetches exercises and renders 4-circuit table with Protocol column
- [ ] "Save Changes" button appears instead of "Assign to Client"
- [ ] Click "Save Changes" → fetches full plan → merges exercises → PUT full object (C1)
- [ ] Success notification appears; builder popup closes
- [ ] Plans table auto-refreshes (row data not stale) (C6)
- [ ] Navigate to Workout Builder tab → confirm `init()` still works normally (no regression)
- [ ] Confirm `_initialized` flag does not block opening a second edit popup after first is closed
- [ ] Confirm `window._wbRefreshCallback` is cleared after use (no stale callback)

---

## Files Summary

| File | Action | Δ Lines |
|---|---|---|
| `physio/builder/workout-builder.js` | Refactor: `_setupBuilder`, `setupInContainer`, edit mode in `_build`, `_updatePlan` (fetch-full-PUT) | +80 |
| `physio/plans/plans-editor.js` | Create: `PhysioPlanEditor.open()`, `_showPlanDetail`, `_renderExercisesTable`, `_openEditorPopup` | +110 (new) |
| `physio/physio-init.js` | Add TreatmentPlan branch + `_showTreatmentPlan` function | +20 |
| `physio/plans/plans-columns.js` | Fix `clientId` renderer | +5 |
| `app.html` | Add one `<script>` tag | +1 |

No proto changes required. No new services. No new CSS files needed (builder CSS already covers the popup layout).

> **Note on `holdSeconds` / `frequency` (C8):** Before Phase 1 implementation, verify these field names against `TreatmentPlan.PlanExercise` in `go/types/physio/*.pb.go`. Include them in the exercise push if they exist; remove the stubs if they do not.
