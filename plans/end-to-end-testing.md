# End-to-End Testing Plan for l8physio

## Context

Per `VerifyPrdCompletenessBeforeDone` and `FailFastNoSilentFallback` rules, l8physio needs comprehensive end-to-end testing to ensure:
- All services work end-to-end from UI to database
- Security rules are enforced at every layer
- VNic communication is reliable
- Mobile and desktop UIs behave identically
- KIND deployment works without issues

Current state: Only 2 auth tests exist (`auth_routes_test.go`). This is insufficient for a production system.

---

## Test Suite Structure

```
go/tests/
├── e2e/                    # End-to-end integration tests
│   ├── api/               # API endpoint tests
│   ├── services/          # Service layer tests
│   ├── security/          # Security rule enforcement
│   └── navigation/        # UI navigation tests
├── fixtures/              # Test data fixtures
│   ├── clients.go
│   ├── therapists.go
│   ├── exercises.go
│   ├── plans.go
│   └── appointments.go
└── mocks/                 # Mock VNic, database, auth
```

---

## Phase 1: Service Layer E2E Tests (5-7 days)

### 1.1 Client Service Tests

**Test cases**:
- ✅ Create client with all required fields
- ✅ Create client with invalid email (expect validation error)
- ✅ Create client with duplicate email (expect unique constraint error)
- ✅ GET client by ID
- ✅ GET client by therapistId filter
- ✅ PUT client update
- ✅ DELETE client (soft delete via isActive flag)
- ✅ Query clients with L8QL: `SELECT * FROM PhysioClient WHERE therapistId = ?`
- ✅ Pagination: `LIMIT 10 PAGE 2`
- ✅ Sorting: `SORT BY firstName ASC`

**File**: `go/tests/e2e/services/client_test.go`

### 1.2 Therapist Service Tests

**Test cases**:
- ✅ Create therapist with full name
- ✅ GET therapist by ID
- ✅ GET therapist by specialty filter
- ✅ PUT therapist update
- ✅ Query with L8QL: `SELECT therapistId, firstName, lastName FROM PhysioTherapist WHERE isActive = 1`

**File**: `go/tests/e2e/services/therapist_test.go`

### 1.3 Exercise Service Tests

**Test cases**:
- ✅ Create exercise with categories, equipment, instructions
- ✅ GET exercise by ID
- ✅ Query exercises by category: `WHERE category = 2`
- ✅ Query exercises by equipment: `WHERE equipment = 3`
- ✅ GET exercise list with pagination

**File**: `go/tests/e2e/services/exercise_test.go`

### 1.4 Plan Service Tests

**Test cases**:
- ✅ Create treatment plan with exercises
- ✅ GET plan by ID
- ✅ GET plan with client relationship
- ✅ PUT plan update (add/remove exercises)
- ✅ Query plans by client: `WHERE clientId = ?`
- ✅ Query plans by status: `WHERE status = 2`

**File**: `go/tests/e2e/services/plan_test.go`

### 1.5 Appointment Service Tests

**Test cases**:
- ✅ Create appointment with all fields
- ✅ GET appointment by ID
- ✅ GET appointments by client
- ✅ GET appointments by therapist
- ✅ Query with date range: `WHERE apptDate >= ? AND apptDate <= ?`
- ✅ GET appointments for today

**File**: `go/tests/e2e/services/appointment_test.go`

### 1.6 Progress Log Service Tests

**Test cases**:
- ✅ Create progress log with pain level, notes
- ✅ GET progress log by ID
- ✅ GET progress logs by client
- ✅ GET progress logs by exercise
- ✅ Query with date range

**File**: `go/tests/e2e/services/progress_test.go`

---

## Phase 2: Security E2E Tests (2-3 days)

### 2.1 Authentication Tests

**Test cases**:
- ✅ POST /auth with valid credentials → returns 200 with bearer token
- ✅ POST /auth with invalid credentials → returns 401
- ✅ POST /auth with disabled account → returns 401
- ✅ GET /permissions without auth → returns 401 (already tested)
- ✅ GET /permissions with auth → returns 200 with roles

**File**: `go/tests/e2e/security/auth_test.go`

### 2.2 Authorization Tests

**Test cases**:
- ✅ Therapist can GET own clients
- ✅ Therapist CANNOT GET other therapists' clients
- ✅ Client can GET own plans
- ✅ Client can GET own appointments
- ✅ Admin can GET all entities
- ✅ Deny rules apply to L8Query filters

**File**: `go/tests/e2e/security/authorization_test.go`

### 2.3 Session Management Tests

**Test cases**:
- ✅ Bearer token expired → 401 on next request
- ✅ Remember me checkbox persists token to localStorage
- ✅ Logout clears sessionStorage and redirects to login

**File**: `go/tests/e2e/security/session_test.go`

---

## Phase 3: VNic Communication Tests (2-3 days)

### 3.1 Service Discovery Tests

**Test cases**:
- ✅ VNic starts and connects to overlay network
- ✅ Services register with VNet
- ✅ Services discover each other via multicast
- ✅ Leader election works (single leader for StatefulSet)

**File**: `go/tests/e2e/vnic/discovery_test.go`

### 3.2 Request/Response Tests

**Test cases**:
- ✅ POST request to client service → returns 200 with created entity
- ✅ GET request to client service → returns 200 with entity list
- ✅ PUT request to client service → returns 200 with updated entity
- ✅ DELETE request to client service → returns 200 with deleted entity
- ✅ Query with L8QL AST → returns filtered results
- ✅ Request timeout handling (circuit breaker)

**File**: `go/tests/e2e/vnic/communication_test.go`

### 3.3 Transaction Tests

**Test cases**:
- ✅ 2-phase commit succeeds
- ✅ Transaction rollback on error
- ✅ Concurrent updates handled correctly

**File**: `go/tests/e2e/vnic/transactions_test.go`

---

## Phase 4: API Endpoint Tests (1-2 days)

### 4.1 REST API Tests

**Test cases**:
- ✅ GET /0/Health → returns 200 with status
- ✅ GET /0/Registry → returns 200 with registered types
- ✅ POST /0/PhyClient → creates client
- ✅ GET /0/PhyClient/{id} → returns client
- ✅ PUT /0/PhyClient/{id} → updates client
- ✅ DELETE /0/PhyClient/{id} → soft deletes client
- ✅ Query /0/PhyClient with L8QL in body

**File**: `go/tests/e2e/api/rest_test.go`

### 4.2 WebSocket Tests

**Test cases**:
- ✅ Connect to /ws with bearer token
- ✅ Subscribe to client updates
- ✅ Receive real-time notifications
- ✅ Disconnect gracefully

**File**: `go/tests/e2e/api/websocket_test.go`

---

## Phase 5: UI Integration Tests (2-3 days)

### 5.1 Desktop UI Tests

**Test cases**:
- ✅ Navigate to Physiotherapy section
- ✅ Load Therapists table
- ✅ Filter therapists by name
- ✅ Sort therapists by lastName
- ✅ Open therapist edit form
- ✅ Save therapist changes
- ✅ Navigate to Clients section
- ✅ Create new client
- ✅ Assign client to therapist
- ✅ Navigate to Plans section
- ✅ Create treatment plan
- ✅ Add exercises to plan
- ✅ Save plan

**File**: `go/tests/e2e/ui/desktop_test.go`

### 5.2 Mobile UI Tests

**Test cases**:
- ✅ Navigate to Physiotherapy section
- ✅ Load Clients list
- ✅ Filter clients
- ✅ Open client detail
- ✅ View client exercises
- ✅ Navigate to Plans list
- ✅ Open plan editor
- ✅ Save plan

**File**: `go/tests/e2e/ui/mobile_test.go`

---

## Phase 6: Deployment E2E Tests (1-2 days)

### 6.1 KIND Deployment Tests

**Test cases**:
- ✅ `kind-start.sh` creates cluster successfully
- ✅ All pods start and become Ready
- ✅ VNet service registers with VNet
- ✅ All services discover each other
- ✅ Login page loads and redirects to /app.html
- ✅ Authenticate with test user
- ✅ Client can see their data
- ✅ Therapist can see their clients
- ✅ Admin can see all data
- ✅ `kind-stop.sh` cleans up cluster

**File**: `go/tests/e2e/deployment/kind_test.go`

---

## Test Infrastructure

### Fixtures

Generate test data for all entity types:

```go
// go/tests/fixtures/clients.go
func CreateTestClient(t *testing.T, vnic ifs.IVNic) *physio.PhysioClient {
    client := &physio.PhysioClient{
        FirstName:      "John",
        LastName:       "Doe",
        Email:          fmt.Sprintf("john.doe.%d@test.com", time.Now().UnixNano()),
        TherapistId:    "therapist-1",
        Status:         physio.PhysioClientStatus_PHYSIO_CLIENT_STATUS_ACTIVE,
        DateOfBirth:    "1990-01-01",
        Phone:          "+15551234567",
        AddressLine1:   "123 Main St",
        City:           "Los Angeles",
        StateProvince:  "CA",
        PostalCode:     "90001",
        CountryCode:    "US",
        Notes:          "Test client for E2E",
        InsuranceCarrier: "Aetna",
        PolicyNumber:   "ABC123456",
    }
    _, err := l8c.PostEntity("clients", 50, client, vnic)
    require.NoError(t, err)
    return client
}
```

### Mock VNic

For isolated service testing without actual network:

```go
// go/tests/mocks/vnic.go
type MockVNic struct {
    ifs.IVNic
    registeredServices map[string]ifs.IService
}

func (m *MockVNic) RegisterService(service ifs.IService) {
    m.registeredServices[service.ServiceName()] = service
}
```

### Test Database

Use Docker Compose for test database:

```yaml
# go/tests/fixtures/docker-compose.yml
version: '3.8'
services:
  test-db:
    image: postgres:15
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: test
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test"]
```

---

## Success Criteria

- [ ] All service layer tests pass (100% coverage for CRUD operations)
- [ ] All security tests pass (authentication, authorization, session management)
- [ ] All VNic communication tests pass (discovery, request/response, transactions)
- [ ] All API endpoint tests pass (REST, WebSocket)
- [ ] All UI integration tests pass (desktop and mobile)
- [ ] KIND deployment succeeds with all services operational
- [ ] Test suite runs in <10 minutes on CI
- [ ] Test coverage report shows ≥80% for service layer

---

## Tools

### Go Testing
- `testing` package (standard library)
- `testify/assert` for assertions
- `testify/mock` for mocks

### Integration Testing
- Docker Compose for test infrastructure
- `k8s.io/client-go` for KIND cluster tests

### Coverage
- `go test -coverprofile=coverage.out`
- `go tool cover -html=coverage.out`

---

## Notes

- Follow the existing `auth_routes_test.go` pattern
- Use `l8c.PostEntity()`, `l8c.GetEntity()`, `l8c.Query()` for service calls
- Use `l8c.NewVNic()` for integration tests with VNic
- Mock external dependencies (database, auth) for unit tests
- Use descriptive test names: `Test<Client><Operation><Scenario>`
