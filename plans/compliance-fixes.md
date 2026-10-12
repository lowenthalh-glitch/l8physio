# L8Physio Global Rules Compliance Fix Plan

## Context

An audit of l8physio against global rules found 7 issues (4 critical, 2 moderate, 1 low) plus 1 additional critical issue discovered during investigation. One originally flagged issue (missing security config) was a false positive — the config exists in `../l8secure/go/secure/plugin/phy/`. The remaining 8 items are addressed below.

---

## Phase 0: Build Project-Specific Base Images (User Action)

**Rule**: `deployment-artifacts.md` — each project MUST have its own base images.

The existing Dockerfiles reference `saichler/erp-security:latest` and `saichler/erp-postgres:latest`. The l8secure project already has a `phy` plugin directory, so the images can be built:

```bash
cd ../l8secure/security && ./build.sh phy      # produces saichler/phy-security:latest
cd ../l8secure/postgres && ./build.sh phy       # produces saichler/phy-postgres:latest
```

This is a prerequisite for Phases 2-4. The user handles this step.

---

## Phase 1: Remove l8secure Import from Boostapp - **COMPLETE**

**Rule**: `never-import-l8secure.md` — no project may import any package from l8secure.

**File**: `go/physio/boostapp/main/main.go`

The only l8secure usage is in two functions (~lines 317-365):
- `provisionClientUser()` — constructs `secure.L8User` with `secure.L8Password` and `secure.AccountStatus_ACCOUNT_STATUS_ACTIVE`
- `ensureUsersForClients()` — retrieves `secure.L8User` entities from vnet

**Changes**:
1. Remove import `"github.com/saichler/l8secure/go/types/secure"` (line 13)
2. In `provisionClientUser()`: replace `&secure.L8User{...}` with `map[string]interface{}` using the pattern from `never-import-l8secure.md`:
   ```go
   userData := map[string]interface{}{
       "userId":        client.ClientId,
       "fullName":      strings.TrimSpace(client.FirstName + " " + client.LastName),
       "email":         client.Email,
       "accountStatus": "ACCOUNT_STATUS_ACTIVE",
       "portal":        "client/app.html",
       "password":      map[string]interface{}{"hash": defaultPassword},
       "roles":         map[string]bool{"client": true},
   }
   ```
3. In `ensureUsersForClients()`: replace `secure.L8User` type assertions with `map[string]interface{}` and access fields via string keys

**Verification**: `grep -rn "l8secure" go/ --include="*.go" | grep -v vendor/` must return zero results.

**User action after this phase**: Re-vendor to remove the l8secure dependency from `go.mod` and `vendor/`:
```bash
cd go && rm -rf go.sum go.mod vendor && go mod init && GOPROXY=direct GOPRIVATE=github.com go mod tidy && go mod vendor
```

---

## Phase 2: Fix Base Images in Existing Dockerfiles - **COMPLETE**

**Rule**: `deployment-artifacts.md` — never use another project's base images.

**Files** (3 Dockerfiles):
- `go/physio/main/Dockerfile` — change `saichler/erp-postgres:latest` to `saichler/phy-postgres:latest`
- `go/physio/vnet/Dockerfile` — change `saichler/erp-security:latest` to `saichler/phy-security:latest`
- `go/physio/ui/Dockerfile` — change `saichler/erp-security:latest` to `saichler/phy-security:latest`

Each is a single-line change in the `FROM ... AS final` stage.

---

## Phase 3: Add Log Services - **COMPLETE**

**Rule**: `log-services-required.md` — every project MUST include log-vnet and log-agent.

**Canonical reference**: `../probler/go/prob/log-vnet/` and `../probler/go/prob/log-agent/`

### 3a: Create `go/physio/log-vnet/`

Copy from probler and adapt:
- **main.go**: Change binary name, set `logsDbDirectory="/data/logsdb/physio"`
- **Dockerfile**: Multi-stage, `saichler/builder:latest` build stage, `saichler/phy-security:latest` final stage. Binary name: `physio-log-vnet`
- **build.sh**: Build and push `saichler/physio-log-vnet:latest`

### 3b: Create `go/physio/log-agent/`

Copy from probler and adapt:
- **main.go**: Change binary name, set default `LOGPATH=/data/logs/physio`
- **Dockerfile**: Multi-stage, `saichler/builder:latest` build stage, `saichler/phy-security:latest` final stage. Binary name: `physio-log-agent`
- **build.sh**: Build and push `saichler/physio-log-agent:latest`

### 3c: Update `go/build-all-images.sh`

Add log-vnet and log-agent builds before other services (log-vnet first, then log-agent).

**Duplication assessment**: Each log service directory has 3 files (main.go ~30 lines, Dockerfile ~12 lines, build.sh ~5 lines = ~47 lines per service). The two services differ in binary name, image name, and runtime config — these are configuration differences, not duplicated behavioral logic. Total new code: ~94 lines. Under the 100-line threshold; no shared abstraction needed.

---

## Phase 4: Add Boostapp Deployment Artifacts - **COMPLETE**

**Rule**: `deployment-artifacts.md` — every deployable binary needs build.sh and Dockerfile.

Boostapp has three `main/` packages (`main/`, `collector/`, `parser/`). Each needs deployment artifacts.

### 4a: `go/physio/boostapp/main/`

- **build.sh**: Build and push `saichler/physio-boostapp:latest`
- **Dockerfile**: Multi-stage, `saichler/builder:latest` build, `saichler/phy-security:latest` final. Copy `main.go` + supporting `.go` files from parent boostapp package.

### 4b: `go/physio/boostapp/collector/`

- **build.sh**: Build and push `saichler/physio-boostapp-collector:latest`
- **Dockerfile**: Same pattern as 4a

### 4c: `go/physio/boostapp/parser/`

- **build.sh**: Build and push `saichler/physio-boostapp-parser:latest`
- **Dockerfile**: Same pattern as 4a

### 4d: Update `go/build-all-images.sh`

Add boostapp builds after log services.

**Duplication assessment**: Each boostapp service gets a Dockerfile (~12 lines) + build.sh (~5 lines) = ~17 lines per service, ~51 lines total for 3 services. The DockerFILES differ only in COPY paths and binary names — configuration, not behavioral logic. Under the 100-line threshold; no shared abstraction needed.

---

## Phase 5: Create Four-Mode K8s YAMLs + KIND Scripts

**Rule**: `k8s-three-deployment-modes.md` — four YAML files required (local, baremetal, gke, kind) plus KIND scripts.

**Canonical reference**: `../probler/k8s/`

### Current state
Three single-mode YAMLs exist: `physio.yaml`, `physio-vnet.yaml`, `physio-web.yaml`. All use DaemonSet + hostPath (local mode). These will be consolidated into the four-mode files.

### Services to include in all four YAMLs
| Service | Image | Kind (local) | hostNetwork |
|---------|-------|-------------|-------------|
| physio-vnet | saichler/physio-vnet | DaemonSet | true |
| physio | saichler/physio | StatefulSet | false |
| physio-web | saichler/physio-web | DaemonSet | true |
| physio-log-vnet | saichler/physio-log-vnet | DaemonSet | true |
| physio-log-agent | saichler/physio-log-agent | DaemonSet | false |
| physio-boostapp | saichler/physio-boostapp | StatefulSet | false |

### 5a: Create `go/k8s/physio-local.yaml`
- Consolidate all services into one file
- All volumes use `hostPath` with `type: DirectoryOrCreate`
- DaemonSets for vnet, web, log-vnet, log-agent; StatefulSets for physio, boostapp
- Single `physio` namespace
- All entries include NODE_IP env, labels, `hdata` volume name

### 5b: Create `go/k8s/physio-baremetal.yaml`
- Add StorageClass `physio-local-storage` with `rancher.io/local-path`
- Convert DaemonSets (no hostNetwork) to StatefulSets with podAntiAffinity
- All StatefulSets use `volumeClaimTemplates`

### 5c: Create `go/k8s/physio-gke.yaml`
- Add StorageClass `physio-storage` with `kubernetes.io/gce-pd`
- Add shared PVC `physio-data` (50Gi)
- Keep DaemonSets as DaemonSets (GKE handles scheduling)
- All services reference shared PVC

### 5d: Create `go/k8s/physio-kind.yaml`
- Same as baremetal but remove custom StorageClass definition
- Replace `storageClassName: physio-local-storage` with `storageClassName: standard`

### 5e: Create `go/k8s/kind-start.sh` and `go/k8s/kind-stop.sh`
- Copy from probler and adapt cluster name and image list

### 5f: Update `go/k8s/deploy.sh` and `go/k8s/undeploy.sh`
- Reference new YAML file names
- Add log services and boostapp in correct dependency order

### 5g: Remove old files
- Remove `physio.yaml`, `physio-vnet.yaml`, `physio-web.yaml` (replaced by four-mode files)

---

## Phase 6: Refactor session-view.js (546 lines -> ~2 files under 500)

**Rule**: `maintainability.md` — files must stay under 500 lines.

**File**: `go/physio/ui/web/physio/session-view.js`

Split into two files:

### 6a: `session-view.js` (~300 lines) — keep:
- API utilities (`_apiPrefix`, `_headers`, `_fetch`)
- `PhysioSessionPlanRenderer` (public entry point)
- `_showSessionView`, `_loadClientsAndPlans`, `_renderSessionPopup`
- `_renderClientPlan`, `_getState`, `_valueCellInner`
- `_collectEdits`, `_rerender`, `_logPlanChanges`

### 6b: `session-view-rendering.js` (~250 lines) — extract:
- `_renderPlanCircuits` (~150 lines) — the main circuit table rendering
- `_handleContainerClick` (~130 lines) — the event handler switch statement
- `_handleContainerChange` — load type change handler

Both files share the `PhysioSessionView` namespace via IIFE on `window`.

Update `app.html` to include `session-view-rendering.js` before `session-view.js`.

**Mobile parity note**: The mobile equivalent (`m/js/physio/session-view-m.js`) is a separate file that exports `MobilePhysioSessionView`. It is NOT affected by this refactor — no mobile changes needed. The mobile file also has a companion `m/js/physio/plan-renderer-m.js`.

---

## Phase 7: Fix CSS Hardcoded Colors

**Rule**: `layer8ui-theming.md` — no hardcoded hex colors; use Layer 8 theme tokens.

**Files affected** (2 CSS files):
- `go/physio/ui/web/css/components-misc.css` (2 occurrences)
- `go/physio/ui/web/css/components-modals.css` (3 occurrences)

### 7a: Fix `components-misc.css`

**Lines 35-36** (`.network-hero` background gradient):
```css
/* BEFORE */
background: linear-gradient(135deg, #0369a1 0%, #0e7490 100%);

/* AFTER */
background: linear-gradient(135deg, var(--layer8d-primary) 0%, var(--layer8d-on-primary) 100%);
```

**Line 236** (`.tree-boolean`):
```css
/* BEFORE */
.tree-boolean {
    color: #9c27b0;
}

/* AFTER */
.tree-boolean {
    color: var(--layer8d-error);
}
```

### 7b: Fix `components-modals.css`

**Lines 108-112** (`.modal-status-badge.status-online`):
```css
/* BEFORE */
.modal-status-badge.status-online {
    background: rgba(22, 163, 74, 0.1);
    color: #15803d;
    border: 1px solid rgba(22, 163, 74, 0.2);
    box-shadow: none;
}

/* AFTER */
.modal-status-badge.status-online {
    background: rgba(22, 163, 74, 0.1);
    color: var(--layer8d-success);
    border: 1px solid rgba(22, 163, 74, 0.2);
    box-shadow: none;
}
```

**Lines 115-119** (`.modal-status-badge.status-warning`):
```css
/* BEFORE */
.modal-status-badge.status-warning {
    background: rgba(217, 119, 6, 0.1);
    color: #b45309;
    border: 1px solid rgba(217, 119, 6, 0.2);
    box-shadow: none;
}

/* AFTER */
.modal-status-badge.status-warning {
    background: rgba(217, 119, 6, 0.1);
    color: var(--layer8d-warning);
    border: 1px solid rgba(217, 119, 6, 0.2);
    box-shadow: none;
}
```

**Lines 122-125** (`.modal-status-badge.status-offline`):
```css
/* BEFORE */
.modal-status-badge.status-offline {
    background: rgba(100, 116, 139, 0.1);
    color: #64748b;
    border: 1px solid rgba(100, 116, 139, 0.2);
}

/* AFTER */
.modal-status-badge.status-offline {
    background: rgba(100, 116, 139, 0.1);
    color: var(--layer8d-text-muted);
    border: 1px solid rgba(100, 116, 139, 0.2);
}
```

### 7c: Verify no other hardcoded hex in project CSS

```bash
grep -rE "#[0-9a-fA-F]{3,6}" go/physio/ui/web/css/ --include="*.css" | grep -v "var(" | grep -v "\.git"
```

Should return only `#` characters in comments or `var()` functions.

---

## Phase 8: End-to-End Verification - **COMPLETE**

### 8a: Automated Test Suite (New: `go/tests/e2e/`)

**Phase 8 plan file**: `plans/end-to-end-testing.md`

#### 8a.1: Service Layer Tests (`go/tests/e2e/services/`)
- `client_test.go` — CRUD + query for PhysioClient
- `therapist_test.go` — CRUD + query for PhysioTherapist
- `exercise_test.go` — CRUD + category/equipment filters
- `plan_test.go` — CRUD + exercise management
- `appointment_test.go` — CRUD + date range query
- `progress_test.go` — CRUD + client/exercise filters

#### 8a.2: Security Tests (`go/tests/e2e/security/`)
- `auth_test.go` — login, logout, token validation
- `authorization_test.go` — role-based access control
- `session_test.go` — session timeout, remember-me persistence

#### 8a.3: VNic Communication Tests (`go/tests/e2e/vnic/`)
- `discovery_test.go` — service registration, multicast discovery
- `communication_test.go` — POST/GET/PUT/DELETE via VNic
- `transactions_test.go` — 2-phase commit, rollback

#### 8a.4: API Endpoint Tests (`go/tests/e2e/api/`)
- `rest_test.go` — all REST endpoints
- `websocket_test.go` — connection, subscription, real-time updates

#### 8a.5: Mobile UI Tests (`go/tests/e2e/ui/`)
- `desktop_test.go` — navigation, table operations, CRUD
- `mobile_test.go` — card navigation, detail views

#### 8a.6: Deployment Tests (`go/tests/e2e/deployment/`)
- `kind_test.go` — full KIND cluster deployment and smoke test

### 8b: Manual Verification Checklist

#### Desktop Verification
- [ ] Navigate to Physiotherapy section — verify data loads
- [ ] Click therapist row — verify popup opens with populated fields
- [ ] Filter therapists by name — verify filtering works
- [ ] Sort by lastName — verify sorting works
- [ ] Create new client — verify form validation
- [ ] Assign client to therapist — verify dropdown renders correctly
- [ ] Create treatment plan — verify exercise selector works
- [ ] Open session-view popup — verify circuits render
- [ ] Verify CSS changes — no broken layouts, colors use theme tokens
- [ ] `go build ./...` passes — confirms all code compiles

#### Mobile Verification
- [ ] Navigate via card navigation — verify data loads
- [ ] Click therapist card — verify detail popup opens
- [ ] Filter clients on mobile — verify input works
- [ ] Open plan editor on mobile — verify circuit display works
- [ ] Verify CSS inline styles replaced with theme tokens
- [ ] `m/app.html` loads without errors

#### Infrastructure Verification
```bash
# Phase 1: No l8secure imports
grep -rn "l8secure" go/ --include="*.go" | grep -v vendor/

# Phase 2: No erp-* base images
grep -rn "erp-security\|erp-postgres" go/physio/*/Dockerfile 2>/dev/null

# Phase 3: Log services exist
ls go/physio/log-vnet/{main.go,Dockerfile,build.sh}
ls go/physio/log-agent/{main.go,Dockerfile,build.sh}

# Phase 4: Boostapp deployment artifacts
ls go/physio/boostapp/{main,collector,parser}/{main.go,Dockerfile,build.sh}

# Phase 5: Four K8s modes + KIND scripts
ls go/k8s/physio-{local,baremetal,gke,kind}.yaml
ls go/k8s/kind-{start,stop}.sh

# Phase 6: session-view split under 500 lines
wc -l go/physio/ui/web/physio/session-view.js
wc -l go/physio/ui/web/physio/session-view-rendering.js

# Phase 7: No hardcoded hex in CSS
grep -rE "#[0-9a-fA-F]{3,6}" go/physio/ui/web/css/ --include="*.css" | grep -v "var("

# Build verification
cd go && go build ./...
```

---

## Traceability Matrix

| # | Issue | Platform | Severity | Phase |
|---|-------|----------|----------|-------|
| 1 | l8secure import in boostapp | Backend | Critical | Phase 1 |
| 2 | Dockerfiles use erp-* base images | Infra | Critical | Phase 0 + 2 |
| 3 | Missing log services (log-vnet, log-agent) | Infra | Critical | Phase 3 |
| 4 | Missing K8s four-mode YAMLs + KIND scripts | Infra | Critical | Phase 5 |
| 5 | Boostapp missing build.sh/Dockerfile | Infra | Low | Phase 4 |
| 6 | session-view.js over 500 lines | Desktop | Moderate | Phase 6 |
| 6m | session-view-m.js (mobile equivalent) | Mobile | N/A | Not affected — separate file, under 500 lines |
| 7a | CSS hardcoded colors (desktop CSS files) | Desktop | Moderate | Phase 7 |
| 7b | CSS hardcoded colors (m/app.html inline styles) | Mobile | Moderate | Phase 7 |
| 8 | Missing security config directory | N/A | False positive | N/A — config exists in l8secure/go/secure/plugin/phy/ |
| 9 | End-to-end verification | Desktop + Mobile | Required | Phase 8 |

