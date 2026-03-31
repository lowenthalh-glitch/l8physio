# Security RBAC Implementation Plan — l8physio

## Objective
Implement role-based access control using the l8secure framework:
- Define three roles: **admin**, **therapist**, **client**
- Each role sees only its own data (data isolation via per-user scope roles)
- For every existing PhysioTherapist and PhysioClient, create an L8User account using their email and default password `12345678`
- Auto-create accounts for future records via service callback hooks

---

## Framework Fundamentals (l8secure)

### Role model
```
L8Role { RoleId, RoleName, Rules map[string]*L8Rule }
L8Rule { RuleId, ElemType, Allowed bool, Actions map[int32]bool, Attributes map[string]string }
```
Action codes: POST=1, PUT=2, PATCH=3, DELETE=4, GET=5, wildcard=-999

### Row-level filtering (ScopeView)
A **deny rule** with an `Attributes` entry whose key is the type name and value is an L8Query:
```go
Attributes: map[string]string{
    "PhysioClient": "select * from PhysioClient where therapistId!=thr-001",
}
```
`ScopeView` runs `q.Match(elem)` on every returned record; records that **match** the deny query are **removed**. This means "deny records where therapistId != thr-001" keeps only this therapist's clients.

### Field-level blanking
Key format `lowercase(type).lowercase(field)`, any non-empty value:
```go
Attributes: map[string]string{
    "treatmentplan.therapistnotes": "denied",
    "appointment.therapistnotes":   "denied",
}
```
Sets the named field to zero value on every returned record.

### User creation
POST to security service `"users"` (area 73):
```go
user := &secure.L8User{
    UserId:        "sarah.cohen@clinic.example.com",
    FullName:      "Sarah Cohen",
    Email:         "sarah.cohen@clinic.example.com",
    Password:      &secure.L8Password{Hash: "12345678"},  // plaintext; hashed by service callback
    Roles:         map[string]bool{"therapist": true, "therapist-scope-thr-001": true},
    AccountStatus: secure.AccountStatus_ACCOUNT_STATUS_ACTIVE,
    Portal:        "app.html",
}
handler, _ := vnic.Resources().Services().ServiceHandler("users", 73)
handler.Post(object.New(nil, user), vnic)
```

### Role creation
POST to security service `"roles"` (area 74):
```go
role := &secure.L8Role{ RoleId: "...", RoleName: "...", Rules: map[string]*L8Rule{...} }
handler, _ := vnic.Resources().Services().ServiceHandler("roles", 74)
handler.Post(object.New(nil, role), vnic)
```

---

## Role Design

### `admin` — full access
```
Allow  *  actions=[*]
```

### `therapist` — CRUD on all physio types
```
Allow  PhysioClient     actions=[POST, PUT, PATCH, DELETE, GET]
Allow  TreatmentPlan    actions=[POST, PUT, PATCH, DELETE, GET]
Allow  Appointment      actions=[POST, PUT, PATCH, DELETE, GET]
Allow  ProgressLog      actions=[POST, PUT, PATCH, DELETE, GET]
Allow  PhysioExercise   actions=[GET]
Allow  PhysioProtocol   actions=[GET]
```
No field denials on the base therapist role. Data isolation comes from per-therapist scope roles.

### `client` — read-only on own data, sensitive fields blanked
```
Allow  PhysioClient    actions=[GET]
Allow  TreatmentPlan   actions=[GET]
Allow  Appointment     actions=[GET]
Allow  ProgressLog     actions=[GET]
Allow  PhysioExercise  actions=[GET]

Deny   TreatmentPlan   field=treatmentplan.therapistnotes
Deny   Appointment     field=appointment.therapistnotes
```

### `therapist-scope-[therapistId]` — per-therapist data isolation
```
Deny  PhysioClient    row: "select * from PhysioClient where therapistId!=[therapistId]"
Deny  TreatmentPlan   row: "select * from TreatmentPlan where therapistId!=[therapistId]"
Deny  Appointment     row: "select * from Appointment where therapistId!=[therapistId]"
```

### `client-scope-[clientId]` — per-client data isolation
```
Deny  PhysioClient    row: "select * from PhysioClient where clientId!=[clientId]"
Deny  TreatmentPlan   row: "select * from TreatmentPlan where clientId!=[clientId]"
Deny  Appointment     row: "select * from Appointment where clientId!=[clientId]"
Deny  ProgressLog     row: "select * from ProgressLog where clientId!=[clientId]"
```

---

## Analysis Gaps & Notes

| # | Gap / Decision | Resolution |
|---|---------------|------------|
| A1 | `!=` operator in L8Query — verify interpreter support | Plan uses it; if unsupported, switch to callback-level filtering |
| A2 | ProgressLog has `clientId` but no `therapistId` | Therapist scope covers PhysioClient/TreatmentPlan/Appointment; ProgressLog filtered for clients only |
| A3 | User ID: email vs. system ID | Use email when non-empty, fall back to therapistId/clientId |
| A4 | Duplicate user detection | `getUser()` check before POST; skip if exists |
| A5 | Existing admin user in JSON config | Already configured; EnsureBaseRoles creates only the three app roles |
| A6 | ProgressLog has no therapistId | Therapists see all ProgressLogs; noted as future enhancement to add field |
| A7 | Import path for l8secure service constants | `"github.com/saichler/l8secure/go/secure/provider"` for constants; `"github.com/saichler/l8srlz/go/serialize/object"` for object.New |

---

## Traceability Matrix

| # | Item | Phase |
|---|------|-------|
| 1 | Create `go/physio/security/` package | Phase 1 |
| 2 | `EnsureBaseRoles(vnic)` — admin, therapist, client roles | Phase 1 |
| 3 | Field deny rules on client role (therapistNotes blanked) | Phase 1 |
| 4 | `createTherapistScopeRole(therapistId, vnic)` — deny row filter | Phase 2 |
| 5 | `createClientScopeRole(clientId, vnic)` — deny row filter | Phase 2 |
| 6 | `createTherapistAccount(therapist, vnic)` — L8User + scope role | Phase 2 |
| 7 | `createClientAccount(client, vnic)` — L8User + scope role | Phase 2 |
| 8 | `SeedAccounts(vnic)` — fetch existing records, create accounts | Phase 2 |
| 9 | Custom PhysioClientCallback wrapping base callback | Phase 3 |
| 10 | PhysioClientCallback.After(POST) → createClientAccount | Phase 3 |
| 11 | Custom PhysioTherapistCallback wrapping base callback | Phase 3 |
| 12 | PhysioTherapistCallback.After(POST) → createTherapistAccount | Phase 3 |
| 13 | `security.Setup(vnic)` called in `main.go` after ActivateAllServices | Phase 4 |
| 14 | Verify L8Query `!=` operator works in ScopeView | Phase 5 |
| 15 | Verify therapist login sees only own clients | Phase 5 |
| 16 | Verify client login sees only own records | Phase 5 |
| 17 | Verify therapistNotes blanked in client GET responses | Phase 5 |

---

## Phase 1 — Security Package + Base Roles

**New file:** `go/physio/security/security.go`

```go
package security

import (
    "github.com/saichler/l8secure/go/secure/provider"
    "github.com/saichler/l8secure/go/types/secure"
    "github.com/saichler/l8srlz/go/serialize/object"
    "github.com/saichler/l8types/go/ifs"
)

func Setup(vnic ifs.IVNic) {
    EnsureBaseRoles(vnic)
    SeedAccounts(vnic)
}

// EnsureBaseRoles creates admin, therapist, and client roles if they don't exist.
func EnsureBaseRoles(vnic ifs.IVNic) {
    roles := []*secure.L8Role{adminRole(), therapistRole(), clientRole()}
    h, ok := vnic.Resources().Services().ServiceHandler(provider.RolesServiceName, provider.RolesServiceArea)
    if !ok {
        vnic.Resources().Logger().Error("security: roles service not available")
        return
    }
    for _, role := range roles {
        existing := provider.GetRole(role.RoleId, vnic)   // or re-implement inline
        if existing != nil {
            continue  // already exists
        }
        h.Post(object.New(nil, role), vnic)
    }
}

func adminRole() *secure.L8Role {
    return &secure.L8Role{
        RoleId:   "admin",
        RoleName: "Administrator",
        Rules: map[string]*secure.L8Rule{
            "admin-all": {
                RuleId:   "admin-all",
                ElemType: "*",
                Allowed:  true,
                Actions:  map[int32]bool{1: true, 2: true, 3: true, 4: true, 5: true},
            },
        },
    }
}

func therapistRole() *secure.L8Role {
    allow := func(id, typeName string) *secure.L8Rule {
        return &secure.L8Rule{
            RuleId:   id,
            ElemType: typeName,
            Allowed:  true,
            Actions:  map[int32]bool{1: true, 2: true, 3: true, 4: true, 5: true},
        }
    }
    allowGet := func(id, typeName string) *secure.L8Rule {
        return &secure.L8Rule{
            RuleId:   id,
            ElemType: typeName,
            Allowed:  true,
            Actions:  map[int32]bool{5: true},
        }
    }
    return &secure.L8Role{
        RoleId:   "therapist",
        RoleName: "Therapist",
        Rules: map[string]*secure.L8Rule{
            "t-client":   allow("t-client",   "PhysioClient"),
            "t-plan":     allow("t-plan",     "TreatmentPlan"),
            "t-appt":     allow("t-appt",     "Appointment"),
            "t-progress": allow("t-progress", "ProgressLog"),
            "t-exercise": allowGet("t-exercise", "PhysioExercise"),
            "t-protocol": allowGet("t-protocol", "PhysioProtocol"),
        },
    }
}

func clientRole() *secure.L8Role {
    allowGet := func(id, typeName string) *secure.L8Rule {
        return &secure.L8Rule{
            RuleId:   id,
            ElemType: typeName,
            Allowed:  true,
            Actions:  map[int32]bool{5: true},
        }
    }
    return &secure.L8Role{
        RoleId:   "client",
        RoleName: "Client",
        Rules: map[string]*secure.L8Rule{
            "c-client":   allowGet("c-client",   "PhysioClient"),
            "c-plan":     allowGet("c-plan",     "TreatmentPlan"),
            "c-appt":     allowGet("c-appt",     "Appointment"),
            "c-progress": allowGet("c-progress", "ProgressLog"),
            "c-exercise": allowGet("c-exercise", "PhysioExercise"),
            // Field denials: blank therapist-only notes from client responses
            "c-deny-plan-notes": {
                RuleId:   "c-deny-plan-notes",
                ElemType: "TreatmentPlan",
                Allowed:  false,
                Actions:  map[int32]bool{5: true},
                Attributes: map[string]string{
                    "treatmentplan.therapistnotes": "denied",
                },
            },
            "c-deny-appt-notes": {
                RuleId:   "c-deny-appt-notes",
                ElemType: "Appointment",
                Allowed:  false,
                Actions:  map[int32]bool{5: true},
                Attributes: map[string]string{
                    "appointment.therapistnotes": "denied",
                },
            },
        },
    }
}
```

---

## Phase 2 — Account Seeder

Add to `go/physio/security/security.go`:

```go
import (
    "fmt"
    "github.com/saichler/l8physio/go/physio/clients"
    "github.com/saichler/l8physio/go/physio/therapists"
    physioTypes "github.com/saichler/l8physio/go/types/physio"
)

// SeedAccounts creates user accounts for all existing therapists and clients.
func SeedAccounts(vnic ifs.IVNic) {
    seedTherapists(vnic)
    seedClients(vnic)
}

func seedTherapists(vnic ifs.IVNic) {
    h, ok := therapists.Therapists(vnic)
    if !ok { return }
    resp := h.Get(object.New(nil, "select * from PhysioTherapist"), vnic)
    if resp == nil || resp.Elements() == nil { return }
    for _, e := range resp.Elements() {
        t := e.(*physioTypes.PhysioTherapist)
        CreateTherapistAccount(t, vnic)
    }
}

func seedClients(vnic ifs.IVNic) {
    h, ok := clients.Clients(vnic)
    if !ok { return }
    resp := h.Get(object.New(nil, "select * from PhysioClient"), vnic)
    if resp == nil || resp.Elements() == nil { return }
    for _, e := range resp.Elements() {
        c := e.(*physioTypes.PhysioClient)
        CreateClientAccount(c, vnic)
    }
}

// CreateTherapistAccount creates a scope role and L8User for a therapist.
func CreateTherapistAccount(t *physioTypes.PhysioTherapist, vnic ifs.IVNic) {
    userId := userIdFor(t.Email, t.TherapistId)
    scopeRoleId := "therapist-scope-" + t.TherapistId

    // 1. Create per-therapist scope role
    scopeRole := &secure.L8Role{
        RoleId:   scopeRoleId,
        RoleName: "Therapist Scope " + t.TherapistId,
        Rules: map[string]*secure.L8Rule{
            "ts-client": {
                RuleId:   "ts-client",
                ElemType: "PhysioClient",
                Allowed:  false,
                Actions:  map[int32]bool{5: true},
                Attributes: map[string]string{
                    "PhysioClient": fmt.Sprintf("select * from PhysioClient where therapistId!=%s", t.TherapistId),
                },
            },
            "ts-plan": {
                RuleId:   "ts-plan",
                ElemType: "TreatmentPlan",
                Allowed:  false,
                Actions:  map[int32]bool{5: true},
                Attributes: map[string]string{
                    "TreatmentPlan": fmt.Sprintf("select * from TreatmentPlan where therapistId!=%s", t.TherapistId),
                },
            },
            "ts-appt": {
                RuleId:   "ts-appt",
                ElemType: "Appointment",
                Allowed:  false,
                Actions:  map[int32]bool{5: true},
                Attributes: map[string]string{
                    "Appointment": fmt.Sprintf("select * from Appointment where therapistId!=%s", t.TherapistId),
                },
            },
        },
    }
    postRoleIfAbsent(scopeRole, vnic)

    // 2. Create L8User
    user := &secure.L8User{
        UserId:        userId,
        FullName:      t.FirstName + " " + t.LastName,
        Email:         t.Email,
        Password:      &secure.L8Password{Hash: "12345678"},
        Roles:         map[string]bool{"therapist": true, scopeRoleId: true},
        AccountStatus: secure.AccountStatus_ACCOUNT_STATUS_ACTIVE,
        Portal:        "app.html",
    }
    postUserIfAbsent(user, vnic)
}

// CreateClientAccount creates a scope role and L8User for a client.
func CreateClientAccount(c *physioTypes.PhysioClient, vnic ifs.IVNic) {
    userId := userIdFor(c.Email, c.ClientId)
    scopeRoleId := "client-scope-" + c.ClientId

    // 1. Create per-client scope role
    scopeRole := &secure.L8Role{
        RoleId:   scopeRoleId,
        RoleName: "Client Scope " + c.ClientId,
        Rules: map[string]*secure.L8Rule{
            "cs-client": {
                RuleId:   "cs-client",
                ElemType: "PhysioClient",
                Allowed:  false,
                Actions:  map[int32]bool{5: true},
                Attributes: map[string]string{
                    "PhysioClient": fmt.Sprintf("select * from PhysioClient where clientId!=%s", c.ClientId),
                },
            },
            "cs-plan": {
                RuleId:   "cs-plan",
                ElemType: "TreatmentPlan",
                Allowed:  false,
                Actions:  map[int32]bool{5: true},
                Attributes: map[string]string{
                    "TreatmentPlan": fmt.Sprintf("select * from TreatmentPlan where clientId!=%s", c.ClientId),
                },
            },
            "cs-appt": {
                RuleId:   "cs-appt",
                ElemType: "Appointment",
                Allowed:  false,
                Actions:  map[int32]bool{5: true},
                Attributes: map[string]string{
                    "Appointment": fmt.Sprintf("select * from Appointment where clientId!=%s", c.ClientId),
                },
            },
            "cs-progress": {
                RuleId:   "cs-progress",
                ElemType: "ProgressLog",
                Allowed:  false,
                Actions:  map[int32]bool{5: true},
                Attributes: map[string]string{
                    "ProgressLog": fmt.Sprintf("select * from ProgressLog where clientId!=%s", c.ClientId),
                },
            },
        },
    }
    postRoleIfAbsent(scopeRole, vnic)

    // 2. Create L8User
    user := &secure.L8User{
        UserId:        userId,
        FullName:      c.FirstName + " " + c.LastName,
        Email:         c.Email,
        Password:      &secure.L8Password{Hash: "12345678"},
        Roles:         map[string]bool{"client": true, scopeRoleId: true},
        AccountStatus: secure.AccountStatus_ACCOUNT_STATUS_ACTIVE,
        Portal:        "app.html",
    }
    postUserIfAbsent(user, vnic)
}

// helpers

func userIdFor(email, fallback string) string {
    if email != "" {
        return email
    }
    return fallback
}

func postRoleIfAbsent(role *secure.L8Role, vnic ifs.IVNic) {
    h, ok := vnic.Resources().Services().ServiceHandler(provider.RolesServiceName, provider.RolesServiceArea)
    if !ok { return }
    // check existence
    filter := &secure.L8Role{RoleId: role.RoleId}
    resp := h.Get(object.New(nil, filter), vnic)
    if resp != nil && resp.Element() != nil { return }  // already exists
    h.Post(object.New(nil, role), vnic)
}

func postUserIfAbsent(user *secure.L8User, vnic ifs.IVNic) {
    h, ok := vnic.Resources().Services().ServiceHandler(provider.UsersServiceName, provider.UsersServiceArea)
    if !ok { return }
    filter := &secure.L8User{UserId: user.UserId}
    resp := h.Get(object.New(nil, filter), vnic)
    if resp != nil && resp.Element() != nil { return }  // already exists
    h.Post(object.New(nil, user), vnic)
}
```

---

## Phase 3 — Service Callback Hooks (auto-create on new record)

### `go/physio/clients/PhyClientServiceCallback.go`

Replace:
```go
func newPhyClientServiceCallback() ifs.IServiceCallback {
    return erpc.NewServiceCallback[physio.PhysioClient](
        "PhysioClient", setPhyClientID, validatePhyClient,
    )
}
```

With a custom wrapper:
```go
type physioClientCallback struct {
    base ifs.IServiceCallback
}

func newPhyClientServiceCallback() ifs.IServiceCallback {
    return &physioClientCallback{
        base: erpc.NewServiceCallback[physio.PhysioClient](
            "PhysioClient", setPhyClientID, validatePhyClient,
        ),
    }
}

func (cb *physioClientCallback) Before(elem interface{}, action ifs.Action, notify bool, vnic ifs.IVNic) (interface{}, bool, error) {
    return cb.base.Before(elem, action, notify, vnic)
}

func (cb *physioClientCallback) After(elem interface{}, action ifs.Action, notify bool, vnic ifs.IVNic) (interface{}, bool, error) {
    if action == ifs.POST && !notify {
        if c, ok := elem.(*physio.PhysioClient); ok {
            go security.CreateClientAccount(c, vnic)  // async to not block
        }
    }
    return nil, true, nil
}
```

### `go/physio/therapists/PhyTherapistServiceCallback.go`

Same pattern:
```go
type physioTherapistCallback struct {
    base ifs.IServiceCallback
}

func newPhyTherapistServiceCallback() ifs.IServiceCallback {
    return &physioTherapistCallback{
        base: erpc.NewServiceCallback[physio.PhysioTherapist](
            "PhysioTherapist", setPhyTherapistID, validatePhyTherapist,
        ),
    }
}

func (cb *physioTherapistCallback) Before(elem interface{}, action ifs.Action, notify bool, vnic ifs.IVNic) (interface{}, bool, error) {
    return cb.base.Before(elem, action, notify, vnic)
}

func (cb *physioTherapistCallback) After(elem interface{}, action ifs.Action, notify bool, vnic ifs.IVNic) (interface{}, bool, error) {
    if action == ifs.POST && !notify {
        if t, ok := elem.(*physio.PhysioTherapist); ok {
            go security.CreateTherapistAccount(t, vnic)
        }
    }
    return nil, true, nil
}
```

---

## Phase 4 — Wire into main.go

In `go/physio/main/main.go`, after `ActivateAllServices`:

```go
import "github.com/saichler/l8physio/go/physio/security"

// After:
services.ActivateAllServices(common.DB_CREDS, common.DB_NAME, nic)
aia.Activate(common.DB_CREDS, common.DB_NAME, nic)
aia.ActivateChat(common.DB_CREDS, common.DB_NAME, nic)

// Add:
security.Setup(nic)
```

---

## Phase 5 — Verification

### Checklist
- [ ] Build passes: `go build ./...`
- [ ] `go vet ./...` passes
- [ ] Start system with `run-local.sh`
- [ ] Login as admin → verify all data visible
- [ ] Login as a therapist (e.g., `sarah.cohen@clinic.example.com` / `12345678`) → verify only Sarah's clients appear in PhysioClient list
- [ ] Login as the same therapist → open a client's workout plan → verify plan loads correctly
- [ ] Login as a different therapist → verify Sarah's clients are not visible
- [ ] Login as a client (e.g., `john.smith1@example.com` / `12345678`) → verify only own PhysioClient record visible
- [ ] Login as same client → verify TreatmentPlan, Appointment, ProgressLog filtered to own records
- [ ] Login as client → verify `therapistNotes` field is blank/empty in TreatmentPlan and Appointment responses
- [ ] Create new PhysioClient via admin UI → verify corresponding L8User auto-created
- [ ] Create new PhysioTherapist via admin UI → verify corresponding L8User auto-created

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `go/physio/security/security.go` | **Create** — security package with roles, seeder, account helpers |
| `go/physio/clients/PhyClientServiceCallback.go` | **Modify** — wrap callback, add After(POST) hook |
| `go/physio/therapists/PhyTherapistServiceCallback.go` | **Modify** — wrap callback, add After(POST) hook |
| `go/physio/main/main.go` | **Modify** — add `security.Setup(nic)` call |

---

## Known Risks

| Risk | Mitigation |
|------|-----------|
| L8Query `!=` operator unsupported | Test in Phase 5; fallback: implement filtering in callback's Before() for GET using a custom service wrapper |
| Circular import: security ↔ clients/therapists | security package imports physio types (not service packages); seeder uses service handler directly via vnic |
| Slow startup (many accounts) | SeedAccounts runs synchronously at startup; consider pagination if >100 records cause timeout |
| TherapistNotes field key casing | ScopeView uses `lowercase(typeName).lowercase(fieldName)` = `"treatmentplan.therapistnotes"` and `"appointment.therapistnotes"` — verify with actual struct field names |
