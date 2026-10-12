# l8physio E2E Tests

End-to-end tests for l8physio using Playwright.

## Test Structure

```
e2e/
├── tests/
│   ├── auth/          # Authentication tests
│   │   └── login.spec.ts
│   ├── ui/            # All UI feature tests
│   │   ├── dashboard.spec.ts
│   │   ├── therapists.spec.ts
│   │   ├── clients.spec.ts
│   │   ├── exercises.spec.ts
│   │   ├── protocols.spec.ts
│   │   ├── plans.spec.ts
│   │   ├── appointments.spec.ts
│   │   ├── progress.spec.ts
│   │   ├── reports.spec.ts
│   │   ├── feedback.spec.ts
│   │   ├── boostapp.spec.ts
│   │   ├── workout-builder.spec.ts
│   │   └── all-ui.spec.ts
│   ├── api/           # API endpoint tests
│   │   └── rest.spec.ts
│   └── kind/          # KIND cluster deployment tests
│       └── deployment.spec.ts
├── playwright.config.ts
├── package.json
├── Makefile
└── .env.example
```

## Running Tests

### Prerequisites

- Node.js 18+
- Playwright browsers: `npx playwright install chromium`
- For KIND tests: Docker, kind, kubectl

### Local Tests

```bash
cd e2e
make install
npx playwright test
```

### KIND Cluster Tests

```bash
make kind
```

This will:
1. Create a KIND cluster
2. Deploy all l8physio services
3. Run E2E tests against the cluster
4. Clean up the cluster

### Available Commands

| Command | Description |
|---------|-------------|
| `make install` | Install dependencies |
| `make test` | Run all tests |
| `make test:headed` | Run tests with visible browser |
| `make test:ui` | Run tests with Playwright UI |
| `make kind` | Deploy to KIND and run tests |

## Configuration

Copy `.env.example` to `.env` and update values:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `BASE_URL` | Base URL for tests (default: http://localhost:8080) |
| `TEST_EMAIL` | Test user email |
| `TEST_PASSWORD` | Test user password |
| `KIND_CLUSTER_NAME` | Name for KIND cluster |

## Test Coverage

### Authentication
- Login form display
- Empty credential rejection
- Invalid credential rejection
- Successful login redirect
- Session persistence

### All UI Features (12 sections)
- **Dashboard (htdash)** - Display and load
- **Therapists** - Table display, filtering, sorting, CRUD
- **Clients** - Table display, filtering, assignment
- **Exercises** - Table display, category/equipment filters
- **Protocol Templates** - Table display, CRUD
- **Treatment Plans** - Table display, circuit display, exercise management
- **Appointments** - Table display, date range filter
- **Progress Logs** - Table display, date range filter
- **Session Reports** - Table display, statistics
- **Home Feedback** - Table display
- **Boostapp Calendar** - Calendar display, schedule
- **Workout Builder** - Interface display, circuit creation

### API
- Health endpoint
- Registry endpoint
- Client CRUD operations
- Soft delete

### KIND Deployment
- Cluster creation
- Service deployment
- Pod readiness
- UI accessibility
