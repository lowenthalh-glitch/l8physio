# Plan: Switch Workout Plan Tab to Layer8DTable

## Goal
Replace the hand-crafted HTML table in the **Workout Plan** tab of the client popup with
`Layer8DTable` instances (from `l8ui/edit_table`). Keep the existing four-circuit layout
(Mobility, Rehab, Strength, Functional — one table each), gain consistent l8ui styling and
sortable columns, and preserve the Fixed/Variable badge UX and variable-exercise swap behaviour.

---

## Current State

| Element | Implementation |
|---------|---------------|
| Data source | Client-side: `planExercises[]` merged with `exerciseMap{}` |
| Rendering | `_renderPlanTable()` builds raw HTML — one `<table>` per circuit category |
| "Change" button | Inline on variable rows via `data-plan-ex-idx` / `data-category` attrs |
| Picker | `_toggleChangePicker()` inserts a custom dropdown `<div>` after the button |
| Refresh after swap | Full re-fetch from server → `_loadPlan()` |

---

## Target State

| Element | Implementation |
|---------|---------------|
| Data source | Same client-side data, grouped by circuit category |
| Rendering | Four `Layer8DTable` instances — one per circuit, each below its circuit header |
| "Change" button | `col.custom` column renders button HTML only for variable rows |
| Picker | `_showSwapPopup()` via `Layer8DPopup.show({ size: 'small', … })` |
| Refresh after swap | Each table updated via `setData()` — no re-fetch needed |

---

## Merged Row Shape

`_buildCircuitRows(planExercises, exerciseMap)` returns a map of `category → rows[]`:

```js
// Per row:
{
    planExerciseId: pe.planExerciseId,
    exerciseId:     pe.exerciseId,
    name:           fullEx.name || pe.exerciseId || '—',
    sets:           pe.sets  || fullEx.defaultSets  || '—',
    reps:           pe.reps  || fullEx.defaultRepsDisplay || String(fullEx.defaultReps || '') || '—',
    notes:          pe.notes || '',
    exerciseType:   fullEx.exerciseType || 0,   // 1=Fixed, 2=Variable
    _category:      fullEx.category || 0,       // for swap pool filter
    _orderIndex:    pe.orderIndex || 0
}
```

Within each circuit, rows are sorted: Fixed (exerciseType=1) first, then Variable (exerciseType=2),
then by `orderIndex`.

---

## Column Definitions (shared across all four tables)

```js
var col = window.Layer8ColumnFactory;

var planColumns = [
    ...col.col('name',  'Exercise'),
    ...col.col('sets',  'Sets'),
    ...col.col('reps',  'Reps'),
    ...col.custom('exerciseType', 'Type', function(item) {
        return item.exerciseType === 1
            ? '<span class="physio-type-badge physio-type-fixed">Fixed</span>'
            : '<span class="physio-type-badge physio-type-variable">Variable</span>';
    }, { sortKey: false }),
    ...col.col('notes', 'Notes'),
    ...col.custom('_change', '', function(item) {
        if (item.exerciseType !== 2) return '';
        return '<button class="physio-change-btn layer8d-btn layer8d-btn-secondary layer8d-btn-small"'
             + ' data-id="' + item.planExerciseId + '"'
             + ' data-category="' + item._category + '">Change</button>';
    }, { sortKey: false }),
];
```

Note: no `circuit` column — each table is already scoped to one circuit.

---

## Four-Table Construction

```js
var CIRCUIT_ORDER = [1, 2, 3, 4]; // Mobility, Rehab, Strength, Functional

CIRCUIT_ORDER.forEach(function(cat) {
    var rows = circuitRowsMap[cat];
    if (!rows || rows.length === 0) return;

    var label = CATEGORY_LABELS[cat];

    // Circuit header (kept from current design)
    var header = document.createElement('div');
    header.className = 'physio-circuit-title';
    header.textContent = 'Circuit \u2014 ' + label;
    container.appendChild(header);

    // Table container
    var wrap = document.createElement('div');
    wrap.id = 'physio-circuit-table-' + cat;
    wrap.className = 'physio-circuit-table-wrap';
    container.appendChild(wrap);

    var table = new Layer8DTable({
        containerId:  'physio-circuit-table-' + cat,
        columns:      planColumns,
        primaryKey:   'planExerciseId',
        pageSize:     50,
        serverSide:   false,
        sortable:     true,
        filterable:   false,
        showActions:  false,
        emptyMessage: 'No exercises.',
        onDataLoaded: (function(w) {
            return function() {
                w.querySelectorAll('.physio-change-btn').forEach(function(btn) {
                    btn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        self._showSwapPopup(btn.dataset.id, parseInt(btn.dataset.category, 10));
                    });
                });
            };
        })(wrap)
    });
    table.init();
    table.setData(rows);

    self._circuitTables[cat] = table;
});
```

`self._circuitTables` is a map `{ 1: Layer8DTable, 2: Layer8DTable, … }`.

---

## _showSwapPopup (replaces _toggleChangePicker)

Opens a stacked `Layer8DPopup` with a scrollable list of alternative variable exercises:

```js
_showSwapPopup: function(planExerciseId, category) {
    var self = this;
    var pe = (self._currentPlan.exercises || []).find(function(e) {
        return e.planExerciseId === planExerciseId;
    });
    if (!pe) return;

    var pool = (self._allVariableExercises || []).filter(function(ex) {
        return ex.category === category && ex.exerciseId !== pe.exerciseId;
    });

    var listHtml = pool.length === 0
        ? '<p class="physio-picker-empty">No alternatives available.</p>'
        : pool.map(function(ex) {
              return '<div class="physio-picker-item" data-ex-id="' + ex.exerciseId + '">'
                   + Layer8DUtils.escapeHtml(ex.name || ex.exerciseId) + '</div>';
          }).join('');

    Layer8DPopup.show({
        title:      'Swap Exercise',
        content:    '<div class="physio-picker-list">' + listHtml + '</div>',
        size:       'small',
        showFooter: false,
        onShow: function(body) {
            body.querySelectorAll('.physio-picker-item').forEach(function(item) {
                item.addEventListener('click', function() {
                    Layer8DPopup.close();
                    var newEx = pool.find(function(ex) { return ex.exerciseId === item.dataset.exId; });
                    if (newEx) {
                        var idx = self._currentPlan.exercises.indexOf(pe);
                        self._swapExercise(idx, newEx);
                    }
                });
            });
        }
    });
},
```

---

## _swapExercise Changes

After a successful PUT, rebuild circuit rows and refresh each table via `setData()`.
Remove the server re-fetch block entirely:

```js
// After successful PUT:
Layer8DNotification.success('Exercise updated.');
var circuitRowsMap = self._buildCircuitRows(self._currentPlan.exercises, self._exerciseMap || {});
Object.keys(self._circuitTables).forEach(function(cat) {
    var rows = circuitRowsMap[parseInt(cat, 10)] || [];
    self._circuitTables[cat].setData(rows);
});
// Refresh info pane directly (no re-fetch)
var infoPane = document.getElementById('physio-info-pane');
if (infoPane && self._exerciseMap) {
    self._renderExerciseInfo(
        self._currentPlan, self._currentPlan.exercises, self._exerciseMap, infoPane
    );
}
```

---

## Traceability Matrix

| # | Gap / Action | Phase |
|---|-------------|-------|
| 1 | Add `_circuitTables: {}` property; reset in `open()` | Phase 1 |
| 2 | Add `_buildCircuitRows(planExercises, exerciseMap)` helper | Phase 1 |
| 3 | Define shared `planColumns` array (no `circuit` column) | Phase 2 |
| 4 | Replace raw HTML loop in `_renderPlanTable` with four `Layer8DTable` instances | Phase 2 |
| 5 | Keep `.physio-circuit-title` header divs above each table | Phase 2 |
| 6 | Wire `.physio-change-btn` in `onDataLoaded` closure per table | Phase 2 |
| 7 | Add `_showSwapPopup()` replacing `_toggleChangePicker()` | Phase 3 |
| 8 | Remove `_toggleChangePicker()` method | Phase 3 |
| 9 | Rewrite `_swapExercise()` success block: `setData()` per circuit table, no re-fetch | Phase 4 |
| 10 | Refresh info pane directly in `_swapExercise()` (no re-fetch) | Phase 4 |
| 11 | Add `.physio-picker-list` CSS for swap popup list | Phase 4 |
| 12 | Add `.physio-circuit-table-wrap` CSS (bottom margin between circuits) | Phase 4 |
| 13 | Remove now-unused CSS: `.physio-plan-table` and sub-selectors, `.physio-col-*`, `.physio-row-variable`, `.physio-picker-dropdown`, `.physio-picker-item`, `.physio-picker-empty` | Phase 5 |
| 14 | Keep `.physio-circuit-title`, `.physio-circuit-section` border/radius replaced by `.physio-circuit-table-wrap` | Phase 5 |

---

## Implementation Phases

### Phase 1 — Data Layer
- Add `_circuitTables: {}` property; reset to `{}` in `open()`
- Add `_buildCircuitRows(planExercises, exerciseMap)` — returns `{ 1: rows[], 2: rows[], … }`
  - Each row is the merged shape above
  - Within each category, sort: Fixed first, then Variable, then by `orderIndex`

### Phase 2 — Table Rendering
- Define `planColumns` array once (no `circuit` column)
- Replace the raw HTML loop in `_renderPlanTable` with:
  1. Plan header HTML (unchanged — title, status badge, start date)
  2. Loop over `CIRCUIT_ORDER = [1, 2, 3, 4]`:
     - Skip categories with no rows
     - Append `.physio-circuit-title` header div
     - Append `#physio-circuit-table-{cat}` wrapper div
     - Create `Layer8DTable`, `init()`, `setData(rows)`
     - Store in `self._circuitTables[cat]`
  3. Wire `.physio-change-btn` inside each table's `onDataLoaded` closure

### Phase 3 — Swap Picker
- Add `_showSwapPopup(planExerciseId, category)` method
- Remove `_toggleChangePicker()` method

### Phase 4 — Swap Refresh + CSS additions
- Rewrite `_swapExercise()` success block:
  - Remove server re-fetch
  - Call `_buildCircuitRows()` and `setData()` on each `_circuitTables[cat]`
  - Call `_renderExerciseInfo()` directly for info pane
- Add `.physio-picker-list` CSS
- Add `.physio-circuit-table-wrap` CSS (margin-bottom between circuits)

### Phase 5 — CSS Cleanup
Remove from `clients-exercises.css`:
- `.physio-plan-table` and all sub-selectors (`thead th`, `tbody tr`, `tbody td`)
- `.physio-col-num`, `.physio-col-name`, `.physio-col-sets`, `.physio-col-reps`, `.physio-col-action`
- `.physio-row-variable`
- `.physio-picker-dropdown`, `.physio-picker-item`, `.physio-picker-empty`
- `.physio-circuit-section` (replaced by `.physio-circuit-title` + `.physio-circuit-table-wrap`)

Keep:
- `.physio-circuit-title` (reused as header above each table)
- `.physio-plan-header`, `.physio-plan-title`, `.physio-plan-meta`, `.physio-plan-date`, `.physio-plan-status-*`
- `.physio-type-badge`, `.physio-type-fixed`, `.physio-type-variable`
- `.physio-change-btn`

### Phase 6 — Verification
- Open a client with an active plan → Workout Plan tab shows four labelled circuit sections, each with a `Layer8DTable`
- Circuits with no exercises are hidden (not rendered)
- Column headers are sortable within each circuit table
- Variable rows show "Change" button; fixed rows show nothing in that column
- Clicking "Change" opens the swap popup (stacked on top of the client popup)
- Selecting an exercise updates all four circuit tables in place — no flicker, no re-fetch
- Switching to "Exercise Info & Videos" tab shows updated cards after a swap
- No console errors

---

## Files Changed

| File | Change |
|------|--------|
| `physio/clients/clients-exercises.js` | Phases 1–4 |
| `physio/clients/clients-exercises.css` | Phases 4–5 |
