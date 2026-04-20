# Security-Based UI Show/Hide Filtering

## Summary

Add permission-based UI filtering to l8physio so that users only see sections, modules, tabs, and services they have GET access to. This mirrors the existing l8erp implementation. l8physio already loads permissions from `/permissions` on startup and already includes the `layer8d-permission-filter.js` script — but never calls it. No new files are needed; this is purely wiring existing components.

**Note:** This plan covers only `Layer8DPermissionFilter` (role-based show/hide). It does NOT add `Layer8DModuleFilter` (admin module enable/disable via ModConfig service), since l8physio has no ModConfig service. That can be added separately if needed.

## Current State

| Component | Status |
|-----------|--------|
| `/permissions` endpoint called on startup | Yes (desktop `app.js:106-113`, mobile `app-core.js:34-41`) |
| `window.Layer8DPermissions` populated | Yes |
| `layer8d-permission-filter.js` loaded in `app.html` | Yes (line 249) |
| `layer8d-permission-filter.js` loaded in `m/app.html` | Yes (line 324) |
| Resolver registered | **No** |
| `applyToSidebar()` called | **No** |
| `applyToSection()` called on section load | **No** |
| Mobile sidebar filtering | **No** |
| Mobile nav card filtering | **No** |

## How the Permission Filter Works

1. On startup, the app fetches `/permissions` which returns a map of `{ "ModelName": [actionIds...] }`. Action ID `5` = GET (read access).
2. `Layer8DPermissionFilter._isActive()` checks if this map is non-empty. If empty/null, permissive mode — everything is shown.
3. `canView(modelName)` returns `true` if the model has action `5` in its permissions array.
4. A **resolver** maps UI navigation paths `(sectionKey, moduleKey, serviceKey)` to model names, so the filter can look up which model a nav item represents.
5. `applyToSidebar(moduleModels)` hides sidebar links where the user can't view ANY model in that section.
6. `applyToSection(sectionKey)` hides individual sub-nav service items and cascading-hides module tabs when all their services are hidden.

## Traceability Matrix

| # | Gap | Phase |
|---|-----|-------|
| 1 | No resolver registered — filter can't map UI paths to model names | Phase 1a |
| 2 | `applyToSidebar()` never called — desktop sidebar not filtered | Phase 1a |
| 3 | `applyToSection()` never called — desktop section tabs/services not filtered | Phase 1b |
| 4 | Mobile sidebar not filtered by permissions | Phase 2a |
| 5 | Mobile nav cards not filtered | Phase 2b (already wired in l8ui, no code needed) |
| 6 | End-to-end verification with restricted user | Phase 3 |

## Phase 1: Desktop Permission Filtering

### 1a. Register resolver and apply sidebar filter in `app.js`

**File:** `go/physio/ui/web/js/app.js`

After the existing permissions loading block (line 115), add:

```javascript
// Apply permission-based nav filtering (hide modules/services user can't GET)
if (typeof Layer8DPermissionFilter !== 'undefined') {
    const nsMap = {
        'physio': 'Physio'
    };
    Layer8DPermissionFilter.registerResolver(function(sectionKey, moduleKey, serviceKey) {
        var ns = window[nsMap[sectionKey]];
        if (!ns || !ns.modules || !ns.modules[moduleKey]) return null;
        var svc = ns.modules[moduleKey].services.find(function(s) { return s.key === serviceKey; });
        return svc ? svc.model : null;
    });

    var sidebarModels = {};
    Object.keys(nsMap).forEach(function(section) {
        var ns = window[nsMap[section]];
        if (!ns || !ns.modules) return;
        var models = [];
        Object.values(ns.modules).forEach(function(mod) {
            if (mod.services) mod.services.forEach(function(svc) { if (svc.model) models.push(svc.model); });
        });
        sidebarModels[section] = models;
    });
    Layer8DPermissionFilter.applyToSidebar(sidebarModels);
}
```

**What this does:**
- Maps `physio` sidebar section to the `window.Physio` namespace (created by `physio-config.js`)
- The resolver looks up module configs to find the model name for each service
- `applyToSidebar` hides the "Physiotherapy" sidebar link if the user has no GET access to ANY physio model
- `aia` and `system` sidebar links are never filtered (by design in the filter)

### 1b. Apply section filter on section load in `sections.js`

**File:** `go/physio/ui/web/js/sections.js`

In the `loadSection` function, after the section initializer is called (after line 63), add:

```javascript
// Apply permission filter to hide services user can't GET
if (window.Layer8DPermissionFilter) {
    Layer8DPermissionFilter.applyToSection(sectionName);
}
```

**What this does:**
- When the `physio` section loads, hides individual service sub-nav items (e.g., "Therapists", "Clients") that the user lacks GET permission for
- If ALL services in the "Management" module tab are hidden, the tab itself is hidden
- The `system` section is not filtered (its services don't go through the resolver — `nsMap` doesn't include `system`)

## Phase 2: Mobile Permission Filtering

### 2a. Apply sidebar filter in `app-core.js`

**File:** `go/physio/ui/web/m/js/app-core.js`

After the permissions loading block (line 43), add:

```javascript
// Apply permission-based sidebar filtering
if (typeof Layer8DPermissionFilter !== 'undefined' && window.Layer8DPermissions) {
    this.applyPermissionFilter();
}
```

Add the `applyPermissionFilter` method to `MobileApp`:

```javascript
applyPermissionFilter() {
    if (!window.Layer8DPermissionFilter || !Layer8DPermissionFilter._isActive()) return;
    document.querySelectorAll('.sidebar-item[data-section]').forEach(item => {
        const section = item.dataset.section;
        const module = item.dataset.module;
        if (section === 'dashboard' || module === 'system') return;
        const moduleKey = module || section;
        var mc = window.LAYER8M_NAV_CONFIG && LAYER8M_NAV_CONFIG[moduleKey];
        if (!mc || !mc.services) return;
        var hasAny = false;
        Object.values(mc.services).forEach(function(svcs) {
            svcs.forEach(function(svc) {
                if (svc.model && Layer8DPermissionFilter.canView(svc.model)) hasAny = true;
            });
        });
        if (!hasAny) item.style.display = 'none';
    });
}
```

### 2b. Mobile nav card filtering — already wired

The mobile nav system (`layer8m-nav.js` in l8ui) already calls `Layer8DPermissionFilter.canViewModule()` and `canViewSubModule()` when rendering module cards, sub-module cards, and service cards (lines 168, 218, 289, 374). No changes needed — once `window.Layer8DPermissions` is populated (already done in Phase 2a), the nav cards are automatically filtered.

## Phase 3: Verification

### Desktop verification
1. Log in as admin (full permissions) — all sidebar links and all physio services visible
2. Log in as a restricted user — verify:
   - Sidebar: "Physiotherapy" link hidden if user has no GET on any physio model
   - Section: Individual services (Therapists, Clients, etc.) hidden per model permissions
   - Tab: "Management" tab hidden if all its services are hidden
   - System/AI Agent: Always visible regardless of permissions

### Mobile verification
1. Log in as admin — all sidebar items and nav cards visible
2. Log in as restricted user — verify:
   - Sidebar: "Physiotherapy" hidden if no GET on any physio model
   - Nav cards: Only viewable services shown when drilling into physio module
   - System: Always visible

### Edge cases
- User with GET on only 1 physio model: sidebar shows physio, only that service visible
- User with no permissions at all (`Layer8DPermissions = {}`): everything hidden except system/dashboard
- Permissive mode (`Layer8DPermissions = null`): everything visible (no filtering)

## Files Modified

| File | Change |
|------|--------|
| `go/physio/ui/web/js/app.js` | Add resolver registration + `applyToSidebar()` call |
| `go/physio/ui/web/js/sections.js` | Add `applyToSection()` call after section init |
| `go/physio/ui/web/m/js/app-core.js` | Add `applyPermissionFilter()` method + call it on init |

## Files NOT Modified

- `layer8d-permission-filter.js` — already loaded and fully functional
- `app.html` / `m/app.html` — script already included
- No new files created
