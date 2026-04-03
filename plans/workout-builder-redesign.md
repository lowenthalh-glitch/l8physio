# Workout Builder Redesign

## Goal

Replace the current workout builder with a per-client builder that supports:
1. Multiple protocols, each contributing N circuits (total = protocols × circuits_per_protocol)
2. Inline per-row edit / add / delete
3. Fixed exercises always before Variable in each circuit; moving across types is blocked
4. "Workout Builder" button directly in the client popup's Workout Plan tab

---

## What Exists Today

| What | Where |
|------|-------|
| 4 fixed circuits (Mobility/Rehab/Strength/Functional by category) | `workout-builder.js` `CIRCUITS` array |
| "+ Add Protocol" support | `workout-builder.js` `_addExtraRow` |
| Move ↑↓ with Fixed-before-Variable constraint | `workout-builder.js` `_moveExercise` |
| Read-only rows (no inline edit/delete) | `workout-builder.js` `_renderCircuit` |
| Assign-to-client save | `workout-builder-assign.js` |
| Update existing plan save | `workout-builder-assign.js` |
| Client popup — "Workout Plan" tab | `clients-exercises.js` |

---

## Design Decisions (Confirmed)

### Circuit Pool — Option A (same pool per protocol)
All circuits that belong to the same protocol start from the same exercise pool. Circuits 1, 2, and 3 under Protocol A all get `fixed.slice(0,2) + variable.slice(0,volume-2)`. The user differentiates them manually using inline edit/add/delete after building. This keeps `_assembleCircuits` simple and lets the therapist customise each circuit freely.

### Volume selector — kept
The Volume control (3 / 4 / 5 per circuit) is **retained** alongside the new "Circuits per protocol" selector. Both appear in the controls bar. This avoids breaking `_assembleCircuits` and the assign-popup summary which both reference `volume`.

---

## New Behaviour

### Circuit Model
- **Remove** the fixed 4-category CIRCUITS array
- **Keep** Volume selector (3 / 4 / 5 exercises per circuit)
- **Add** "Circuits per protocol" selector: 2 | 3 | 4 | 5
- Total circuits = `num_protocols × circuits_per_protocol`
- Example: 2 protocols × 3 circuits each = **6 circuits**
- Each circuit shows exercises filtered to its protocol (posture + joint), same pool per protocol
- Within a circuit: Fixed rows first, Variable rows below — no cross-type moves

### Per-Row Actions
Every exercise row gets three action buttons:
- **↑ / ↓** move (existing, with fixed-before-variable enforcement)
- **✏️ Edit** — replaces the row with an inline form: exercise picker, sets, reps, notes; Save/Cancel
- **🗑️ Delete** — removes the row from the circuit

Bottom of each circuit:
- **+ Add Fixed** — appends a new blank Fixed row in edit mode
- **+ Add Variable** — appends a new blank Variable row

### Save
Flatten all circuits in order → sequential `orderIndex`. Store edited sets/reps/notes per row (not defaults). In **new** mode → show assign form. In **edit** mode → PUT existing plan.

### Client Popup — Workout Builder Button
Add a **"🔨 Workout Builder"** button at the top of the Workout Plan tab (always visible, regardless of whether a plan exists). Clicking it:
1. Saves the current pane HTML
2. Replaces the pane with the builder UI
3. Renders a **"← Back"** button in the builder that restores the saved pane HTML (onCancel pattern from `Layer8DWizard`)

Opens the builder in:
- **edit** mode if an active plan exists for the client
- **new** mode if no active plan

---

## Files to Change

| File | Change |
|------|--------|
| `workout-builder.js` (406 lines) | Remove CIRCUITS, add circuitsPerProtocol select, delegate circuit logic to `workout-builder-circuits.js` |
| `workout-builder-circuits.js` (new) | `_assembleCircuits` + circuit rendering + `_moveExercise` + inline edit/add/delete |
| `workout-builder-assign.js` (199 lines) | Update save to use per-row `slot.sets/reps/notes` |
| `workout-builder.css` (369 lines) | Add styles for inline edit row, add-row buttons, toolbar, circuits-per-proto control |
| `clients-exercises.js` (475 lines) | Add "Workout Builder" toolbar button + Back/restore logic. **Monitor line count — if adding these exceeds 500 lines, extract to `clients-wb-launcher.js`** |
| `app.html` (source) | Add `<script src="physio/builder/workout-builder-circuits.js">` after `workout-builder.js` — **done in Phase 1** |

### Note on utility duplication
`_authHeaders()`, `_apiPrefix()`, `POSTURE_CODES`, `JOINT_CODES`, `_protocolCode()` are intentionally kept local inside each physio IIFE file. This matches the existing pattern across `plans-editor.js`, `workout-builder.js`, and `workout-builder-assign.js`. No `PhysioUtils` global is introduced.

---

## Phase 1 — Circuit Model Redesign + app.html wire-up

**app.html update is done in this phase** (not Phase 5), because `workout-builder.js` will call `_assembleCircuits` which lives in the new file. The new `<script>` tag must be present before any "Build Workout" click.

### `workout-builder.js` keeps:
- `_authHeaders`, `_apiPrefix`, `_protocolCode`, `_enumLabel`, `_enumOptions`
- `_renderPanel` — add "Circuits per protocol" select (2/3/4/5), keep Volume select, remove CIRCUITS
- `_addExtraRow` — unchanged
- `_setupBuilder` — reads `circuitsPerProtocol` from new select
- `_build` — reads `circuitsPerProtocol`, calls `PhysioWorkoutCircuits._assembleCircuits(...)`, then `PhysioWorkoutCircuits.renderAll(output, circuits)`
- Public API: `window.PhysioWorkoutBuilder`

### `workout-builder-circuits.js` (new, ~250 lines):

```
window.PhysioWorkoutCircuits = {

  _assembleCircuits(allExercises, protocols, circuitsPerProtocol, phase, volume)
    → returns array of { num, label, protocolCode, slots: [{ exerciseId, exerciseType, name, sets, reps, notes, exercise }] }

    For each (protocolIndex p in 0..protocols.length-1):
      exercises = allExercises filtered to protocols[p].posture + protocols[p].joint + phase
      fixed    = exercises where exerciseType===1
      variable = exercises where exerciseType===2
      For each (circuitNum c in 1..circuitsPerProtocol):
        globalNum = p * circuitsPerProtocol + c
        slots = fixed.slice(0, 2).map(toSlot) ++ variable.slice(0, volume-2).map(toSlot)
        // All circuits for same protocol share the same pool.
        // User customises each circuit via inline edit/add/delete after building.

    toSlot(ex) = {
      exerciseId:   ex.exerciseId,
      exerciseType: ex.exerciseType,
      name:         ex.name,
      sets:         ex.defaultSets || 0,
      reps:         ex.defaultReps || 0,
      notes:        ex.loadNotes  || '',
      exercise:     ex            // kept for inline edit picker fallback
    }

  renderAll(output, circuits)
    → writes all circuit divs into output, attaches event delegation once

  _renderCircuit(circuit, circuitIndex)
    → returns HTML for one circuit div including:
      - header: "Circuit N — POSTURE-JOINT"
      - table rows with ↑↓ ✏️ 🗑️ buttons
      - "+ Add Fixed" and "+ Add Variable" buttons at bottom

  _renderRow(slot, rowIndex, circuitIndex)
    → returns <tr> HTML for one exercise slot

  _renderEditRow(slot, rowIndex, circuitIndex, allExercises)
    → returns <tr> HTML in inline-edit mode (exercise select, sets input, reps input, notes input, Save/Cancel)

  _moveExercise(output, circuitIdx, slotIdx, dir)
    → enforces Fixed-before-Variable constraint; re-renders circuit in place
    (moved here from workout-builder.js)

  Event delegation on output div:
    - wb-move-up / wb-move-down → _moveExercise(circuitIdx, rowIdx, dir)
    - wb-edit-btn   → replace row with edit form
    - wb-edit-save  → read form values, update slot.{sets,reps,notes,exerciseId,name}, re-render row
    - wb-edit-cancel → re-render row (discard)
    - wb-delete-btn → remove slot, re-render circuit
    - wb-add-fixed / wb-add-variable → append blank slot of type, enter edit mode
}

PhysioWorkoutBuilder._lastCircuits stores circuit state (mutable for moves/edits/adds/deletes)
PhysioWorkoutCircuits._allExercises stores fetched exercise list for inline-edit picker
```

---

## Phase 2 — Save Logic Update (`workout-builder-assign.js`)

In `_saveAssignment` and `_updatePlan`, slots now carry top-level `sets`/`reps`/`notes`/`exerciseId` (set by `_assembleCircuits` and updated by inline edit). Use them directly:

```javascript
// For each circuit, for each slot (non-null):
exercises.push({
    exerciseId:  slot.exerciseId,
    sets:        slot.sets  !== undefined ? slot.sets  : 0,
    reps:        slot.reps  !== undefined ? slot.reps  : 0,
    holdSeconds: 0,
    frequency:   0,
    notes:       slot.notes || '',
    orderIndex:  idx++
});
```

For `_updatePlan`, the `existingIds` lookup remains unchanged (keyed on `slot.exerciseId`).

---

## Phase 3 — Client Popup Button (`clients-exercises.js`)

In `_showClientPopup`, add a toolbar at the **top** of the exercises pane before async loading begins:

```html
<div class="physio-wb-toolbar">
  <button class="layer8d-btn layer8d-btn-secondary layer8d-btn-small" id="physio-wb-open-btn">
    🔨 Workout Builder
  </button>
</div>
<div id="physio-exercises-pane-content">
  <div class="physio-exercises-loading">Loading…</div>
</div>
```

Button click handler (wired after popup renders, before plan fetch completes):

```javascript
var wbBtn = exercisesPane.querySelector('#physio-wb-open-btn');
var contentPane = exercisesPane.querySelector('#physio-exercises-pane-content');
if (wbBtn && contentPane) {
    wbBtn.addEventListener('click', function() {
        var savedHtml = contentPane.innerHTML;
        contentPane.innerHTML = '<div id="physio-wb-container"></div>';
        var wbContainer = contentPane.querySelector('#physio-wb-container');
        PhysioWorkoutBuilder.setupInContainer(wbContainer, {
            mode:      self._currentPlan ? 'edit' : 'new',
            planId:    self._currentPlan ? self._currentPlan.planId : null,
            clientId:  client.clientId,
            onRefresh: function() { self._loadPlan(client, exercisesPane, infoPane); },
            onCancel:  function() { contentPane.innerHTML = savedHtml; }
        });
    });
}
```

`_setupBuilder` in `workout-builder.js` renders a **"← Back"** button when `opts.onCancel` is provided:

```javascript
if (opts.onCancel) {
    var backBtn = document.createElement('button');
    backBtn.className = 'layer8d-btn layer8d-btn-secondary layer8d-btn-small wb-back-btn';
    backBtn.innerHTML = '\u2190 Back';
    backBtn.addEventListener('click', opts.onCancel);
    container.querySelector('.wb-panel').prepend(backBtn);
    window.PhysioWorkoutBuilder._onCancel = opts.onCancel;
}
```

**Line count guard:** If `clients-exercises.js` exceeds 500 lines after these additions, extract the Workout Builder launch logic into `clients-wb-launcher.js` and load it after `clients-exercises.js` in `app.html`.

---

## Phase 4 — CSS (`workout-builder.css`)

Add styles:
- `.physio-wb-toolbar` — toolbar row above the exercises pane content (padding, flex layout)
- `.wb-circuits-per-proto` — new label + select in controls bar
- `.wb-back-btn` — back button at top of builder panel
- `.wb-edit-row` — inline edit row background (highlighted)
- `.wb-edit-input` — small inputs in edit row (sets, reps, notes, exercise select)
- `.wb-action-btn` — small icon buttons (✏️, 🗑️) — 24px square
- `.wb-add-row-bar` — "+ Add Fixed / + Add Variable" row at circuit bottom

**Line count guard:** `workout-builder.css` is currently 369 lines. If additions push it past 500, split new styles into `workout-builder-circuits.css` and add a `<link>` in `app.html`.

---

## Traceability Matrix

| # | Requirement / Gap | Phase |
|---|-------------------|-------|
| 1 | "Workout Builder" button in client popup Workout Plan tab | Phase 3 |
| 2 | Multiple protocols | Retained (existing) |
| 3 | Circuits per protocol selector (total = protocols × N) | Phase 1 |
| 4 | 3 circuits/protocol × 2 protocols = 6 total | Phase 1 `_assembleCircuits` |
| 5 | Fixed always before Variable, no cross-type moves | Phase 1 (`_moveExercise` moves to circuits file) |
| 6 | Move ↑↓ per row | Phase 1 (retained, moved to circuits file) |
| 7 | Inline edit per row (exercise, sets, reps, notes) | Phase 1 (`workout-builder-circuits.js`) |
| 8 | Add row (Fixed or Variable) | Phase 1 (`workout-builder-circuits.js`) |
| 9 | Delete row | Phase 1 (`workout-builder-circuits.js`) |
| 10 | Save uses per-row sets/reps/notes | Phase 2 |
| 11 | Client popup button opens builder in edit/new mode | Phase 3 |
| 12 | CSS for new UI elements incl. toolbar + back btn | Phase 4 |
| 13 | app.html includes new file | Phase 1 (not deferred to end) |
| G1 | Same exercise pool per protocol — user customises via inline edit | Phase 1 design decision |
| G2 | Volume selector retained | Phase 1 (no change needed) |
| G3 | Script load order: circuits file included before first use | Phase 1 |
| G4 | Cancel/Back button restores pane via onCancel | Phase 3 + `_setupBuilder` |
| G5 | Utility duplication (_authHeaders etc.) accepted as local IIFE pattern | N/A — documented |
| G6 | `.physio-wb-toolbar` CSS | Phase 4 |
| G7 | `_moveExercise` explicitly moved to circuits file | Phase 1 |
| G8 | `clients-exercises.js` line count guard | Phase 3 |
| G9 | `slot.exerciseId` set explicitly by `_assembleCircuits` via `toSlot()` | Phase 1 |

---

## Verification

After implementation:
1. Open client popup → Workout Plan tab → see "🔨 Workout Builder" button above the plan view
2. Click button → builder replaces pane content; "← Back" button visible
3. Click "← Back" → original plan view restored (no popup closed)
4. In builder: select 2 protocols + 3 circuits/protocol + volume 4 → click Build → 6 circuits render
5. Each circuit has same pool (Fixed × 2, Variable × 2); user can differentiate via inline edit
6. Click ↑/↓ — moves work; trying to move Variable above Fixed shows warning
7. Click ✏️ on a row — inline form appears; edit exercise/sets/reps/notes; Save updates row
8. Click 🗑️ — row removed
9. Click + Add Fixed / + Add Variable — new row appears in edit mode
10. Click Assign / Update Plan — plan saved with per-row sets/reps/notes values
11. After save, client popup Workout Plan tab refreshes and shows updated plan
