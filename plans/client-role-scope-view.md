# Plan: Add Client Role with ${userId} Placeholder Support

## Context

When a PhysioClient is created, an L8User is also created. That user needs a single role (shared by all clients) that restricts them to viewing/editing only their own data. The current security provider uses static L8Query strings in deny rules, which required one role per client (10 roles for 10 clients). We need to support a `${userId}` placeholder in deny queries that resolves to the logged-in user's `L8User.userId` at runtime, enabling a single `client` role for all clients.

The convention is: `L8User.userId` will be set to the PhysioClient's `clientId` (e.g., `cli-001`), so deny queries like `clientId!=${userId}` will filter correctly.

## Changes

### 1. l8secure: Add ${userId} substitution in ScopeView

**File:** `../l8secure/go/secure/provider/ScopeView.go`

In the `ScopeView` method, when processing row-level deny attributes (key without "."), the value string (L8Query) may contain `${userId}`. Before parsing it with `interpreter.NewQuery`, substitute `${userId}` with the actual user's userId looked up from `aaaid`.

- Add a helper method to AAA: `getUserIdByToken(aaaid string) string` that does token-to-userId lookup (read-locked).
- In `ScopeView`, before the deny attribute loop, call `getUserIdByToken(aaaid)` to get the userId.
- In the row-filter branch (`!strings.Contains(key, ".")`), call `strings.ReplaceAll(value, "${userId}", userId)` before passing to `interpreter.NewQuery`.

**File:** `../l8secure/go/secure/provider/aaa.go`

Add method:
```go
func (aaa *AAA) getUserIdByToken(aaaid string) string {
    aaa.mu.RLock()
    defer aaa.mu.RUnlock()
    token, ok := aaa.tokens[aaaid]
    if !ok {
        return ""
    }
    return token.UserId
}
```

### 2. l8secure: Add client role to phy.json

**File:** `../l8secure/go/secure/plugin/phy/phy.json`

Add a single `client` role with:
- **Allow rules**: GET (action 5) on all physio types that clients should see, plus PUT/PATCH on types clients can edit.
- **Deny rules with row filter**: For each type with `clientId`, deny GET where `clientId!=${userId}` -- this removes rows not belonging to the logged-in client.
- **Deny field-level**: Hide `therapistNotes` on TreatmentPlan and Appointment (sensitive therapist-only fields).

Types needing `clientId!=${userId}` row scoping:
- `PhysioClient` -- deny `clientId!=${userId}`
- `TreatmentPlan` -- deny `clientId!=${userId}`
- `Appointment` -- deny `clientId!=${userId}`
- `ProgressLog` -- deny `clientId!=${userId}`
- `GeneratedWorkout` -- deny `clientId!=${userId}`
- `SessionReport` -- deny `clientId!=${userId}`
- `HomeFeedback` -- deny `clientId!=${userId}`

Types clients can view freely (no clientId, no scoping):
- `PhysioExercise` -- allow GET
- `PhysioProtocol` -- allow GET

### 3. l8physio mocks: Set L8User.userId to clientId

**File:** `go/tests/mocks/physio_phases.go`

Change `createUsersFromService` to use clientId as the userId instead of email:
- For clients: extract `clientId` from the PhysioClient record and use it as `userId` in the L8User POST.
- For therapists: extract `therapistId` similarly.
- Assign the `client` role to each created user.

## Verification

1. Build l8secure: `cd ../l8secure/go && go build ./...`
2. Build l8physio: `cd go && go build ./...`
3. Run the system, upload mocks, log in as a client user (userId=cli-001), verify:
   - GET PhysioClient returns only the client's own record
   - GET TreatmentPlan/Appointment/etc. returns only records with matching clientId
   - PhysioExercise and PhysioProtocol return all records (no scoping)
   - therapistNotes fields are blanked on TreatmentPlan and Appointment
