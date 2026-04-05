# Session Report Statistics Tab

## Objective
Add a "Statistics" tab to the client popup that shows session report analytics: status distribution (Green/Yellow/Red), pain trends over time, adjustment frequency, and clients needing attention. Uses the existing Layer8DWidget (KPI cards) and Layer8DChart (bar/line/pie) components from the l8ui shared library.

---

## Design

### Where the Statistics Live
A new tab **"Statistics"** in the client popup (alongside Workout Plan, Exercise Info, Session Reports, Details). This shows per-client analytics derived from their session reports.

### Statistics to Display

**KPI Cards (Layer8DWidget):**
1. **Total Sessions** — count of all session reports for this client
2. **Current Status** — latest session's Green/Yellow/Red status with color badge
3. **Avg Pain (Before)** — average pain-before score across all sessions
4. **Avg Pain (After)** — average pain-after score across all sessions
5. **Adjustments Made** — count of sessions where `adjustmentMade = true`
6. **Follow-ups Pending** — count of sessions where `followupRequired = true`

**Charts:**
1. **Pain Trend** — line chart showing painBefore/painDuring/painAfter over time (by session date)
2. **Status Distribution** — pie chart showing Green/Yellow/Red counts

### Data Source
All data comes from a single L8Query: `select * from SessionReport where clientId={id}` fetched via the existing endpoint `/50/SessRpt`. Statistics are computed client-side from the response — no new backend service needed.

---

## Traceability Matrix

| # | Item | Phase |
|---|------|-------|
| 1 | Create `clients-session-stats.js` with KPI + chart rendering | Phase 1 |
| 2 | Add "Statistics" tab to client popup in `clients-exercises.js` | Phase 1 |
| 3 | Add script tag to `app.html` | Phase 1 |
| 4 | JS syntax check, file size check | Phase 2 |
| 5 | End-to-end verification | Phase 2 |

---

## Duplication Audit

**Existing KPI/stats rendering in l8physio:** None. The project has no dashboard or statistics page. This is the first instance of KPI cards and inline charts.

**Shared components reused (not reimplemented):**
- `Layer8DWidget.render()` / `renderEnhancedStatsGrid()` — shared l8ui KPI card component (used in l8erp, l8bugs, probler)
- `Layer8DChart.readThemeColor()` / `getThemePalette()` — shared l8ui theme color API
- Inline SVG for pie chart — lightweight, custom to this tab; no shared pie-only component exists, so this is not duplication

**Tab initialization pattern:** Matches existing tabs in the client popup (`clients-exercises.js` already lazily inits Workout Plan, Exercise Info, Session Reports, Details). The stats tab follows the same pattern — no new behavioral code for tab management.

**Conclusion:** No duplicate behavioral code. Single instance of stats rendering. All heavy lifting delegated to shared l8ui components.

---

## Phase 1 — Implementation

### 1.1 Create `go/physio/ui/web/physio/clients/clients-session-stats.js`

New file that provides `PhysioClientSessionStats.init(container, client)`:

1. Fetches all session reports for the client via GET to `/50/SessRpt` with `baseWhereClause: clientId={id}`
2. Computes statistics client-side:
   - Total count
   - Latest status
   - Average pain scores
   - Adjustment count
   - Follow-up count
   - Pain values over time (for line chart)
   - Status distribution (for pie chart)
3. Renders KPI cards using `Layer8DWidget.render(kpiConfig, numericValue, options)` — 3-argument API (per l8bugs `l8dashboard.js` pattern)
4. Renders charts using `Layer8DChart` without `dataSource` — instantiate, `init()`, then `setData(array, length)` with pre-computed data (per probler `network-device-modal-perf.js` pattern)

**Layer8DWidget.render() API** (3 arguments, per l8bugs pattern):
```javascript
// Each card rendered via:
Layer8DWidget.render(
    { label: 'Total Sessions', iconSvg: ICONS.sessions || '' },
    total,      // numeric value
    {}          // options: { trend, trendValue, sparklineData, sparklineColor }
);
```

**Layer8DChart client-side data** (no dataSource, per probler pattern):
```javascript
var chart = new Layer8DChart({
    containerId: 'pain-trend-chart',
    columns: [],
    viewConfig: { chartType: 'line', categoryField: 'label', valueField: 'value' }
});
chart.init();
chart.setData(painData, painData.length);
```

**KPI computation from fetched reports:**
```javascript
var reports = data.list || [];
var total = reports.length;
var latest = reports.sort((a,b) => b.sessionDate - a.sessionDate)[0];
var avgPainBefore = reports.reduce((s,r) => s + (r.painBefore||0), 0) / (total || 1);
var avgPainAfter  = reports.reduce((s,r) => s + (r.painAfter||0),  0) / (total || 1);
var adjustments   = reports.filter(r => r.adjustmentMade).length;
var followups     = reports.filter(r => r.followupRequired).length;
var greenCount    = reports.filter(r => r.status === 1).length;
var yellowCount   = reports.filter(r => r.status === 2).length;
var redCount      = reports.filter(r => r.status === 3).length;
```

**Pain trend line chart:**
- X axis: session dates (sorted chronologically), formatted as `Layer8DUtils.formatDate()`
- Y axis: pain scale 0-10
- Pre-computed data array: `[{ label: '04/04/2026', value: 5 }, ...]` for each pain metric
- Uses `Layer8DChart` with `chartType: 'line'`, `categoryField: 'label'`, `valueField: 'value'`
- Instantiated without `dataSource`; data set via `chart.setData(painData, painData.length)`

**Status distribution pie:**
- Pre-computed data: `[{ label: 'Green', value: greenCount }, { label: 'Yellow', value: yellowCount }, { label: 'Red', value: redCount }]`
- Uses `Layer8DChart` with `chartType: 'pie'`
- Same pattern: no `dataSource`, client-side `setData()`

**Theme color compliance (l8ui-theme-compliance rule):**
All chart colors MUST use theme tokens — never hardcode hex values:
```javascript
var green  = Layer8DChart.readThemeColor('--layer8d-success', '#22c55e');
var yellow = Layer8DChart.readThemeColor('--layer8d-warning', '#f59e0b');
var red    = Layer8DChart.readThemeColor('--layer8d-error',   '#ef4444');
var lineColors = Layer8DChart.getThemePalette();  // for pain trend lines
```

### 1.2 Add "Statistics" tab to client popup

In `clients-exercises.js`, add a tab button and pane:

```javascript
'<button class="physio-client-tab" data-tab="stats">Statistics</button>'
```

```javascript
'<div class="physio-client-tab-pane" id="physio-stats-pane">',
  '<div id="physio-stats-content"></div>',
'</div>'
```

Wire in the **tab-change handler** (NOT in `onShow` — charts need visible container dimensions):

The client popup already has a tab-change event handler in `onShow` that toggles `.active` on tabs/panes. Extend it to lazily init the stats on first activation:

```javascript
// Inside the existing tab-click handler:
if (btn.dataset.tab === 'stats' && !self._statsInitialized) {
    self._statsInitialized = true;
    if (window.PhysioClientSessionStats) {
        PhysioClientSessionStats.init(
            body.querySelector('#physio-stats-content'), client
        );
    }
}
```

This ensures charts render AFTER the Statistics pane is visible (has real dimensions), per the `platform-conversion-data-flow.md` deferred initialization rule.

### 1.3 Add script tag to `app.html`

After `clients-session-reports.js`:
```html
<script src="physio/clients/clients-session-stats.js"></script>
```

---

## Phase 2 — Verification

- [ ] JS syntax check passes for all modified/new files
- [ ] All files under 500 lines
- [ ] Start system with `run-local.sh`
- [ ] Create a few session reports for a client (mix of Green/Yellow/Red statuses, varying pain levels)
- [ ] Open client popup → Statistics tab:
  - [ ] KPI cards show correct counts (total, adjustments, follow-ups)
  - [ ] Current status shows the latest session's status with correct color
  - [ ] Average pain scores are computed correctly
  - [ ] Pain trend chart shows pain values over time
  - [ ] Status pie chart shows Green/Yellow/Red distribution
- [ ] Open a client with zero session reports → Statistics tab shows "No session reports yet"

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `go/physio/ui/web/physio/clients/clients-session-stats.js` | **Create** — KPI cards + charts |
| `go/physio/ui/web/physio/clients/clients-exercises.js` | **Modify** — add Statistics tab + pane + init |
| `go/physio/ui/web/app.html` | **Modify** — add script tag |

## What This Does NOT Change
- No backend changes — statistics are computed client-side from existing SessionReport data
- No new proto types
- No new services
- No changes to `physio-config.js` or `physio.html`

## Known Risks

| Risk | Mitigation |
|------|-----------|
| Large number of reports causes slow client-side computation | Use `limit 200` in the query; for clients with 200+ sessions, show most recent data |
| `clients-exercises.js` approaching 500 lines | Stats init is a one-liner; the heavy logic is in the separate `clients-session-stats.js` file |
| Charts render into hidden tab (zero dimensions) | Init the stats on first tab activation, not on popup open, to ensure container has dimensions |
| No session reports exist | Show a friendly "No session reports yet" message instead of empty cards/charts |
