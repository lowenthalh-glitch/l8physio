# Plan: Assign Exercises to Multiple Joints and Categories

## Problem

Currently, `PhysioExercise` has a **single** `joint` (enum) and **single** `category` (enum) field. The workout builder filters exercises with `where joint=X`, so an exercise tagged as "Shoulder" is invisible when building a "Knee" workout — even if that exercise is clinically appropriate for both joints. The same limitation applies to categories (e.g., an exercise that is both Mobility and Rehab).

## Goal

Allow an exercise to be associated with **multiple joints** and **multiple categories**, so it appears in the workout builder's filtered list for every relevant joint/category combination.

## Current Model

```protobuf
message PhysioExercise {
  ...
  PhysioExerciseCategory category  = 4;   // single enum
  PhysioJoint            joint     = 14;  // single enum
  ...
}
```

**Workout builder filter** (`workout-builder.js` line 140):
```js
var query = 'select * from PhysioExercise where joint=' + uniqueJoints[ji] + ' limit 500';
```

**Circuit assignment** (`workout-builder.js` line 161):
```js
if (ex.posture === p.posture && ex.joint === p.joint) { ... }
```

## Proposed Model Change

Replace the single enum fields with repeated enum lists:

```protobuf
message PhysioExercise {
  ...
  // DEPRECATED — replaced by joints/categories lists
  // PhysioExerciseCategory category  = 4;
  // PhysioJoint            joint     = 14;

  repeated PhysioJoint            joints      = 31;
  repeated PhysioExerciseCategory categories  = 32;
  ...
}
```

> **Why `repeated <EnumType>`?**
> This follows the Layer 8 ecosystem convention. l8alarms uses `repeated l8events.Severity` and `repeated l8events.AlarmState`; l8bugs uses `repeated WebhookEventType`. The framework handles repeated enum serialization natively.

### Backward Compatibility

- Keep old fields 4 and 14 in proto (do not remove — proto field numbers are permanent)
- Backend migration: on POST/PUT, if old `joint` is set but `joints` is empty, copy `joint` into `joints[0]`. Same for `category`/`categories`.
- Over time, old fields become unused.

## Affected Components

### 1. Proto (`proto/physio.proto`)
- Add `repeated PhysioJoint joints = 31` and `repeated PhysioExerciseCategory categories = 32` to `PhysioExercise`
- Run `cd proto && ./make-bindings.sh`

### 2. Backend — Exercise Service Callback (`go/physio/exercise/`)
- In `Before()` for POST/PUT: if `joints` is empty and `joint` is non-zero, set `joints = [joint]`. Same for `category`/`categories`.
- Validation: at least one joint and one category required.

### 3. Workout Builder Query
- The builder currently queries `where joint=X`. With multi-joint, the field becomes a repeated list.
- **L8Query supports this natively**: the `=` operator on a repeated field has "contains" semantics — it iterates the slice and returns true if ANY element matches (see `l8ql/go/gsql/interpreter/comparators/Equal.go`). So `where joints=2` will match any exercise whose `joints` list contains `2`.
- Update the query field name from `joint` to `joints`. Server-side filtering continues to work.

### 4. UI — Exercise Forms (`physio-forms-shared.js` line 42)
- Replace `...f.select('joint', 'Joint', enums.JOINT)` with `...f.multiselect('joints', 'Joints', enums.JOINT)`
- Replace `...f.select('category', 'Category', enums.EXERCISE_CATEGORY)` with `...f.multiselect('categories', 'Categories', enums.EXERCISE_CATEGORY)`
- `f.multiselect()` already exists in l8ui (`layer8-form-factory.js`) — renders a dropdown with checkboxes, stores values as JSON array in a hidden input, shows selected values as removable chips. Used in production by l8alarms for severity/state filters.
- Mobile forms (`physio-forms-mobile.js`) inherit from `PhysioSharedForms.build(enums)`, so the change propagates automatically. Mobile multiselect rendering exists in `layer8m-forms-fields-ext.js` (`renderMultiselectField()`).

### 5. l8ui — Add `renderEnumList` to `Layer8DRenderers` (`layer8d-renderers.js`)
- `renderEnum` only handles single values. Add a shared array-aware variant to avoid duplicating the pattern in every project that uses repeated enums:
```js
function renderEnumList(value, enumMap, defaultLabel) {
    if (!Array.isArray(value)) return renderEnum(value, enumMap, defaultLabel);
    return value.map(function(val) { return renderEnum(val, enumMap, defaultLabel); }).join(', ');
}
```
- Export it alongside `renderEnum` in the return object.
- This is a **cross-project change to `../l8ui`** — benefits l8alarms and any future project with repeated enums.

### 6. UI — Exercise Enums & Renderers (`exercises-enums.js` lines 58, 64)
- Use the new shared `renderEnumList` for array renderers:
```js
const { renderEnum, renderEnumList, createStatusRenderer } = Layer8DRenderers;

PhysioManagement.render.joints      = (v) => renderEnumList(v, JOINT.enum);
PhysioManagement.render.categories  = (v) => renderEnumList(v, EXERCISE_CATEGORY.enum);
```
- Keep existing single-value renderers (`render.joint`, `render.exerciseCategory`) for backward compat in other views.

### 7. UI — Exercise Columns (`exercises-columns.js` lines 11-12)
- Replace single-enum columns with array-aware columns.
- **Sorting must be disabled** (`sortKey: false`) — L8Query generates `ORDER BY joints` in SQL, but repeated fields are stored in child tables, not as columns. The SQL is silently invalid. No sibling project sorts on repeated fields.
- **Filtering**: set `filterKey` for plain text search (L8Query `=` on repeated fields has contains semantics). Do NOT set `enumValues` — no sibling project uses enum dropdown filtering on repeated fields (future enhancement).
```js
// OLD:
...col.enum('category', 'Category', null, render.exerciseCategory, enums.EXERCISE_CATEGORY),
...col.enum('joint',    'Joint',    null, render.joint,            enums.JOINT),

// NEW:
...col.custom('categories', 'Categories', function(item) { return render.categories(item.categories); }, { sortKey: false, filterKey: 'categories' }),
...col.custom('joints',     'Joints',     function(item) { return render.joints(item.joints); },         { sortKey: false, filterKey: 'joints' }),
```

### 8. UI — Workout Builder (`workout-builder.js`)
- **Fetch** (line 140): Update query field name from `joint` to `joints`:
  ```js
  var query = 'select * from PhysioExercise where joints=' + uniqueJoints[ji] + ' limit 500';
  ```
- **Client-side filter** (line 161): Change from scalar comparison to array lookup:
  ```js
  // OLD: if (ex.posture === p.posture && ex.joint === p.joint)
  // NEW:
  if (ex.posture === p.posture && ex.joints && ex.joints.indexOf(p.joint) !== -1)
  ```
- **Circuit category assignment**: Change from `ex.category === circuit.category` to `ex.categories && ex.categories.indexOf(circuit.category) !== -1`

### 9. UI — Workout Builder Assign (`workout-builder-assign.js`)
- Line 41: `_lastProtocols` uses `{ posture: ds.posture, joint: ds.joint }` — this is the **protocol's** selected joint (single value from the builder UI), NOT the exercise's joints. **No change needed.**
- Line 42: `_protocolCode(p.posture, p.joint)` — protocol-level, not exercise-level. **No change needed.**

### 10. UI — Workout Builder Circuits (`workout-builder-circuits.js`)
- Update any exercise filtering that references `ex.joint` or `ex.category` to use array lookups (`ex.joints.indexOf(...)`, `ex.categories.indexOf(...)`).

### 11. UI — Mobile Workout Builder (`m/js/physio/workout-builder-m.js`)
- Line 65: Mobile already fetches all exercises (`select * from PhysioExercise limit 500`) without a joint filter. **No query change needed.**
- Line 70: `protocols = [{ posture: posture, joint: joint }]` — builder's selected joint (single). **No change needed.**
- Line 71: `PhysioWorkoutCircuits.assembleCircuits()` — the shared circuits code (updated in Phase 3) handles array-based filtering. **No additional mobile change needed.**
- Line 159: `JOINT_CODES[joint]` for protocol code title — builder's selected joint. **No change needed.**

### 12. Mock Data (`go/tests/mocks/gen_physio_exercises.go`)
- Update exercise definition struct (line 36) from single `category` to slices:
  ```go
  categories []physio.PhysioExerciseCategory
  joints     []physio.PhysioJoint
  ```
- Update all exercise definitions (lines 46-83) to use slices. Add multi-joint entries for testing:
  - "Gluteal Bridge" → joints: `[HIP, LOWER_BACK]`, categories: `[STRENGTH, REHAB]`
  - "Core Stability" → joints: `[CORE, LOWER_BACK]`
  - "Thoracic Rotation" → joints: `[UPPER_BACK, SHOULDER]`
- Update generator function (~line 90) to set `exercise.Joints` and `exercise.Categories` instead of `exercise.Category` and `exercise.Joint`.

## Implementation Phases

### Phase 1: Proto + Backend
1. Add `repeated PhysioJoint joints = 31` and `repeated PhysioExerciseCategory categories = 32` to `PhysioExercise` in `physio.proto`
2. Run `cd proto && ./make-bindings.sh`
3. Update exercise service callback with backward-compat migration logic
4. `go build ./...` to verify

### Phase 2: l8ui — Add `renderEnumList` (cross-project: `../l8ui`)
1. Add `renderEnumList(value, enumMap, defaultLabel)` to `../l8ui/shared/layer8d-renderers.js`
2. Export it in the return object alongside `renderEnum`
3. Commit and push the change to the l8ui repository
4. Update l8physio's l8ui submodule to pick up the new commit:
   ```bash
   cd go/physio/ui/web/l8ui && git pull origin main && cd ../../../../..
   ```

### Phase 3: UI — Exercise Management (Desktop + Mobile)
1. `physio-forms-shared.js`: replace `f.select('joint', ...)` → `f.multiselect('joints', ...)` and `f.select('category', ...)` → `f.multiselect('categories', ...)`
2. `exercises-enums.js`: use `renderEnumList` for `render.joints` and `render.categories`
3. `exercises-columns.js`: replace `col.enum('joint', ...)` → `col.custom('joints', ..., { sortKey: false, filterKey: 'joints' })` and `col.enum('category', ...)` → `col.custom('categories', ..., { sortKey: false, filterKey: 'categories' })`
4. Verify mobile inherits form changes from shared file; verify `f.multiselect()` renders on mobile

### Phase 4: UI — Workout Builder (Desktop + Mobile)
1. `workout-builder.js` line 140: change query field from `joint` to `joints`
2. `workout-builder.js` line 161: change `ex.joint === p.joint` to `ex.joints && ex.joints.indexOf(p.joint) !== -1`
3. `workout-builder.js`: change `ex.category === circuit.category` to `ex.categories && ex.categories.indexOf(circuit.category) !== -1`
4. `workout-builder-circuits.js`: update any `ex.joint` / `ex.category` references to array lookups
5. `workout-builder-assign.js`: **no changes needed** (uses protocol-level single joint)
6. `workout-builder-m.js`: **no changes needed** (shared `assembleCircuits()` handles it; already fetches all exercises)

### Phase 5: Mock Data
1. Update `go/tests/mocks/gen_physio_exercises.go`: change struct to use slices, populate `Joints` and `Categories`
2. Add multi-joint exercises for testing (e.g., "Gluteal Bridge" → `[HIP, LOWER_BACK]`)
3. `go build ./...` and `go vet ./...` to verify

### Phase 6: End-to-End Verification
For each step, verify on **both desktop and mobile**:
1. Navigate to Exercises section — verify table loads with comma-separated joint/category labels
2. Click an exercise row — verify detail popup shows multi-select chips for joints and categories
3. Create a new exercise with joints=[Shoulder, Knee] — verify save succeeds
4. Edit the exercise — verify joints=[Shoulder, Knee] loads correctly in multi-select
5. Open Workout Builder, select Joint=Shoulder — verify the multi-joint exercise appears in the exercise pool
6. Open Workout Builder, select Joint=Knee — verify the same exercise also appears
7. Build a workout and assign to a client — verify plan saves correctly
8. Verify old exercises (with single joint/category via backward compat) still display and filter correctly
9. On mobile: open Workout Builder, repeat steps 5-7

## Traceability Matrix

| # | Gap | Phase |
|---|-----|-------|
| 1 | Proto: single joint/category fields | Phase 1 |
| 2 | Backend: backward-compat migration | Phase 1 |
| 3 | l8ui: no `renderEnumList` for repeated enum rendering (`../l8ui layer8d-renderers.js`) | Phase 2 |
| 4 | l8ui submodule update in l8physio after l8ui change | Phase 2 |
| 5 | UI: exercise forms `f.select` → `f.multiselect` (`physio-forms-shared.js`) | Phase 3 |
| 6 | UI: exercise renderers single-value → array-aware (`exercises-enums.js`) | Phase 3 |
| 7 | UI: exercise columns `col.enum` → `col.custom` with `sortKey: false` (`exercises-columns.js`) | Phase 3 |
| 8 | UI: mobile form inheritance verification | Phase 3 |
| 9 | UI: workout builder query `joint` → `joints` (`workout-builder.js`) | Phase 4 |
| 10 | UI: workout builder filter `ex.joint ===` → `ex.joints.indexOf` (`workout-builder.js`) | Phase 4 |
| 11 | UI: workout builder circuit category filter (`workout-builder.js`) | Phase 4 |
| 12 | UI: workout builder circuits file (`workout-builder-circuits.js`) | Phase 4 |
| 13 | UI: workout builder assign — confirmed no change needed (`workout-builder-assign.js`) | Phase 4 |
| 14 | UI: mobile workout builder — confirmed no change needed (`workout-builder-m.js`) | Phase 4 |
| 15 | Mock data: exercise generator (`gen_physio_exercises.go`) | Phase 5 |
| 16 | End-to-end verification desktop + mobile | Phase 6 |

## Resolved Questions

1. **Multi-select UI pattern**: `f.multiselect(key, label, options, required)` already exists in l8ui (`layer8-form-factory.js`). Renders dropdown with checkboxes, stores JSON array, shows removable chips. Used in production by l8alarms for severity/state multi-select filters. Mobile rendering also exists (`layer8m-forms-fields-ext.js` `renderMultiselectField()`).
2. **L8Query list-contains**: The `=` operator on repeated fields already has contains semantics (`l8ql/interpreter/comparators/Equal.go` lines 89-97). It iterates the slice and returns true if ANY element matches. So `where joints=2` matches exercises where `joints` contains `2`. Server-side filtering works as-is.
3. **Category on WorkoutCircuit**: Stays as a single enum. A circuit IS a category grouping (Mobility / Rehab / Strength / Functional). Only the exercise needs multiple categories (to appear in multiple circuit types). `WorkoutCircuit.category` is unchanged.
