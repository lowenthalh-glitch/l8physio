# Mobile Security Parity with Desktop — l8physio

## Summary

Close the client-side security gaps between desktop (`web/`) and mobile (`web/m/`) UIs. Backend authentication is already uniform — `l8common.CreateWebServer` (called from `go/physio/ui/main.go:15`) protects `/` and `/m/*` with the same middleware — so this work is about **client-side consistency, defense-in-depth, and UX parity**, not patching an authorization hole.

Work spans l8physio plus a single small upstream addition to `l8ui` (a `Layer8MAuth.fetchText(url)` verb that mirrors the existing `get/post/put/delete`). **No `l8common` changes.** Architecture-compliant: extends the encapsulated `Layer8MAuth` module pattern rather than duplicating its behavior locally, and reuses the cross-platform `_headers()` shim documented in `plans/mobile-ui-parity.md` §0b.

## Gap Inventory

| # | Area | Desktop (`web/`) | Mobile (`web/m/`) | Gap |
|---|------|------------------|--------------------|-----|
| 1 | 401 handling on raw fetches | Global `fetch` interceptor at `web/js/app.js:4–14` redirects to login on 401 | No interceptor; raw `fetch()` calls (e.g. `web/m/js/app-core.js:137`) have neither Authorization header nor 401 handler | Mobile section loads can silently fail when token expires |
| 2 | Token persistence on login | `web/js/app.js:100` unconditionally writes token to `localStorage` regardless of "remember me" | `l8ui/m/js/layer8m-auth.js:43–49` correctly gates `localStorage` write on `remember` flag | Desktop leaks token to persistent storage on shared devices |
| 3 | Session restore on refresh | `web/js/app.js:94–98` reads only `sessionStorage` | `l8ui/m/js/layer8m-auth.js:35–37` reads `sessionStorage \|\| localStorage` | Desktop and mobile drift apart over a browser-close cycle |
| 4 | Destructive-action confirmation | Framework entity tables route through `Layer8DFormsModal.confirmDelete`; bespoke `_deleteExercise` handler has no confirm | Framework entity tables route through `Layer8MConfirm.confirmDelete`; bespoke `.mpr-delete` handler has no confirm | None — both surfaces match (audit, Phase 3a) |
| 5 | Backend uniformity regression risk | `l8common.CreateWebServer` applies auth middleware to all routes | Same | No automated regression test asserts `/m/*` requires auth |

## Section Audit (Rule #17)

Per global rule #17, the entire client-side security surface was audited before scoping this plan. Seven areas were considered; four became phases above, three are explicitly out of scope with the rationale below.

### In scope (became phases)
- **Transport / 401 handling** → Phase 1
- **Token persistence on login** → Phase 2a
- **Session restore on refresh** → Phase 2b
- **Destructive-action confirmation** → Phase 3

### Considered and rejected (out of scope)
- **CSRF tokens** — Not required while auth uses `Authorization: Bearer`. CSRF only applies when the browser auto-attaches credentials (cookies). Revisit only if/when auth migrates to cookie sessions.
- **Section-HTML XSS** — Both UIs use `innerHTML` to load server-rendered section HTML. This is a shared trust assumption, **not** a desktop-vs-mobile gap. User-supplied content is already escaped via `Layer8DUtils.escapeHtml` / `Layer8MUtils.escapeHtml` on both sides. Server-side HTML sanitization is a separate concern outside this plan.
- **Authorization / role gating** — Both UIs already fetch `/permissions` and filter through `Layer8DPermissionFilter` (see `plans/security-ui-filtering-sharon.md`). Parity exists here; nothing to fix.

### Architecturally deferred (would belong upstream)
- **Introducing a `Layer8DAuth` desktop module** — Would mirror `Layer8MAuth`'s encapsulation but requires a much larger refactor across all l8ui consumers (l8erp, l8inventory, l8finplan, etc.). Right scope is l8ui, not l8physio. Deferred to a separate cross-project plan.
- **Token refresh / silent re-auth** — Verified no such mechanism exists in `l8ui` today (no `refreshToken`, no `/refresh` endpoint, no expiry-aware retry in `layer8m-auth.js` or the desktop equivalent), so the binary "401 → logout" model used by this plan is correct as-is. Introducing refresh tokens would be a cross-ecosystem change (backend session lifecycle, l8secure, every l8ui consumer) well outside this plan.

### Upstream (in this plan)
- **Add `Layer8MAuth.fetchText(url)` to `l8ui/m/js/layer8m-auth.js`** — needed by Phase 1b for non-JSON authed loads. Mirrors the existing `get/post/put/delete` verbs. Added upstream now rather than inlined in `app-core.js`, because an inlined helper would be a second instance of the auth-attach + 401-handle logic already encapsulated in those verbs — a Prevention Rule 1 (Second Instance) violation.

## Traceability Matrix

| # | Gap | Phase |
|---|-----|-------|
| 1 | Raw `fetch()` on mobile bypasses `Layer8MAuth` | Phase 1 |
| 2 | Desktop unconditionally persists token to `localStorage` | Phase 2a |
| 3 | Desktop ignores `localStorage` on restore | Phase 2b |
| 4 | Mobile destructive ops may skip confirmation | Phase 3 |
| 5 | No regression test for backend auth on `/m/*` | Phase 4 |

## Architecture Notes

The Layer 8 mobile-UI pattern is **encapsulated explicit verbs**: every network call goes through `Layer8MAuth.get/post/put/delete`. There is no global `fetch` interceptor by design, because interception adds hidden coupling and can't be reasoned about cross-project. The cross-platform shim used by shared helpers like `physio/plan-actions.js` is:

```js
function _headers() {
    if (typeof getAuthHeaders === 'function') return getAuthHeaders();
    var token = (typeof Layer8MAuth !== 'undefined') ? Layer8MAuth.getBearerToken()
              : sessionStorage.getItem('bearerToken');
    return { 'Authorization': token ? 'Bearer ' + token : '', 'Content-Type': 'application/json' };
}
```

(See `plans/mobile-ui-parity.md` §0b for the canonical form.)

This plan **does not** add an interceptor on mobile. Instead it converts the few remaining raw `fetch()` call sites to `Layer8MAuth.*`.

---

## Phase 1: Eliminate raw `fetch()` on mobile

**Goal:** Every network call on mobile carries the bearer token and triggers `Layer8MAuth._handleSessionExpired()` on 401, matching desktop's UX guarantee.

### 1a. Inventory

```bash
grep -rn "fetch(" go/physio/ui/web/m/js/ go/physio/ui/web/m/sections/ | \
    grep -v "Layer8MAuth\."
```

Known hits to start with:
- `go/physio/ui/web/m/js/app-core.js:137` — section HTML load
- `go/physio/ui/web/m/js/app-core.js:174` — secondary section fetch

Re-run the grep after each conversion to catch anything missed.

### 1b. Convert each call site

For each raw `fetch(url, opts)`, replace with the matching `Layer8MAuth` verb:

| Original | Replacement |
|---|---|
| `fetch(url)` | `Layer8MAuth.get(url)` |
| `fetch(url, {method:'POST', body: JSON.stringify(x)})` | `Layer8MAuth.post(url, x)` |
| `fetch(url, {method:'PUT', body: JSON.stringify(x)})` | `Layer8MAuth.put(url, x)` |
| `fetch(url, {method:'PATCH', body: JSON.stringify(x)})` | `Layer8MAuth.patch(url, x)` |
| `fetch(url, {method:'DELETE'})` | `Layer8MAuth.delete(url)` |

For non-JSON loads (e.g. `fetch(sectionUrl + '?t=' + Date.now())` returning HTML at `app-core.js:137`), add a new verb to `Layer8MAuth` upstream and call it. **Do not** inline an equivalent helper in `app-core.js` — that would be a second instance of the same auth-attach + 401-handle logic already encapsulated in `Layer8MAuth.get/post/put/delete`, violating Prevention Rule 1.

**Upstream addition** — `l8ui/m/js/layer8m-auth.js`:

```js
// Mirror of get(), returning text instead of parsed JSON.
fetchText: async function(url) {
    const resp = await fetch(url, { headers: this.getAuthHeaders() });
    if (resp.status === 401) { this._handleSessionExpired(); return null; }
    return resp.text();
},
```

**Call site** — `app-core.js`:

```js
const html = await Layer8MAuth.fetchText(sectionUrl + '?t=' + Date.now());
```

### 1c. Verify

- Browser DevTools → Network: every mobile request has `Authorization: Bearer ...`.
- Manually delete the token from storage (`sessionStorage.clear(); localStorage.clear()`) and navigate to a section → redirect to login (no silent blank screen).
- `grep -rn "fetch(" go/physio/ui/web/m/js/ go/physio/ui/web/m/sections/ | grep -v "Layer8MAuth\."` returns zero hits.
- **File line count check:** `wc -l go/physio/ui/web/m/js/app-core.js` and any other touched file is under 450 (global rule #2). If approaching 450, split before continuing.

**Files changed:**
- `go/physio/ui/web/m/js/app-core.js`
- Any other `web/m/js/**/*.js` surfaced by 1a (expected: 0–3 files)

### 1d. Cross-project audit (file follow-ups, do not fix here)

Once `Layer8MAuth.fetchText` is merged upstream in l8ui, the same raw-`fetch()` + manual `Bearer` header pattern exists in other consumers and should be cleaned up by their owners. **Known instance**: `~/proj/src/github.com/saichler/l8erp/go/erp/ui/web/m/js/app-core.js:65–94` (three call sites — section load, exchange rate, permissions — all bypass `Layer8MAuth` and have no 401 handling).

After Phase 1 merges, run:

```bash
grep -rn "fetch(" ~/proj/src/github.com/saichler/*/go/**/web/m/ 2>/dev/null | grep -v "Layer8MAuth\."
```

For each non-l8physio hit, file a follow-up ticket in that project. Do **not** modify other projects from this plan — scope creep.

---

## Phase 2: Align token persistence on desktop with `Layer8MAuth`

**Goal:** Desktop respects "remember me" the same way mobile does.

### 2a. Stop unconditional `localStorage` write

**File:** `go/physio/ui/web/js/app.js:100`

Read the surrounding block first to confirm the "remember me" checkbox name and the conditional that should gate the write. Then change:

```js
// before
localStorage.setItem('bearerToken', bearerToken);

// after — gated on the same flag mobile uses
if (rememberMe) localStorage.setItem('bearerToken', bearerToken);
else            localStorage.removeItem('bearerToken');
```

The `removeItem` ensures we don't keep a stale token from a prior remember-me login.

### 2b. Adopt mobile's restore policy on desktop

**File:** `go/physio/ui/web/js/app.js` — the `getAuthHeaders()` at `:17` and the auth-check block at `:94–98` both need to read from `sessionStorage` *or* `localStorage`. To avoid two copies of the same compound expression, extract a single local helper:

```js
function _getStoredToken() {
    return sessionStorage.getItem('bearerToken') || localStorage.getItem('bearerToken');
}
```

Then replace `sessionStorage.getItem('bearerToken')` with `_getStoredToken()` at both call sites.

This mirrors `l8ui/m/js/layer8m-auth.js:35–37` semantically. Combined with 2a, the new behavior is:

- Login without "remember me" → only `sessionStorage` → tab close logs you out.
- Login with "remember me" → also `localStorage` → tab close survives, fresh window restores.

### 2c. Verify

- Log in **without** remember-me → `localStorage.bearerToken` is absent; close tab; reopen → redirected to login.
- Log in **with** remember-me → both storages set; close tab; reopen → session restored.
- Behavior matches mobile in both cases (test mobile side-by-side).
- **File line count check:** `wc -l go/physio/ui/web/js/app.js` under 450.

**Files changed:**
- `go/physio/ui/web/js/app.js`

---

## Phase 3: Action-guard parity in mobile destructive ops

**Goal:** Mobile delete/save operations route through the same confirmation + shared mutator code as desktop, using the documented cross-platform pattern.

**Status: audit complete — zero parity gaps. No code changes required.**

### 3a. Inventory — actual result

`physio/ui/web/physio/plan-actions.js` already carries the §0b guards (`_headers()` at lines 9–14, `Layer8DNotification ?? Layer8MUtils` notification fallback at lines 16–21), so the prereq this phase depended on is satisfied.

`grep -rnE "Layer8MAuth\.(post|put|patch|delete)\(|method:\s*['\"](DELETE|PUT|POST)" go/physio/ui/web/m/js/physio/` produced 11 mutation call sites after the Phase 1 conversion. Categorized:

| Kind | Sites | Confirmation? |
|---|---|---|
| Form-submit POST/PUT in popup with explicit "Save" button (workout-builder, clients-popup-tabs session-report + home-feedback, htdash override save, physio-user-provisioning create) | 7 | Implicit — user clicked Save |
| Audit-log POST that piggy-backs on a local-state mutation (`plan-renderer-m.js` swap-log on delete/move/add) | 3 | N/A — the log is fire-and-forget; the user-initiated action is the local state change |
| Bespoke destructive handler (no framework wrapper) — `plan-renderer-m.js` `.mpr-delete` (remove exercise from plan) | 1 | **None** |

**Destructive sites lacking confirmation that have a desktop equivalent with confirmation: 0.**

The lone bespoke handler (`plan-renderer-m.js:212–225`) maps 1:1 to desktop's `physio/clients/clients-exercises.js:_deleteExercise` (`:394–400`), which also has no confirm. Both surfaces handle "remove exercise from plan" the same way: tap → local-state remove → save. **Parity is the current behavior.**

For framework-managed entity tables (Therapists, Clients, Exercises, Plans rows) the confirmation paths already exist on both sides:

- Desktop: `Layer8DTable.onDelete` → `Layer8DModuleCrud._confirmDeleteItem` → `Layer8DFormsModal.confirmDelete` (`l8ui/shared/layer8d-forms-modal.js:216`) → "Are you sure…" popup.
- Mobile: `Layer8MEditTable.onDelete` → `Layer8MNavData.onDelete` → `Layer8MNavCrud.deleteServiceRecord` (`l8ui/m/js/layer8m-nav-crud.js:155`) → `Layer8MConfirm.confirmDelete(name)` (`l8ui/m/js/layer8m-confirm.js:83`).

Both call out to `Layer8DPopup.show` / `Layer8MPopup.show` with `showFooter: true` + Delete/Cancel buttons. The framework wiring is already symmetric.

### 3b. Decision

Per the rule (≤3 inline / ≥4 extract), **0 sites → no helper extraction, no inline wrappers**. The `PhysioPlanActions.confirmAndDo` shim sketched in earlier revisions of this plan would have been a solution in search of a problem: there are no call sites that need it.

### 3c. Residual out-of-scope finding

Both bespoke "remove exercise from plan" handlers (desktop `_deleteExercise`, mobile `.mpr-delete`) lack confirmation. That is a UX gap on **both** surfaces, not a parity gap, so it falls outside this plan. If desired, a follow-up plan can add confirmation to both via the framework helpers (`Layer8DFormsModal.confirmDelete` / `Layer8MConfirm.confirmDelete`); doing so would be a one-line wrap at each call site. Tracked here only for visibility — **do not** add it under this plan's scope.

**Files changed: none.**

---

## Phase 4: Backend regression test

**Goal:** Lock in the property the entire analysis depends on — `/m/*` requires authentication.

### 4a. Add Go test

**File:** new test under `go/tests/` (pick the directory matching existing HTTP integration tests).

```go
func TestMobileRoutesRequireAuth(t *testing.T) {
    // start the web server via the same entry point as production
    // (physio/ui main.RegisterPhysioTypes + l8common.CreateWebServer)
    srv := startTestServer(t)
    defer srv.Close()

    cases := []string{
        "/m/app.html",
        "/m/client-app.html",
        "/m/therapist-app.html",
        // representative API path under mobile load:
        "/permissions",
    }
    for _, path := range cases {
        t.Run(path, func(t *testing.T) {
            resp, err := http.Get(srv.URL + path)
            if err != nil { t.Fatal(err) }
            defer resp.Body.Close()
            // static HTML may be served unauthenticated; API endpoints must 401
            if strings.HasPrefix(path, "/m/") && resp.StatusCode == http.StatusOK {
                // OK for static HTML shell; the API calls inside will 401
                return
            }
            if resp.StatusCode != http.StatusUnauthorized {
                t.Fatalf("expected 401 for %s without token, got %d", path, resp.StatusCode)
            }
        })
    }
}
```

Adjust the `cases` and the "static vs API" split based on what `l8common.CreateWebServer` actually exposes. The intent: at least one API path must 401, locking in the middleware guarantee.

### 4b. Verify

- `go test ./...` passes locally.
- Manually flip the middleware off in a scratch branch → test fails → confirms the assertion is real.

**Files changed:**
- One new test file under `go/tests/`

---

## Sequencing & Risk

- **Phase 1** is safe to land alone — adds a safety net (header attachment + 401 handling) where there was none. No happy-path behavior change.
- **Phase 2** is a **user-visible behavior change** for desktop: users who log in without remember-me will be logged out on tab close. Worth a one-liner in release notes. Match this to the same release that ships Phase 1.
- **Phase 3** depends on the 3a inventory; estimate the size of the change list before committing.
- **Phase 4** is independent — land any time. Cheap insurance.

**Suggested first PR:** Phase 1 only. Smallest change, biggest leverage, lowest blast radius. Add Phase 4's test in the same PR so the new mobile fetch routing is covered by an auth-required assertion at the backend.

## Rule Compliance

| Rule | Status | Notes |
|------|--------|-------|
| L8 architecture — encapsulated `Layer8MAuth`, no interceptor | OK | Phase 1 explicitly rejects the interceptor approach and uses `Layer8MAuth.*` verbs |
| L8 architecture — upstream changes belong in `l8ui` | OK | The one new behavior (`fetchText`) is added to `l8ui/m/js/layer8m-auth.js` rather than inlined in l8physio |
| `plans/mobile-ui-parity.md` §0b cross-platform pattern | OK | Phase 3 reuses the `_headers()` + `Layer8DNotification ?? Layer8MUtils` shim, including in the new optional `confirmAndDo` helper |
| `plans/migrate-to-l8common.md` direction | OK | Phase 4 test exercises the `l8common.CreateWebServer` middleware path, the migration target |
| plan-traceability-and-verification | OK | Traceability matrix maps all 5 gaps to phases; each phase has a Verify step |
| Prevention Rule 1 — Second Instance | OK | `Layer8MAuth.fetchText` added upstream rather than as a local copy of the auth-attach+401 logic; `confirmAndDo` extraction gated on a measured count in 3a |
| Prevention Rule 3 — Configuration vs. Logic Separation | OK | Behavioral logic (`fetchText`, `confirmAndDo`) lives in shared components, not project files |
| maintainability — no duplicate code | OK | Phase 2b extracts a single `_getStoredToken()`; Phase 3 routes mobile through shared `plan-actions.js`; Phase 1 avoids inlining a duplicate of `Layer8MAuth` verbs |
| report-infra-bugs | N/A | No workarounds planned |
| l8ui component documentation | Action | `l8ui/README.md:47` already links to `rules/layer8m-auth.md`, but that file (and the entire `rules/` directory) does not exist on disk — Phase 1 **creates** `l8ui/rules/layer8m-auth.md` documenting `get/post/put/delete` plus the new `fetchText` verb so the README link resolves and the encapsulation contract is discoverable |

## Files Changed Summary

| File | Action | Phase |
|------|--------|-------|
| `l8ui/m/js/layer8m-auth.js` | **Upstream update** — add `fetchText(url)` verb mirroring `get/post/put/delete` | 1 |
| `l8ui/rules/layer8m-auth.md` | **Upstream create** — file is referenced by `l8ui/README.md:47` but missing on disk; document `get/post/put/delete/fetchText` and the no-interceptor contract | 1 |
| `go/physio/ui/web/m/js/app-core.js` | Update — replace raw `fetch()` calls with `Layer8MAuth.*` verbs (including new `fetchText`) | 1 |
| Other `web/m/js/**/*.js` surfaced by 1a grep | Update — same conversion | 1 |
| `go/physio/ui/web/js/app.js` | Update — gate `localStorage` write on remember-me; extract `_getStoredToken()` helper; read from both storages | 2 |
| _Phase 3 files_ | _None — audit found zero parity gaps (see Phase 3a)_ | 3 |
| `go/tests/<...>/auth_routes_test.go` | New — assert `/m/*` API endpoints require auth | 4 |

## Files NOT Modified

- `l8ui/login/*` — login flow itself is unchanged
- `l8common/**` — backend middleware unchanged; only adding a test against it
- `go/physio/ui/main.go` — auth wiring unchanged
