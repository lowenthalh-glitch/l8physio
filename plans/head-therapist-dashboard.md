# HTDash Service — Rethink (v3)

## Context

The dashboard has been through two failed approaches:
1. **ORM-backed stored entity** — panicked on zero-value enums during postgres Write
2. **AlmOverlay custom IServiceHandler + Layer8DTable** — Layer8DTable caches GET responses in the browser; the framework's `AsList()` wrapping may not work correctly with custom services; no reliable way to force table refresh after popup actions

The root problems are:
- **Layer8DTable + custom IServiceHandler** are not designed to work together. Layer8DTable expects ORM-backed services with pagination metadata. Custom services return full datasets with no metadata.
- **Browser HTTP caching** can't be reliably busted from JS — `Cache-Control` headers and `_t=` timestamps don't work consistently across browsers.
- **Popup ↔ table state** is disconnected — actions in a popup (override, plan edits) don't propagate to the table behind it.

## Approach: Custom UI View + AlmOverlay Backend

Keep the AlmOverlay backend (already implemented, computes correctly). Replace the Layer8DTable integration with a **custom dashboard view** (`htdash-view.js`) that:
1. Fetches from `/50/HTDash` (one GET to the backend service)
2. Renders its own HTML table (not Layer8DTable)
3. Owns its own state — can refresh itself after any action
4. The popup updates the view's state directly via callbacks

This is the pattern used by the Workout Builder (`physio-workout-builder.js`) — a custom view that manages its own table, not a Layer8DTable. It's also how `clients-exercises.js` works — it renders circuit tables with `table.setData()` callbacks.

## What stays (already implemented, no changes)

- **Backend:** `go/physio/htdash/HTDashService.go` (AlmOverlay, computes on GET)
- **Backend:** `go/physio/htdash/HTDashAggregation.go` (query + aggregate + sort + reason)
- **Backend:** `go/physio/ovrdlog/` (OvrdLog service for override audit trail)
- **Backend:** `go/physio/exswaplog/` (ExSwapLog service)
- **Proto:** HeadThDashRow, StatusOverrideLog, ExerciseSwapLog, status_reason, description
- **UI:** `htdash-columns.js`, `htdash-swaplog-columns.js`, `htdash-timeline.js`
- **UI:** `sections/physio.html` (dashboard sub-nav + container)
- **UI:** `physio-config.js` (service entry)
- **UI:** `therapist-sections.js` (dashboard visible)
- **UI:** `session-view.js` (Boostapp session + workout plan renderer)
- **UI:** `plan-actions.js` (shared plan editing logic)

## What changes

### Phase 0: Use existing l8ui shared components (no custom helpers)

The ecosystem already provides everything needed:

**Tab switching** — `Layer8DPopup` has built-in tab handling via `.probler-popup-tab[data-tab]` + `.probler-popup-tab-pane[data-pane]`. It also supports `onTabChange` callback. All popups (therapist detail, dashboard detail) should use this standard system instead of custom tab code.

**Status badges** — `Layer8DRenderers.renderStatus(value, enumMap, classMap)` returns HTML badges. `createStatusRenderer(enumMap, classMap)` returns a reusable function. Both `htdash-view.js` and `htdash-timeline.js` should use `PhysioManagement.render.sessionStatus(value)` which is already defined in `sessionreport-enums.js`.

**View refresh** — `Layer8DModuleNavigation` provides `refreshCurrentTable()` which calls `view.refresh()`. The dashboard view implements `init()/refresh()/destroy()` interface.

**Cache-busting** — inline `?t=timestamp` at the fetch call site (established pattern in l8erp sections.js).

**Refactor existing popups:**
- Therapist detail popup in `physio-init.js` → replace custom `physio-therapist-tab`/`data-ptab` with standard `.probler-popup-tab`/`data-tab`
- Dashboard detail popup → same
- Session view popup → same (replace `physio-session-tab`/`data-stab`)
- All status rendering → use `PhysioManagement.render.sessionStatus()` (already available)

**No new files needed for Phase 0** — just refactor existing popups to use l8ui built-in components.

### Phase 1: Rewrite `htdash-view.js` as the dashboard renderer

**File:** `go/physio/ui/web/physio/htdash/htdash-view.js` — **rewrite**

```javascript
window.PhysioHeadDashboard = {
    _container: null,
    _rows: [],

    init: function(containerId) {
        // Fetch from /50/HTDash, render custom table, store reference
    },

    refresh: function() {
        // Re-fetch from /50/HTDash, re-render table in place
    },

    _render: function() {
        // Render HTML table with status dots, reason, swap count
        // Each row clickable → opens detail popup with refresh callback
    },

    _onRowClick: function(row) {
        // Open detail popup, pass self.refresh as callback
        _showDashboardDetail(row, self.refresh.bind(self));
    }
};
```

**Key design:**
- Fetches from the backend HTDash service (one GET) — not from 5 individual services
- Renders its own HTML table — not Layer8DTable (avoids caching/pagination issues)
- `refresh()` method re-fetches and re-renders — called after popup actions
- Popup receives `onRefresh` callback — calls it after override save, plan changes, etc.

### Phase 2: Wire dashboard in `physio-init.js`

**File:** `go/physio/ui/web/physio/physio-init.js`

Keep the `serviceKey === 'htdash'` custom handler in `loadServiceView`:
```javascript
if (serviceKey === 'htdash') {
    // Show htdash service view, initialize custom dashboard
    sectionEl.querySelectorAll('.l8-service-view').forEach(...)
    PhysioHeadDashboard.init('management-htdash-table-container');
    return;
}
```

**Rewrite `_showDashboardDetail(item, onRefresh)`** to accept a refresh callback:
- After override save → call `onRefresh()` (re-fetches dashboard data, table updates)
- Timeline refresh → re-renders in place
- No popup close needed, no section reload, no nav click

### Phase 3: Remove fetch interceptor cache-busting

The `_t=` cache-buster in the fetch interceptor is no longer needed for the dashboard because the custom view controls its own fetches.

**Revert:** Remove `_t=` interceptor from `app.js`, `therapist-app.js`, `client-app.js`
**Keep:** `Cache-Control: no-cache` in `getAuthHeaders` — this is a safe default for all API requests and doesn't cause issues. Other Layer8DTable services benefit from it too.

### Phase 3b: Remove dead column definitions

`htdash-columns.js` defined columns for Layer8DTable which is no longer used for the dashboard. Remove it to avoid confusion.

**Delete:** `go/physio/ui/web/physio/htdash/htdash-columns.js`
**Update:** `app.html`, `therapist-app.html` — remove htdash-columns.js script include

The custom view in `htdash-view.js` defines its own column rendering inline. `htdash-swaplog-columns.js` stays — it's used by the swap log Layer8DTable in the detail popup.

### Phase 4: Fix change detection in `session-view.js`

The false "Plan Edit" entries are caused by type mismatch between original capture and collected values. The root cause: `defaultRepsDisplay` (string like "10-12") vs `defaultReps` (number or null).

**Fix:** When capturing originals AND when comparing, read the ACTUAL input DOM value after render (not computed from exercise defaults). This guarantees originals match what `_collectEdits` will read:

```javascript
// After rendering, read actual input values as originals
if (!st.originals) {
    st.originals = {};
    container.querySelectorAll('.session-edit-sets').forEach(function(input) {
        var idx = parseInt(input.dataset.row, 10);
        var pe = st.flatRows[idx];
        if (pe) {
            if (!st.originals[pe.exerciseId]) st.originals[pe.exerciseId] = {};
            st.originals[pe.exerciseId].sets = parseInt(input.value, 10) || 0;
        }
    });
    // Same for reps, notes
}
```

This reads from the DOM AFTER render — exactly what `_collectEdits` does. Zero type mismatches.

### Phase 5: Mobile parity

The custom dashboard view (`htdash-view.js`) uses standard HTML/CSS and `fetch()` — no desktop-specific components. It works in both desktop and mobile contexts.

For mobile: add `htdash-view.js` to `m/app.html`. The `PhysioHeadDashboard.init()` can be called from the mobile nav when the dashboard service is selected. The popup uses `Layer8DPopup` on desktop — on mobile, use `Layer8MPopup` for the detail view if needed, or let the existing mobile popup system handle it.

**File:** `go/physio/ui/web/m/app.html` — add htdash-view.js script include

### Theme compliance note

The custom HTML table in `htdash-view.js` MUST use `--layer8d-*` CSS tokens for all colors, backgrounds, and borders:
- Table background: `var(--layer8d-bg-white)`
- Row borders: `var(--layer8d-border)`
- Header background: `var(--layer8d-bg-light)`
- Text colors: `var(--layer8d-text-dark)`, `var(--layer8d-text-medium)`, `var(--layer8d-text-muted)`
- Status dots: `var(--layer8d-success)`, `var(--layer8d-warning)`, `var(--layer8d-error)`
- No hardcoded hex colors

## Verification

1. `go build ./...` passes
2. Dashboard tab → custom table renders with all active clients
3. Click row → popup opens with Overview, Timeline, Exercise Changes, Workout Plan tabs
4. Override save → notification, timeline refreshes in-place, table behind updates via callback
5. Plan edit in Workout Plan tab → save → only actual changes logged
6. Add/delete exercise → logged in timeline
7. No hard refresh needed at any point
8. No false "Plan Edit" entries
9. Mobile: dashboard loads with same data and functionality
10. Dark mode: dashboard uses theme tokens, no hardcoded colors

## Files Changed

| File | Action |
|------|--------|
| `go/physio/ui/web/physio/htdash/htdash-view.js` | **Rewrite** — custom view with refresh, uses l8ui renderStatus |
| `go/physio/ui/web/physio/htdash/htdash-columns.js` | **Delete** — dead code, Layer8DTable no longer used |
| `go/physio/ui/web/physio/htdash/htdash-timeline.js` | **Update** — use renderStatus instead of local statusDot |
| `go/physio/ui/web/physio/physio-init.js` | **Update** — wire htdash loadServiceView, rewrite popup with onRefresh callback |
| `go/physio/ui/web/physio/session-view.js` | **Fix** — read originals from DOM, not computed values |
| `go/physio/ui/web/js/app.js` | **Revert** — remove _t= interceptor and Cache-Control |
| `go/physio/ui/web/js/therapist-app.js` | **Revert** — same |
| `go/physio/ui/web/js/client-app.js` | **Revert** — same |
| `go/physio/ui/web/app.html` | **Update** — add htdash-view.js, remove htdash-columns.js |
| `go/physio/ui/web/therapist-app.html` | **Update** — same |
| `go/physio/ui/web/m/app.html` | **Update** — add htdash-view.js for mobile |

## Why this approach works

| Problem | Previous approach | This approach |
|---------|------------------|---------------|
| Browser caching | Layer8DTable implicit GET cached | Custom view explicit fetch — no caching issue |
| Popup → table refresh | nav.click / loadSection workarounds | `onRefresh` callback directly re-renders |
| False plan edits | Computed original ≠ displayed value | Read originals from DOM after render |
| AsList() double-wrap | Unknown if HTDash list wraps correctly | Custom view parses response.list directly |
| Layer8DTable pagination | Custom service returns no metadata | Custom view renders full list, no pagination needed |

## Rule Compliance

| Rule | Status |
|------|--------|
| maintainability — max 500 lines | OK |
| maintainability — no duplicate code | OK — Phase 0 refactors to use l8ui built-in tabs + renderStatus (no custom copies) |
| canonical-project-selection | OK — backend: AlmOverlay; UI: Workout Builder custom view pattern |
| report-infra-bugs | OK — ORM bug reported, AlmOverlay avoids it |
| l8ui-no-project-specific-code | OK — all in physio/ |
| l8ui-theme-compliance | OK — Phase 5 documents --layer8d-* token usage, no hardcoded colors |
| mobile-rules — parity | OK — Phase 5 adds mobile support, htdash-view.js is platform-agnostic |
| plan-traceability-and-verification | OK — verification section covers desktop + mobile + dark mode |
