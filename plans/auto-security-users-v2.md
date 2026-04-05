# Auto-Create Security Users for Clients and Therapists (v2)

## Objective
When a PhysioClient or PhysioTherapist is added via the UI, automatically create a security user account with the appropriate role. On DELETE, deactivate the security user (set account status to INACTIVE). Update mock data to populate `userId`.

## Approach
The security system is **already running** in l8physio:
- The `ISecurityProvider` is loaded automatically by `CreateResources()` (ShallowSecurityProvider in local dev, real provider in Docker with `erp-security` base image)
- The web server registers `/auth`, `/register`, `/permissions` endpoints that delegate to the security provider
- The System > Security UI (l8ui) manages Users, Roles, and Credentials
- Mock Phase 6 already registers users via the HTTP `/register` endpoint

**This plan does NOT add l8secure as a Go dependency.** Instead, it uses the `ISecurityProvider` interface already available via `vnic.Resources().Security()` in every callback, and `vnic.Request()` for deactivation.

---

## Design

### On POST (new client/therapist):
In the service callback's `After()`, call `vnic.Resources().Security().Register(email, defaultPassword, "", vnic)` to create the user account. The security provider handles password hashing, user storage, and role assignment internally.

### On DELETE (remove client/therapist):
In the service callback's `After()`, use `vnic.Request()` to send a PATCH to the Users service (service name `"users"`, area `73`) with `AccountStatus = 2` (INACTIVE). This works because `vnic.Request()` sends a message through the overlay network — no import of l8secure needed.

### Mock data:
- Add `user_id` field to PhysioTherapist proto (PhysioClient already has `user_id` at field 12)
- Set `UserId: email` on generated therapists and clients
- Phase 6 already registers users — left as-is

### UI:
- No UI changes needed. The `userId` field on PhysioClient/PhysioTherapist is a backend-only link to the security system. It is not displayed in physio forms or columns (verified: no physio UI JS references `userId` for client/therapist entities).

---

## Infrastructure Constraint: genericCallback.After()

The `genericCallback.After()` in l8common only fires for PUT/PATCH actions. It does NOT fire for POST or DELETE.

**Solution:** Create a reusable `NewSecurityCallback` factory in the security package that wraps any base `IServiceCallback` and adds POST/DELETE handling in `After()`. Both client and therapist callbacks use this factory — no duplicate behavioral code.

---

## Traceability Matrix

| # | Item | Phase |
|---|------|-------|
| 1 | Add `user_id = 9` to PhysioTherapist proto, regenerate | Phase 1 |
| 2 | Update `gen_physio_therapists.go` — set `UserId: email` | Phase 1 |
| 3 | Update `gen_physio_clients.go` — set `UserId: email` | Phase 1 |
| 4 | Create `go/physio/security/security.go` — `RegisterUser`, `DeactivateUser`, `NewSecurityCallback` | Phase 2 |
| 5 | Wrap client callback via `security.NewSecurityCallback` | Phase 3 |
| 6 | Wrap therapist callback via `security.NewSecurityCallback` | Phase 3 |
| 7 | `go build ./...` and `go vet ./...` pass | Phase 4 |
| 8 | Functional verification with `run-local.sh` | Phase 4 |

---

## Phase 1 — Proto + Mock Data

1. Add `string user_id = 9;` to PhysioTherapist in `proto/physio.proto`
   - PhysioClient already has `string user_id = 12;` — no proto change needed for clients
2. Run `cd proto && ./make-bindings.sh`
3. Update `gen_physio_therapists.go` — add `UserId: email`
4. Update `gen_physio_clients.go` — add `UserId: email` (field exists in proto but mock doesn't set it yet)
5. No other mock generators affected — `userId` only exists on PhysioTherapist and PhysioClient
6. Verify: `go build ./...`

**No changes to go.mod or vendor.**

## Phase 2 — Security Helper Package

Create `go/physio/security/security.go` with three things:

### 1. RegisterUser
```go
func RegisterUser(email, password string, vnic ifs.IVNic) {
    if email == "" { return }
    err := vnic.Resources().Security().Register(email, password, "", vnic)
    if err != nil {
        fmt.Printf("[security] Failed to register user %s: %v\n", email, err)
    }
}
```

### 2. DeactivateUser
```go
func DeactivateUser(email string, vnic ifs.IVNic) {
    if email == "" { return }
    update := map[string]interface{}{
        "userId":        email,
        "accountStatus": 2, // ACCOUNT_STATUS_INACTIVE
    }
    resp := vnic.Request("", "users", byte(73), ifs.PATCH, update, 10)
    if resp != nil && resp.Error() != nil {
        fmt.Printf("[security] Failed to deactivate user %s: %v\n", email, resp.Error())
    }
}
```

### 3. NewSecurityCallback (reusable wrapper — eliminates duplicate code)
```go
// NewSecurityCallback wraps a base IServiceCallback with security hooks.
// On POST: registers a user via ISecurityProvider.Register().
// On DELETE: deactivates the user via PATCH to Users service.
// getEmail extracts the email from the entity for the security operation.
func NewSecurityCallback(base ifs.IServiceCallback, getEmail func(interface{}) string) ifs.IServiceCallback {
    return &securityCallback{base: base, getEmail: getEmail}
}

type securityCallback struct {
    base     ifs.IServiceCallback
    getEmail func(interface{}) string
}

func (cb *securityCallback) Before(elem interface{}, action ifs.Action, cont bool, vnic ifs.IVNic) (interface{}, bool, error) {
    return cb.base.Before(elem, action, cont, vnic)
}

func (cb *securityCallback) After(elem interface{}, action ifs.Action, cont bool, vnic ifs.IVNic) (interface{}, bool, error) {
    if !cont {
        return nil, true, nil
    }
    email := cb.getEmail(elem)
    switch action {
    case ifs.POST:
        go RegisterUser(email, "12345678", vnic)
    case ifs.DELETE:
        go DeactivateUser(email, vnic)
    }
    return nil, true, nil
}
```

**Key design decisions:**
- Only imports `github.com/saichler/l8types/go/ifs` and `fmt` — no l8secure dependency
- `NewSecurityCallback` is a generic wrapper — both callbacks use it, zero duplicate behavioral code
- Default password: `"12345678"` (matches existing mock Phase 6 pattern with `"1234"` updated to match security-rbac plan)
- Both `RegisterUser` and `DeactivateUser` are fire-and-forget with error logging
- `getEmail` function parameter avoids the security package needing to know about physio types (no circular imports)

## Phase 3 — Service Callbacks

### `PhyClientServiceCallback.go`
Change only `newPhyClientServiceCallback()` — wrap with security:
```go
func newPhyClientServiceCallback() ifs.IServiceCallback {
    base := l8c.NewServiceCallback(
        "PhysioClient",
        func(e interface{}) bool { _, ok := e.(*physio.PhysioClient); return ok },
        setPhyClientID,
        validatePhyClient,
    )
    return security.NewSecurityCallback(base, func(e interface{}) string {
        if c, ok := e.(*physio.PhysioClient); ok { return c.Email }
        return ""
    })
}
```

### `PhyTherapistServiceCallback.go`
Same pattern:
```go
func newPhyTherapistServiceCallback() ifs.IServiceCallback {
    base := l8c.NewServiceCallback(
        "PhysioTherapist",
        func(e interface{}) bool { _, ok := e.(*physio.PhysioTherapist); return ok },
        setPhyTherapistID,
        validatePhyTherapist,
    )
    return security.NewSecurityCallback(base, func(e interface{}) string {
        if t, ok := e.(*physio.PhysioTherapist); ok { return t.Email }
        return ""
    })
}
```

No other changes to these files — `setID`, `validate` functions stay the same.

**No circular imports** — security package only imports `ifs` and `fmt`. Callback files import security but security does not import clients/therapists.

## Phase 4 — Verification

### Build
- [ ] `go build ./...` passes
- [ ] `go vet ./...` passes
- [ ] `go.mod` has NO new dependencies

### Functional (with `run-local.sh`)
- [ ] System starts without errors
- [ ] Mock data loads — clients and therapists have `userId` populated in detail views
- [ ] Create a new client via admin UI:
  - [ ] Client record created successfully
  - [ ] Server logs show `[security]` register call (or no error if ShallowSecurityProvider)
  - [ ] When running with real security provider: new user visible in System > Security > Users
- [ ] Create a new therapist via admin UI:
  - [ ] Therapist record created successfully
  - [ ] Server logs show `[security]` register call
- [ ] Delete a client via admin UI:
  - [ ] Client record deleted successfully
  - [ ] Server logs show `[security]` deactivate call (or no error if Users service not available)
  - [ ] When running with real security provider: user status changed to INACTIVE in System > Security > Users
- [ ] Delete a therapist via admin UI:
  - [ ] Therapist record deleted successfully
  - [ ] Server logs show `[security]` deactivate call
- [ ] Existing CRUD operations still work (no regression from callback wrapping)

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `proto/physio.proto` | **Modify** — add `user_id = 9` to PhysioTherapist |
| `go/types/physio/physio.pb.go` | **Regenerate** |
| `go/tests/mocks/gen_physio_therapists.go` | **Modify** — add `UserId: email` |
| `go/tests/mocks/gen_physio_clients.go` | **Modify** — add `UserId: email` |
| `go/physio/security/security.go` | **Create** — `RegisterUser`, `DeactivateUser`, `NewSecurityCallback` |
| `go/physio/clients/PhyClientServiceCallback.go` | **Modify** — wrap with `security.NewSecurityCallback` |
| `go/physio/therapists/PhyTherapistServiceCallback.go` | **Modify** — wrap with `security.NewSecurityCallback` |

## What This Does NOT Change
- No new entries in `go.mod` — only uses existing `l8types` dependency
- No changes to `main.go`
- No changes to `run-local.sh`
- No changes to `vendor/`
- No changes to web UI — `userId` is not displayed in physio forms/columns
- Mock Phase 6 left as-is

## Known Risks

| Risk | Mitigation |
|------|-----------|
| `ShallowSecurityProvider.Register()` is a no-op | Expected in local dev — users are created by mock Phase 6 via HTTP `/register` |
| `vnic.Request()` for deactivation may fail if Users service not running | Logged as warning, doesn't block the DELETE operation (async via `go`) |
| `genericCallback.After()` skips POST/DELETE | Bypassed by `NewSecurityCallback` implementing `IServiceCallback` directly |
| Default password `"12345678"` is weak | Acceptable for dev; production should enforce password change on first login |
