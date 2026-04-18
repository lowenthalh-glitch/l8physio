# Boostapp Refactor: Use l8collector + l8parser + l8inventory

## Problem

The `go/physio/boostapp/` package duplicates collection infrastructure that already exists in the Layer 8 ecosystem:

| Concern | Ecosystem Component | Boostapp (duplicated) |
|---------|--------------------|-----------------------|
| HTTP collection | `l8collector` → `RestCollector` | `boostapp_client.go` (300 lines): custom `Client` struct with cookie jar, CSRF, session management |
| Data conversion | `l8parser` → parsing rules + `ParsingService` | `boostapp_convert.go` (114 lines): ad-hoc `ConvertEvent`, `ConvertAll`, `ConvertParticipants` |
| Entity matching/linking | `l8inventory` → `InventoryService.Get()` with queries | `boostapp_linker.go` (62 lines): manual phone/name normalization + in-memory matching |
| Persistence | `l8inventory` → distributed cache + forwarding | `main.go` (381 lines): direct `l8c.PostEntity` calls in a loop |

Total duplicated code: ~857 lines across 4 files + the 381-line main that orchestrates it all.

## Existing Proto & UI Status

The following already exist and are **compliant** — no proto or UI changes needed:

- **Proto types**: `BoostappCalendarEvent`, `BoostappCalendarEventList` (with `repeated list = 1` + `l8api.L8MetaData metadata = 2`), `BoostappParticipant` — defined in `proto/physio.proto`
- **Enums**: `BoostappEventType` (zero value: `BOOSTAPP_EVENT_TYPE_UNSPECIFIED = 0`), `BoostappEventStatus` (zero value: `BOOSTAPP_EVENT_STATUS_UNSPECIFIED = 0`) — compliant with `proto-enum-zero-value` rule
- **UI forms**: `BoostappCalendarEvent` form in `physio-forms-shared.js` (read-only detail view with inline participants table)
- **UI config**: Desktop config in `physio-config.js` (`svc('boostapp', ..., '/50/BstpCal', 'BoostappCalendarEvent')`)
- **Mobile nav**: `physio-nav-config.js` (endpoint `/50/BstpCal`, `readOnly: true`, `supportedViews: ['table', 'calendar']`)
- **Prime object compliance**: `BoostappCalendarEvent` references `PhysioClient` via ID only (`physio_client_id` string field), `BoostappParticipant` is embedded as `repeated` child — no direct struct references between Prime Objects

This refactor is **backend-only** — it changes how events are collected, parsed, and persisted, not how they are displayed.

## Credential Provisioning

Boostapp login credentials (email, password, branchID) are provisioned through the **Security API** — the same `ISecurityProvider` channel used by the l8ui Security section. The current code loads them via:
```go
res.Security().Credential("boostapp", "login", res)
```
This is compliant with `security-provisioning-channels` rule. Post-refactor, the same credentials will be read from the security provider and passed to the `RestCollector` via `L8PHostProtocol.AuthInfo` fields (`ApiUser` for email, `ApiKey` for password) or via the `CredId` reference.

## What Should Change

### 1. Extend `RestCollector` to support cookie/session-based auth

The existing `RestCollector` in `l8collector/go/collector/protocols/rest/` handles generic REST collection. Its current `Connect()` is a no-op and `Init()` creates a plain `http.Client` with no cookie jar.

Boostapp needs cookie-based session auth:
- Cookie jar for session cookies + a mandatory `screen_width` cookie
- Login via POST to `/office/ajax/login/login.php` (JSON body, not token-based)
- CSRF token extraction from HTML (`/office/calendar.php`) via regex
- Session keepalive via `EnsureSession()` before each request
- CSRF header (`X-CSRF-Token`) on participant requests

The `L8PHostProtocol.AuthInfo` already has `NeedAuth`, `AuthBody`, `AuthPath`, `AuthUserField`, `AuthPassField`, `AuthResp`, and `AuthToken` fields. These can be leveraged:

| AuthInfo Field | Boostapp Usage |
|---------------|----------------|
| `NeedAuth` | `true` |
| `AuthPath` | `/office/ajax/login/login.php` |
| `AuthBody` | `{"username":"{{user}}","password":"{{pass}}","action":"loginByEmail"}` |
| `AuthUserField` | `username` |
| `AuthPassField` | `password` |
| `AuthResp` | `success` (field to check in response) |

**What needs to be added to `RestCollector`:**

1. **Cookie jar support in `Init()`** — when `AuthInfo.NeedAuth` is true and auth type is session-based, create the `http.Client` with a `cookiejar.New()` instead of a plain client. A new field on `AuthInfo` (`SessionAuth bool`) distinguishes cookie-based auth from token-based auth.

2. **Session login in `Connect()`** — when session auth is configured, POST the login payload to `AuthPath`, validate the response using `AuthResp`, then visit a follow-up page to establish full session context. Currently `Connect()` is a no-op; this adds the auth handshake.

3. **CSRF extraction in `Connect()`** — after login, fetch the session-establishing page (configured via `AuthInfo.CsrfSource`) and extract the CSRF token via regex (`AuthInfo.CsrfPattern`). Store it on the collector for use in subsequent requests.

4. **Session keepalive in `Exec()`** — before executing a job, call `EnsureSession()` to verify the session is still valid. If expired, re-login.

5. **CSRF header injection in `Exec()`** — when a CSRF token is present, add `X-CSRF-Token` header to requests.

6. **Form-encoded POST support in `Exec()`** — the current `Exec()` assumes JSON content type. Boostapp's calendar endpoint uses `application/x-www-form-urlencoded`. The `parseWhat()` format (`METHOD::endpoint::body`) needs to support form bodies, or a new job field indicates content type.

**What does NOT change in `RestCollector`:**
- The `ProtocolCollector` interface — no changes needed
- The `Protocol()` return value — stays `L8PRESTAPI`
- Basic non-session REST collection — all existing behavior untouched when `SessionAuth` is false

### 2. Replace `boostapp_convert.go` with l8parser parsing rules

The `l8parser` framework uses a rule-based system where `ParsingService.Post()` receives raw collection job results (`CJob`) and applies registered parsing rules to produce structured protobuf entities.

**New parsing rules to create:**
- `BoostappCalendarRule` — converts CJob raw JSON → `physio.BoostappCalendarEvent` list (replaces `ConvertEvent`/`ConvertAll`)
  - Includes event type mapping (replaces `convertEventType`)
  - Includes status mapping (replaces `convertEventStatus`)
  - Includes participant conversion (replaces `ConvertParticipants`)
- Phone normalization + client linking moves to a post-parse step (see below)

These rules implement the `ParsingRule` interface from `l8parser/go/parser/rules/` and are registered with the `Parser` singleton. This follows the existing pattern — l8parser already contains project-specific rules that import project types (e.g., `IfTableToPhysicals` imports `probler/go/types`, `RestGpuParse` handles GPU-specific JSON). The Boostapp JSON DTO types (`BoostappCalendarResponse`, `BoostappEvent`, etc.) will live in `l8physio/go/types` and be imported by the parsing rule.

### 3. Replace `boostapp_linker.go` with l8inventory queries

Currently `LinkClients` does:
1. Fetches ALL `PhysioClient` records into memory
2. Builds phone→client and name→client maps
3. Matches each event's `ClientPhone`/`ClientName` against these maps
4. Sets `PhysioClientId` on matched events

With `l8inventory`, this becomes:
1. `InventoryService` for `PhysioClient` is already activated (it's an existing service)
2. After parsing produces events, query the inventory: `select * from PhyClient where phone=<normalized_phone>`
3. Or use the existing `l8c.GetEntities` with a proper L8Query filter instead of fetching ALL clients

**Note:** The phone normalization logic (`normalizePhone`) is domain-specific and stays — it moves into `go/physio/common/phone.go`.

### 4. Replace the `main.go` orchestration with ecosystem service wiring

Currently `main.go` has 3 modes:
- `--fetch` (standalone): HTTP fetch → print (debugging tool)
- `--push` (push): HTTP fetch → POST to physio server via HTTP
- Connected mode: vnet → sync loop → fetch → convert → link → post

The connected mode should be replaced with standard ecosystem wiring:
- `CollectorService.Activate()` starts the `RestCollector` with Boostapp session-auth config
- Collector `Exec()` produces `CJob` results with raw JSON
- `ParsingService.Post()` receives jobs, applies `BoostappCalendarRule`, produces events
- Parsed events flow to `InventoryService` for caching + persistence

The `--fetch` and `--push` CLI modes are **deleted** — post-refactor, debugging goes through the normal connected mode with a local target. If standalone testing is needed, integration tests in `go/tests/` serve that purpose.

## Gap Analysis

| # | Area | Gap | Severity |
|---|------|-----|----------|
| G1 | l8collector RestCollector | `Connect()` is a no-op — needs session auth login flow | Must fix |
| G2 | l8collector RestCollector | `Init()` creates plain `http.Client` — needs cookie jar when `SessionAuth=true` | Must fix |
| G3 | l8collector RestCollector | `Exec()` only supports JSON content type — needs form-encoded POST | Must fix |
| G4 | l8collector RestCollector | No CSRF token handling — needs extraction + header injection | Must fix |
| G5 | l8collector RestCollector | No session keepalive — needs `EnsureSession()` before each `Exec()` | Must fix |
| G6 | l8pollaris proto AuthInfo | Missing fields: `session_auth`, `session_page`, `csrf_source`, `csrf_pattern`, `preset_cookies` | Must fix |
| G7 | l8parser | No `BoostappCalendarRule` parsing rule | Must create |
| G8 | l8physio boostapp | `boostapp_convert.go` ad-hoc conversion duplicates parser pattern | Must delete after G7 |
| G9 | l8physio boostapp | `boostapp_linker.go` in-memory client matching duplicates inventory query | Must delete after G7 |
| G10 | l8physio boostapp | `boostapp_client.go` custom HTTP client duplicates RestCollector | Must delete after G1-G5 |
| G11 | l8physio boostapp/main | Manual sync loop + `--fetch`/`--push` CLI modes duplicate ecosystem patterns | Must delete/simplify |
| G12 | l8physio common | `normalizePhone` utility buried in boostapp package — needs extraction | Must move |
| G13 | l8physio services | No collector/parser/inventory activation for Boostapp target | Must wire |
| G14 | l8pollaris proto | Proto change requires `make-bindings.sh` regeneration | Must run |
| G15 | l8physio vendor | After l8pollaris proto change, l8collector and l8physio vendors must be refreshed | Must run |

## Traceability Matrix

| # | Gap | Resolution | Phase |
|---|-----|-----------|-------|
| G1 | RestCollector `Connect()` no-op | Add session auth login flow | Phase 1 |
| G2 | RestCollector no cookie jar | Add `cookiejar.New()` in `Init()` when `SessionAuth=true` | Phase 1 |
| G3 | RestCollector JSON-only | Add form-encoded POST support in `Exec()` | Phase 1 |
| G4 | RestCollector no CSRF | Add CSRF extraction in `Connect()` + header injection in `Exec()` | Phase 1 |
| G5 | RestCollector no keepalive | Add `EnsureSession()` method, call before each `Exec()` | Phase 1 |
| G6 | AuthInfo missing fields | Add 5 new fields to l8pollaris proto | Phase 1 |
| G14 | Proto regeneration | Run `make-bindings.sh` in l8pollaris after proto change | Phase 1 |
| G15 | Vendor refresh | Refresh vendors in l8collector and l8physio after proto regen | Phase 1 |
| G7 | No BoostappCalendarRule | Create parsing rule in l8parser | Phase 2 |
| G12 | `normalizePhone` buried | Extract to `go/physio/common/phone.go` | Phase 2 |
| G8 | `boostapp_convert.go` duplication | Delete after parsing rule is verified | Phase 4 |
| G9 | `boostapp_linker.go` duplication | Delete after inventory query replaces in-memory matching | Phase 4 |
| G13 | No ecosystem service wiring | Add collector/parser/inventory activation in `services.go` | Phase 3 |
| G11 | Manual sync loop + CLI modes | Delete `--fetch`/`--push` modes, simplify `main.go` to ecosystem wiring only | Phase 3 |
| G10 | `boostapp_client.go` duplication | Delete after RestCollector session auth is verified | Phase 4 |

## Phase Breakdown

### Phase 1: Extend `RestCollector` with session-based auth

**Step 1a: Modify l8pollaris proto**

Add fields to `AuthInfo` in the l8pollaris proto:
```protobuf
message AuthInfo {
  // ... existing fields 1-10 ...
  bool session_auth = 11;
  string session_page = 12;
  string csrf_source = 13;
  string csrf_pattern = 14;
  map<string, string> preset_cookies = 15;
}
```

**Step 1b: Regenerate protobuf bindings**
```bash
cd <l8pollaris>/proto && ./make-bindings.sh
```
Verify `go/types/l8tpollaris/targets.pb.go` contains the new `AuthInfo` fields. Then `go build ./...` in l8pollaris to confirm compilation.

**Step 1c: Vendor refresh**
```bash
cd <l8collector>/go && rm -rf go.sum go.mod vendor && go mod init && GOPROXY=direct GOPRIVATE=github.com go mod tidy && go mod vendor
cd <l8physio>/go && rm -rf go.sum go.mod vendor && go mod init && GOPROXY=direct GOPRIVATE=github.com go mod tidy && go mod vendor
```

**Step 1d: Modify RestCollector in l8collector**

File: `go/collector/protocols/rest/RestCollector.go`

- `Init()` — when `AuthInfo.SessionAuth` is true, create `http.Client` with `cookiejar.New()`. Apply `PresetCookies` to the jar.
- `Connect()` — when session auth is configured:
  1. POST login payload to `AuthPath` using `AuthBody` template with credentials substituted
  2. Validate response (check `AuthResp` field for success)
  3. Fetch `AuthInfo.SessionPage` to establish full session context
  4. Extract CSRF token from `AuthInfo.CsrfSource` page using `AuthInfo.CsrfPattern` regex
  5. Store CSRF token on the collector struct
- `Exec()` — before executing:
  1. Call `EnsureSession()` (check session validity, re-login if expired)
  2. If CSRF token is present, add `X-CSRF-Token` header
  3. Support form-encoded POST via content type detection in `parseWhat()` format
- Add `EnsureSession()` method — GET the session page, check for redirect → if redirected, call `Connect()` again
- Add `refreshCSRF()` method — fetch CSRF source page, extract token via configured regex

All new code paths are gated by `SessionAuth=true` — existing non-session REST collection is untouched.

**Step 1e: Verify**
```bash
cd <l8collector>/go && go build ./...
```
Run existing collector tests to confirm no regression.

### Phase 2: Create Boostapp parsing rules for l8parser

**Files to create in l8parser:**
- `go/parser/rules/BoostappCalendarRule.go` — parsing rule implementing `rules.ParsingRule`
  - Imports `l8physio/go/types` for proto types and `l8physio/go/physio/boostapp` for JSON DTO types (same pattern as `IfTableToPhysicals` importing `probler/go/types`)
  - `Parse(job, entity, resources)` — deserializes CJob raw JSON into `BoostappCalendarResponse`, converts each `BoostappEvent` → `physio.BoostappCalendarEvent` proto
  - Handles event type mapping (int/string → `BoostappEventType` enum)
  - Handles status mapping (string → `BoostappEventStatus` enum)
  - Handles participant conversion (embedded in class event jobs)

**Files to keep in l8physio (already exist):**
- `go/physio/boostapp/boostapp_types.go` — Boostapp JSON DTO structs (`BoostappCalendarResponse`, `BoostappEvent`, `BoostappCustomer`, `BoostappStatistics`). These are imported by the l8parser rule. No duplication.

**Files to create in l8physio:**
- `go/physio/common/phone.go` — `NormalizePhone(phone string) string` utility (extracted from `boostapp_linker.go`)

**Vendor refresh in l8physio** after l8parser changes:
```bash
cd <l8physio>/go && rm -rf go.sum go.mod vendor && go mod init && GOPROXY=direct GOPRIVATE=github.com go mod tidy && go mod vendor
```

**Verify:**
```bash
cd <l8parser>/go && go build ./...
cd <l8physio>/go && go build ./...
```

### Phase 3: Wire ecosystem services and configure Boostapp target

**Files to modify:**
- `go/physio/services/services.go` — add activation calls:
  - `collector.Activate(linksID, vnic)` — starts `CollectorService` with `RestCollector`
  - `parser.Activate(linksID, &physio.BoostappCalendarEvent{}, persist, vnic)` — starts `ParsingService`
  - `inventory.Activate(linksID, &physio.BoostappCalendarEvent{}, &physio.BoostappCalendarEventList{}, vnic)` — starts `InventoryService`

- `BstpCalService.go` — may become the inventory service activation instead of a standalone l8common service, or remain as-is with inventory sitting in front

**Boostapp target configuration** — create an `L8PTarget` for Boostapp with:
```
Host:
  Protocol: L8PRESTAPI
  Addr: login.boostapp.co.il
  Port: 443
  HttpPrefix: /office
  AuthInfo:
    NeedAuth: true
    SessionAuth: true
    AuthPath: /office/ajax/login/login.php
    AuthBody: {"username":"{{user}}","password":"{{pass}}","action":"loginByEmail"}
    AuthUserField: username
    AuthPassField: password
    AuthResp: success
    SessionPage: /office/
    CsrfSource: /office/calendar.php
    CsrfPattern: csrf-token.*?content="([^"]+)"
    PresetCookies: {"screen_width": "1657"}
```

**Collection jobs (L8Poll definitions):**
- `boostapp-calendar` — `POST::/ajax/CalendarView.php::fun=GetClassesByStudioByDate&branchId=...&StartDate=...&EndDate=...` (form-encoded)
- `boostapp-participants` — `GET::/characteristics-popup.php?id={{eventId}}::` (per-event, triggered after calendar parse)

**Files to simplify:**
- `main/main.go` — becomes ~50 lines: create resources → connect vnet → activate services → wait. The collector handles the sync loop via `JobCadence`. The `--fetch` and `--push` CLI debugging modes are **deleted** — debugging uses the connected mode with a local target, and integration tests in `go/tests/` cover verification.

**Verify:**
```bash
cd <l8physio>/go && go build ./...
```

### Phase 4: Clean up

- Delete `go/physio/boostapp/boostapp_convert.go`
- Delete `go/physio/boostapp/boostapp_linker.go`
- Delete or reduce `go/physio/boostapp/boostapp_client.go` — if only `ParticipantsResponse`, `ParticipantRaw`, and JSON DTO types remain, merge them into `boostapp_types.go` and delete the file. If nothing remains, delete the file.
- Simplify `main.go` to ~50 lines (activate services + wait), delete `--fetch` and `--push` CLI modes

**Verify:**
```bash
cd <l8physio>/go && go build ./...
```

### Phase 5: End-to-End Verification

Systematic smoke-test of the full refactored system:

- [ ] **Compilation**: `go build ./...` passes in l8pollaris, l8collector, l8parser, l8physio (no binaries produced per `cleanup-test-binaries` rule)
- [ ] **RestCollector regression**: Existing non-session REST collectors still work (SessionAuth=false path untouched)
- [ ] **RestCollector session auth**: New session auth flow connects to Boostapp (Login → session → CSRF extraction)
- [ ] **RestCollector form-encoded POST**: Calendar fetch returns valid JSON via form-encoded POST
- [ ] **RestCollector CSRF header**: Participant fetch succeeds with CSRF header injection
- [ ] **Parsing rule**: `BoostappCalendarRule` converts raw CJob JSON → `BoostappCalendarEvent` protos with correct enum mappings
- [ ] **Participant parsing**: Class event jobs produce events with populated `participants` repeated field
- [ ] **Client linking**: Events with matching phone numbers have `physioClientId` populated via inventory query
- [ ] **Inventory persistence**: Parsed events flow through `InventoryService` to persistence (appear in BstpCal service)
- [ ] **Connected mode**: Start boostapp main in connected mode → events appear in BstpCal service after sync interval
- [ ] **CLI modes deleted**: `--fetch` and `--push` flags no longer exist; binary only runs in connected mode
- [ ] **UI parity**: Desktop and mobile Boostapp Calendar views still display events correctly (read-only, calendar view)
- [ ] **No dead code**: `boostapp_convert.go`, `boostapp_linker.go` deleted; `boostapp_client.go` deleted or merged into `boostapp_types.go`
- [ ] **File size**: All modified/created files under 500 lines per `maintainability` rule
- [ ] **run-local.sh**: If `go/run-local.sh` exists, verify it still works post-refactor (currently no `run-local.sh` exists in l8physio)

### Integration Tests

Per `test-location-and-approach` rule, integration tests must live in `go/tests/` and use the system API. Currently l8physio has no test files. The following tests should be created as part of this refactor:

- `go/tests/boostapp_sync_test.go` — integration test that:
  1. Sets up resources and vnic
  2. Activates collector, parser, and inventory services
  3. Posts a mock `L8PTarget` with Boostapp session-auth config
  4. Verifies the collector connects (or mock the Boostapp API)
  5. Verifies parsed events appear in the inventory service
  6. Verifies client linking populates `physioClientId`

**Note:** Testing against the real Boostapp API requires valid credentials. Tests should either use a mock HTTP server or be gated behind an environment variable (`BOOSTAPP_INTEGRATION=true`).

## Changes Required in l8pollaris Proto

The `AuthInfo` message needs new fields to support session-based auth:

```protobuf
message AuthInfo {
  // ... existing fields 1-10 ...
  // session_auth indicates cookie-based session authentication
  bool session_auth = 11;
  // session_page is the URL path to visit after login to establish session context
  string session_page = 12;
  // csrf_source is the URL path to fetch for CSRF token extraction
  string csrf_source = 13;
  // csrf_pattern is the regex pattern for CSRF token extraction
  string csrf_pattern = 14;
  // preset_cookies are cookies to pre-set on the cookie jar before login
  map<string, string> preset_cookies = 15;
}
```

After modifying the proto:
1. `cd <l8pollaris>/proto && ./make-bindings.sh` (ensure `-i` not `-it` on docker commands)
2. Verify `go/types/l8tpollaris/targets.pb.go` has new fields
3. `cd <l8pollaris>/go && go build ./...`
4. Vendor refresh in l8collector and l8physio (see Phase 1 Step 1c)
