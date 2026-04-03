# Plan: Migrate l8physio from l8erp to l8common

## Problem

l8physio imports service infrastructure from `l8erp/go/erp/common` (aliased as `erpc`), but this functionality has been abstracted into `l8common/go/common`. This creates an unnecessary dependency on l8erp and duplicates mock utilities that l8common already provides.

Additionally, the l8erp API uses Go generics (`ActivateService[T, TList]`, `NewServiceCallback[T]`), which violates the project's "no Go generics" rule. l8common's API uses `interface{}`/`proto.Message`, which is compliant.

## Scope

### Files that change import from `l8erp` to `l8common`

**8 Service files** (import `erpc.ActivateService`, `erpc.ServiceHandler`, `erpc.GetEntity`):
- `go/physio/clients/PhyClientService.go`
- `go/physio/exercises/PhyExercisService.go`
- `go/physio/plans/PhyPlanService.go`
- `go/physio/appointments/PhyApptService.go`
- `go/physio/progress/PhyLogService.go`
- `go/physio/protocols/PhyProtocolService.go`
- `go/physio/therapists/PhyTherapistService.go`
- `go/physio/workout/PhyWorkoutService.go`

**8 ServiceCallback files** (import `erpc.NewServiceCallback`, `erpc.GenerateID`, `erpc.ValidateRequired`):
- `go/physio/clients/PhyClientServiceCallback.go`
- `go/physio/exercises/PhyExercisServiceCallback.go`
- `go/physio/plans/PhyPlanServiceCallback.go`
- `go/physio/appointments/PhyApptServiceCallback.go`
- `go/physio/progress/PhyLogServiceCallback.go`
- `go/physio/protocols/PhyProtocolServiceCallback.go`
- `go/physio/therapists/PhyTherapistServiceCallback.go`
- `go/physio/workout/PhyWorkoutServiceCallback.go`

**1 UI main** (import `erpc.RegisterType`):
- `go/physio/ui/main.go`

### Files that delete local code and use l8common

**1 mock utils file** (delete and replace with l8common imports):
- `go/tests/mocks/utils.go`

**~9 mock generator files** (update function calls):
- All `go/tests/mocks/gen_physio_*.go` files
- `go/tests/mocks/data.go` (if it imports erp types)
- `go/tests/mocks/store.go`
- `go/tests/mocks/physio_phases.go` and related phase files
- `go/tests/mocks/cmd/main.go` (mock client)

### Files that stay unchanged

- `go/physio/common/defaults.go` — keeps local `CreateResources()` (uses `PhysioSecurityProvider`)
- `go/physio/common/physio_security.go` — domain-specific, no l8erp imports
- `go/physio/aia/activate.go` — imports from l8agent, not l8erp
- `go/physio/services/activate_all.go` — calls local `Activate()` functions, no direct l8erp imports

## API Mapping

### Service Activation

**Before (l8erp, generic):**
```go
import erpc "github.com/saichler/l8erp/go/erp/common"

func Activate(creds, dbname string, vnic ifs.IVNic) {
    erpc.ActivateService[physio.PhysioClient, physio.PhysioClientList](
        erpc.ServiceConfig{
            ServiceName: ServiceName,
            ServiceArea: ServiceArea,
            PrimaryKey:  "ClientId",
            Callback:    newPhyClientServiceCallback(),
        }, creds, dbname, vnic)
}
```

**After (l8common, interface{}):**
```go
import l8c "github.com/saichler/l8common/go/common"

func Activate(creds, dbname string, vnic ifs.IVNic) {
    l8c.ActivateService(
        l8c.ServiceConfig{
            ServiceName: ServiceName,
            ServiceArea: ServiceArea,
            PrimaryKey:  "ClientId",
            Callback:    newPhyClientServiceCallback(),
        }, &physio.PhysioClient{}, &physio.PhysioClientList{}, creds, dbname, vnic)
}
```

**Key change:** Generic type params `[T, TList]` become explicit instance args `&physio.T{}, &physio.TList{}`.

### Service Helper Functions

**Before:**
```go
func Clients(vnic ifs.IVNic) (ifs.IServiceHandler, bool) {
    return erpc.ServiceHandler(ServiceName, ServiceArea, vnic)
}
func Client(clientId string, vnic ifs.IVNic) (*physio.PhysioClient, error) {
    return erpc.GetEntity[physio.PhysioClient](ServiceName, ServiceArea, &physio.PhysioClient{ClientId: clientId}, vnic)
}
```

**After:**
```go
func Clients(vnic ifs.IVNic) (ifs.IServiceHandler, bool) {
    return l8c.ServiceHandler(ServiceName, ServiceArea, vnic)
}
func Client(clientId string, vnic ifs.IVNic) (*physio.PhysioClient, error) {
    result, err := l8c.GetEntity(ServiceName, ServiceArea, &physio.PhysioClient{ClientId: clientId}, vnic)
    if err != nil {
        return nil, err
    }
    return result.(*physio.PhysioClient), nil
}
```

**Key change:** `GetEntity[T]` returns `*T` directly; `GetEntity` returns `interface{}` requiring type assertion.

### ServiceCallback

**Before (generic):**
```go
func newPhyClientServiceCallback() ifs.IServiceCallback {
    return erpc.NewServiceCallback[physio.PhysioClient](
        "PhysioClient",
        setPhyClientID,
        validatePhyClient,
    )
}
func setPhyClientID(entity *physio.PhysioClient) {
    erpc.GenerateID(&entity.ClientId)
}
func validatePhyClient(entity *physio.PhysioClient, vnic ifs.IVNic) error {
    if err := erpc.ValidateRequired(entity.FirstName, "FirstName"); err != nil { return err }
    return erpc.ValidateRequired(entity.LastName, "LastName")
}
```

**After (interface{}):**
```go
func newPhyClientServiceCallback() ifs.IServiceCallback {
    return l8c.NewServiceCallback(
        "PhysioClient",
        func(e interface{}) bool { _, ok := e.(*physio.PhysioClient); return ok },
        func(e interface{}) { entity := e.(*physio.PhysioClient); l8c.GenerateID(&entity.ClientId) },
        func(e interface{}, vnic ifs.IVNic) error {
            entity := e.(*physio.PhysioClient)
            if err := l8c.ValidateRequired(entity.FirstName, "FirstName"); err != nil { return err }
            return l8c.ValidateRequired(entity.LastName, "LastName")
        },
    )
}
```

**Key change:** Typed functions `func(*T)` become `func(interface{})` with type assertion inside. The `typeCheck` parameter is new — l8common needs it to identify the entity type.

### Type Registration (UI)

**Before:**
```go
erpc.RegisterType[physio.PhysioTherapist, physio.PhysioTherapistList](resources, "TherapistId")
```

**After:**
```go
l8c.RegisterType(resources, &physio.PhysioTherapist{}, &physio.PhysioTherapistList{}, "TherapistId")
```

### Mock Utilities

**Before (local private functions + erp.AuditInfo):**
```go
import "github.com/saichler/l8erp/go/types/erp"

func createAuditInfo() *erp.AuditInfo { ... }
func pickRef(ids []string, index int) string { ... }
func genID(prefix string, index int) string { ... }
func randomPhone() string { ... }
```

**After (l8common exports + l8common.AuditInfo):**
```go
import lm "github.com/saichler/l8common/go/mocks"

// Delete utils.go entirely. In generators:
lm.CreateAuditInfo()
lm.PickRef(ids, index)
lm.GenID(prefix, index)
lm.RandomPhone()
lm.RandomBirthDate()
lm.RandomPastDate(maxMonths, maxDays)  // Note: l8common takes 2 args
lm.RandomFutureDate(maxMonths, maxDays)
lm.SanitizeEmail(s)
```

**Key change:** `randomPastDate(maxMonths)` becomes `RandomPastDate(maxMonths, maxDays)` — l8common adds a `maxDays` parameter. Pass `0` for same behavior.

### Mock Client

**Before (local HTTP client):**
```go
// Inline HTTP client code in main or RunMockGenerator
```

**After:**
```go
import lm "github.com/saichler/l8common/go/mocks"

client := lm.NewMockClient(baseURL, httpClient)
client.Authenticate(user, password)
client.Post(endpoint, data)
```

## Phases

### Phase 1: Update go.mod dependencies

```bash
cd go
# Add l8common dependency, remove l8erp if no longer needed
go mod edit -require github.com/saichler/l8common@latest
# After all code changes: go mod tidy to remove unused l8erp
```

### Phase 2: Migrate 8 Service files

For each `*Service.go`:
1. Change import from `erpc "github.com/saichler/l8erp/go/erp/common"` to `l8c "github.com/saichler/l8common/go/common"`
2. Change `erpc.ActivateService[T, TList](cfg, ...)` to `l8c.ActivateService(cfg, &T{}, &TList{}, ...)`
3. Change `erpc.ServiceHandler(...)` to `l8c.ServiceHandler(...)`
4. Change `erpc.GetEntity[T](...)` to `l8c.GetEntity(...)` with type assertion on result
5. Change `erpc.ServiceConfig` to `l8c.ServiceConfig`

Files: `PhyClientService.go`, `PhyExercisService.go`, `PhyPlanService.go`, `PhyApptService.go`, `PhyLogService.go`, `PhyProtocolService.go`, `PhyTherapistService.go`, `PhyWorkoutService.go`

### Phase 3: Migrate 8 ServiceCallback files

For each `*ServiceCallback.go`:
1. Change import from `erpc` to `l8c`
2. Change `erpc.NewServiceCallback[T](name, setID, validate)` to `l8c.NewServiceCallback(name, typeCheck, setID, validate)` with `interface{}` signatures
3. Change `erpc.GenerateID(...)` to `l8c.GenerateID(...)`
4. Change `erpc.ValidateRequired(...)` to `l8c.ValidateRequired(...)`

Files: `PhyClientServiceCallback.go`, `PhyExercisServiceCallback.go`, `PhyPlanServiceCallback.go`, `PhyApptServiceCallback.go`, `PhyLogServiceCallback.go`, `PhyProtocolServiceCallback.go`, `PhyTherapistServiceCallback.go`, `PhyWorkoutServiceCallback.go`

### Phase 4: Migrate UI type registration

In `go/physio/ui/main.go`:
1. Change import from `erpc` to `l8c`
2. Change all 8 `erpc.RegisterType[T, TList](resources, "PK")` to `l8c.RegisterType(resources, &T{}, &TList{}, "PK")`

### Phase 5: Migrate mock utilities

1. **Delete** `go/tests/mocks/utils.go`
2. **Update** all `go/tests/mocks/gen_physio_*.go` files:
   - Add import `lm "github.com/saichler/l8common/go/mocks"`
   - Replace `pickRef(` → `lm.PickRef(`
   - Replace `genID(` → `lm.GenID(`
   - Replace `createAuditInfo()` → `lm.CreateAuditInfo()`
   - Replace `randomPhone()` → `lm.RandomPhone()`
   - Replace `randomBirthDate()` → `lm.RandomBirthDate()`
   - Replace `randomPastDate(n)` → `lm.RandomPastDate(n, 0)`
   - Replace `randomFutureDate(n)` → `lm.RandomFutureDate(n, 0)`
   - Replace `sanitizeEmail(` → `lm.SanitizeEmail(`
3. **Update** `go/tests/mocks/data.go` — remove `erp` type imports if any
4. **Update** mock client usage to use `lm.NewMockClient` if applicable

### Phase 6: Update dependencies and verify

```bash
cd go
rm -rf go.sum go.mod vendor
go mod init
GOPROXY=direct GOPRIVATE=github.com go mod tidy
go mod vendor
go build ./...
go vet ./...
```

Verify:
- No remaining imports of `github.com/saichler/l8erp` anywhere in the project
- All tests compile
- `go build ./...` succeeds with zero errors

## Traceability Matrix

| # | Change | Phase | Files |
|---|--------|-------|-------|
| 1 | `erpc.ActivateService[T,TList]` → `l8c.ActivateService(cfg, &T{}, &TList{}, ...)` | 2 | 8 Service.go |
| 2 | `erpc.ServiceHandler` → `l8c.ServiceHandler` | 2 | 8 Service.go |
| 3 | `erpc.GetEntity[T]` → `l8c.GetEntity` + type assert | 2 | 8 Service.go |
| 4 | `erpc.ServiceConfig` → `l8c.ServiceConfig` | 2 | 8 Service.go |
| 5 | `erpc.NewServiceCallback[T]` → `l8c.NewServiceCallback` with interface{} | 3 | 8 Callback.go |
| 6 | `erpc.GenerateID` → `l8c.GenerateID` | 3 | 8 Callback.go |
| 7 | `erpc.ValidateRequired` → `l8c.ValidateRequired` | 3 | 8 Callback.go |
| 8 | `erpc.RegisterType[T,TList]` → `l8c.RegisterType(res, &T{}, &TList{}, pk)` | 4 | 1 ui/main.go |
| 9 | Delete local mock utils, use l8common/mocks | 5 | 1 delete + ~9 update |
| 10 | Remove l8erp dependency from go.mod | 6 | go.mod |

## Risks

1. **`randomPastDate` signature change** — l8common takes `(maxMonths, maxDays)` vs local `(maxMonths)`. Use `0` for maxDays to preserve behavior.
2. **AuditInfo type change** — `erp.AuditInfo` → `l8common.AuditInfo`. The proto field names are the same, so JSON serialization is compatible.
3. **GetEntity return type** — generic version returns `*T`, l8common returns `interface{}`. Every call site needs a type assertion added.
4. **Mock data.go arrays** — if `data.go` defines name arrays locally that overlap with `lm.FirstNames`/`lm.LastNames`, keep the domain-specific ones (e.g., physiotherapy-specific names) and only replace generic ones.
