# l8physio: Layer 8 compliance + full E2E (Playwright vs KIND) — handoff

Point Claude at this file to continue. Task source: `prompt` at the repo root (follow the Layer 8 guidelines in
`../../saichler/l8book/ai/layer-8-guide-lines.md`, close all gaps, build a full Playwright suite against a KIND
cluster, then loop: run all tests -> RCA failures -> fix -> patch the cluster -> re-run, until a clean run).

Nothing is committed. All changes are in the working tree.

## 1. Environment state (when paused)
- Go 1.27.3 is installed (`/home/saichler/go/bin/go`). `saichler/builder`, `phy-security`, `phy-postgres` base images exist locally.
- Local images built (no push): `saichler/physio`, `physio-vnet`, `physio-web`, `physio-log-vnet`, `physio-log-agent`, `physio-boostapp`.
  The Dockerfiles run `go mod tidy` with GOPROXY=direct, so **Go source comes from GitHub (origin/main) at build time**; local Go edits
  are not in the images until pushed. Web assets (`COPY web`) ARE taken from the working tree.
- KIND cluster `l8physio-e2e` (1 control-plane tainted + 1 worker) is running in Docker; it survives an ssh close.
  Web server is TLS (self-signed) at **https://localhost:8088** (host 8088 -> NodePort 30080 -> pod port 2774).
  Host port 8080 is occupied by the user's `llama-server`; do not kill it.
- Recreate if needed: `k8s/kind-stop.sh && k8s/kind-start.sh`.
- Default admin login: `admin` / `admin` (login endpoint `/physio-auth`, body `{user, pass}`).
- The throwaway mock backend I used for offline selector checks lived only in the session scratchpad and is gone; not needed now.

## 2. How to run
```
cd e2e
BASE_URL=https://localhost:8088 npx playwright test --project=api      # tests/api
BASE_URL=https://localhost:8088 npx playwright test --project=desktop  # tests/desktop
BASE_URL=https://localhost:8088 npx playwright test --project=mobile   # tests/mobile (Pixel 7 UA -> /m/app.html)
BASE_URL=https://localhost:8088 npx playwright test --project=kind     # tests/kind (kubectl based, destructive restarts)
```
Fix loop: rebuild image (`cd go/physio/<svc> && docker build --platform=linux/amd64 -t saichler/<img>:latest .`) ->
`e2e/scripts/kind-e2e.sh patch <app>` (kind load + delete pod + wait Ready) -> re-run. Make targets are in `e2e/Makefile`.
Failure right after a restart can be cluster settling: re-run once; a consistent repro in isolation is a real bug.
Playwright is pinned loosely (`^1.50`); the installed chromium build is under `~/.cache/ms-playwright` (ran `npx playwright install chromium`).

## 3. What was done
### Compliance / infra
- `go/k8s` moved to **`k8s/`** at the project root (K8sRules). Fixed `k8s/kind-cluster.yaml` (control-plane tainted + worker with the
  port mapping; previously a tainted single node = nothing schedulable), removed the duplicate root `kind-config.yaml`.
- `k8s/physio-kind.yaml`: `imagePullPolicy: IfNotPresent` (so `kind load` patching works); **web: `hostNetwork: true`, containerPort/targetPort 2774**
  (was 30080; the web port comes from `l8secure/go/secure/plugin/phy/phy.json` `webPort: 2774`; without hostNetwork the web pod dials its own pod IP for the vnet).
- `k8s/kind-start.sh` host port 8088 (was 8080).
- FailFastNoSilentFallback: `/permissions` fetch failures now throw (3 desktop shells `js/app.js`, `client-app.js`, `therapist-app.js`, and mobile `m/js/app-core.js`);
  removed `typeof` guards around required globals; added **`js/physio-deps-check.js`** (desktop) and **`m/js/physio-deps-check-m.js`** (mobile), loaded right before app init
  (checks run at DOMContentLoaded and use bare-identifier typeof so `class` globals like `Layer8DTable` are seen).
- Default provisioned-user password changed `12345678` -> `Physio#Pt7x2Q` in `physio/physio-user-provisioning.js`, `m/js/physio/physio-user-provisioning-m.js`,
  `go/physio/boostapp/main/main.go` (`defaultClientPassword`), `go/tests/mocks/physio_phases.go`. Server policy: >=10 chars, uppercase, special char, no 3 repeated/sequential chars.
  (The Go changes only take effect in images after they are pushed to GitHub.)

### E2E suite (`e2e/`, ~220 tests; old fabricated tests were deleted)
- Layout per PostImplementationE2ETesting: `fixtures/` (env, api client, seeder with cleanup, auth fixtures, users, services catalog, kube helpers, error trackers),
  `pages/` (login, shell, table, popup, mobile), `tests/api|desktop|mobile|kind`.
- API: auth, unauthenticated denial, table-driven CRUD for every service, validation (callbacks), auxiliary services, role scoping (client/therapist), disabled accounts, system services Events/Notify/IntegCfg.
- Desktop: login/logout/401, navigation + no script errors for every sub-nav service, shared table behaviour (filter/sort/pagination/export), table-driven UI CRUD
  (view/edit/delete/cancel/create/required) for therapists, exercises, protocols, appointments, progress, reports, feedback; clients (provisioning, detail view),
  therapists, plans (+reference picker), appointments, boostapp, dashboard, workout builder, AI agent, System section, role portals, static pages, reference-id regression.
- Mobile: login/redirect/logout, navigation to every service, live data cards, System/AI Agent.
- KIND: pods Ready/no crash loops, images, volumes, PVC bound, NodePort, hostNetwork, no panics, data survives physio pod restart, web recovery.

## 4. Results on the real cluster (last runs)
- **api: 56/57**. Failing: `required system services Events (76) and Notify (78) are active` — l8notify is not active (real compliance gap, see 5.1).
- **desktop: 109 passed / 8 failed** before the last round of test edits; the edits (not yet re-run) address most of them:
  | Failure | Cause / status |
  |---|---|
  | login: root redirect URL, login.json apiPrefix | test expectations wrong (server serves `/l8ui/login/`, prefix normalised to `/physio/`) — fixed in tests, re-run |
  | crud-ui edit: Appointments, Progress Logs, Session Reports; plans title edit | upstream l8ui bug (5.2). Edit tests now seed letter-leading client ids; a dedicated `reference-id-regression.spec.ts` (test.fail) covers the bug |
  | boostapp: clicking a row | session view needs linked clients/plans (`physio-init.js` `_showSessionView`, `session-view.js`); test expects popup or warning toast but neither appeared — **needs RCA** |
  | System > Security > Users: add via UI | form posted but user not created; check screenshot in `e2e/test-results/system-System-section-Secu-*`, likely required fields/password policy (test uses `Passw0rd!x`; policy forbids nothing obvious — verify error toast) — **needs RCA** |
- **mobile and kind projects: not run yet** against the cluster.

## 5. Open items / findings
1. **l8notify not active** (SystemServicesRequired). Pinned `l8common` (`v0.0.0-20260620150610-ecbfc11d3827`) predates `go/system.Activate`, and `l8notify` is not in `go.mod`.
   `go/physio/main/main.go` calls `evtservices.ActivateEvents` directly, which the guideline forbids (l8common activates events+notify+integration config).
   Fix = bump l8common (+ add l8notify), then call `system.Activate(...)` instead of `ActivateEvents`. The guidelines forbid the agent running `go mod tidy/vendor`: the **user** must do the bump/re-vendor and push.
2. **Upstream l8ui bug** (do not edit the submodule `go/physio/ui/web/l8ui`): `shared/layer8d-forms-data.js` (case `'reference'`) uses `parseInt(refId, 10)`;
   a UUID like `741a...` becomes `741`, the PUT/POST then fails with `invalid value for string field clientId`. ~10/16 ids hit it. Needs an l8ui fix + submodule bump.
3. **Generic Add/Edit forms for Plans, Appointments, Progress Logs have no `userId` field**, but the server callbacks require it (`UserId is required`).
   The UI only sets it from the workout builder / plan-protocol code (`sessionStorage.currentUser`). Decide: set it in the callback on POST/PUT, or add a hidden field in the forms.
   Progress logs also require `planId`.
4. `BoostappCalendarEvent.startTime/endTime` are strings (calendar table filters by `YYYY-MM-DD` prefix); numeric epoch is rejected by the proto.
5. Several simultaneous 401s stack several "Session Error" popups (cosmetic).
6. Other things noticed, not changed: `compliance-fixes.md` Phase 0 notes; `go/vendor` is not tracked (OK); `physio_phases.go` mentions l8secure only in a comment (OK);
   `main` package size/other guideline items were spot-checked only (files >500 lines: `physio/ui/web/physio/clients/clients-exercises.js` 685 lines — split candidate).
7. Test hygiene to keep: created data is deleted in fixtures' cleanup; no exact count assertions; debug specs must be named `zzz-*` and deleted (`make zzz-check`).
8. Boostapp tests and the System add-user test are the least verified; mobile selectors (`.nav-card`, `.mobile-table-cards`, popups) are written from reading l8ui and unverified.

## 6. Suggested next steps (in order)
1. Verify the cluster is up (`kubectl --context kind-l8physio-e2e -n physio get pods`; `curl -sk https://localhost:8088/login.json`); recreate if not.
2. Re-run `--project=desktop`, triage per the table in section 4, fix tests/app, patch, re-run until clean (except items needing the user: 5.1, 5.2).
3. Run `--project=mobile`, then `--project=kind`; RCA and fix.
4. Decide 5.3 (userId) and implement; add/adjust tests.
5. Ask the user to do 5.1 (go.mod bump + push) and 5.2 (l8ui fix); then rebuild images, patch/recreate the cluster and do a final full clean run of all four projects.
6. Update `e2e/README.md` (currently deleted; not rewritten) and offer to commit.
