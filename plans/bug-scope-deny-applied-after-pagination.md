# Bug Report: row-level scope-deny rules are applied *after* SQL pagination

**Affected components:** `l8secure/go/secure/provider/ScopeView.go` (post-filter) and `l8services/go/services/manager/ServiceManager.go:127,165` (call site). The ORM (`l8orm`) and the SQL interpreter (`l8ql`) are involved insofar as the fix needs the deny query rewritten into the request's WHERE clause before paging.

**Severity:** correctness bug. Affects every role whose policy uses a row-level deny rule (`attributes: { <Type>: "select * from <Type> where …" }`) and any table that paginates server-side. With `pageSize=10` (desktop's `Layer8DTable` default) a scoped user can see **zero rows of their own data** when their row sorts past page 0. Reproducible on `main`.

---

## TL;DR

Row-level scope-deny rules are evaluated in `ScopeView` against the result set returned by the ORM. The ORM has already applied `limit … page …` by then, so any "user's own row" that fell on a later page is gone before `ScopeView` ever sees it. The fix is to inject the *inverse* of each scope-deny query into the request's `WHERE` clause **before** the ORM runs the query, so pagination operates on the already-scoped row set.

---

## Reproduction (live, on `main`)

The l8physio seed (`l8secure/.../plugin/phy/phy.json`) defines a `client` role with this scope-deny rule:

```json
"client-deny-physio-scope": {
  "elemType": "PhysioClient",
  "allowed": false,
  "actions": {},
  "attributes": {
    "PhysioClient": "select * from PhysioClient where clientId!=${userId}"
  }
}
```

Semantics: this query identifies the rows the client should *not* see. The mock data set has 45 clients (`cli-001 … cli-045`). Each `cli-NNN` user has `userId = clientId = cli-NNN`.

Start the demo, log in as `cli-011`, and run the exact queries that `Layer8DTable` (desktop) and `Layer8MEditTable` (mobile) issue:

```bash
HOST=<your host>
CLI=$(curl -sk -X POST https://$HOST:2774/auth \
  -H 'Content-Type: application/json' \
  -d '{"user":"cli-011","pass":"12345678"}' | grep -oP '"token":"\K[^"]+')

q() {
  body=$(python3 -c "import urllib.parse,json,sys; print(urllib.parse.quote(json.dumps({'text':sys.argv[1]})))" "$1")
  curl -sk "https://$HOST:2774/physio/50/PhyClient?body=$body" \
    -H "Authorization: Bearer $CLI" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(' ', [x['clientId'] for x in (d.get('list') or [])])"
}

echo 'no paging:                ';  q 'select * from PhysioClient'
echo 'page=0 limit=10:          ';  q 'select * from PhysioClient limit 10 page 0'
echo 'page=0 limit=10 by id:    ';  q 'select * from PhysioClient limit 10 page 0 sort-by clientId'
echo 'page=0 limit=10 by name:  ';  q 'select * from PhysioClient limit 10 page 0 sort-by lastName'
echo 'page=0 limit=15:          ';  q 'select * from PhysioClient limit 15 page 0'
echo 'page=0 limit=100:         ';  q 'select * from PhysioClient limit 100 page 0'
```

Observed (verified on the local demo):

```
no paging:                  ['cli-011']
page=0 limit=10:            []                    <-- BUG
page=0 limit=10 by id:      []                    <-- BUG
page=0 limit=10 by name:    ['cli-011']           (lexicographic luck)
page=0 limit=15:            ['cli-011']           (mobile pageSize=15)
page=0 limit=100:           ['cli-011']
```

A user fetching the page they're allowed to see, with the framework's own default page size, gets no data.

---

## End-user symptom

- Login to **desktop** (client portal `client-app.html`) as `cli-011` (or any client whose row sorts past index 9 by `clientId`) → "No data found" on the clients table.
- Login to **mobile** as the same user → works, because `Layer8MNavData` sets `pageSize: 15` (`l8ui/m/js/layer8m-nav-data.js:39`), which happens to bracket the user's row into page 0 on the 45-row demo. Tomorrow with 46+ clients this also breaks.
- Login as `admin` (wildcard role) → works regardless (no scope-deny rules apply).

The behavior is environment-fragile (depends on row count, page size, sort column) which is why it has gone unnoticed until now.

---

## Root cause

### Call graph

```
HTTP PUT /physio/50/PhyClient?body=…
  └─ l8web/server/ServiceHandler.serveHttp
       └─ vnic.LeaderRequest("PhyClient", 50, GET, body, …)
            └─ l8services/manager/ServiceManager.Handle
                 ├─ security.CanDoAction(...)              // action-level check
                 ├─ <route to service handler>
                 │    └─ orm.Get(query)                    // runs SQL with LIMIT/OFFSET
                 │         => returns rows on page 0 only
                 └─ scope := security.ScopeView(vnic, resp, …)   // <-- POST-FILTER
                      => drops rows matching the deny query
```

### The post-filter

`l8secure/go/secure/provider/ScopeView.go:79-81`:

```go
// Apply row-level filtering — remove elements that match any deny query
if len(rowFilters) > 0 {
    elem = filterElements(elem, rowFilters)
}
```

`filterElements` walks `elem.Elements()` (the rows the ORM already returned) and drops any that match a deny query. There is no way for it to *re-introduce* rows the ORM never returned.

### The call site

`l8services/go/services/manager/ServiceManager.go:127` (non-transactional path) and `:163-165` (transactional path) call `ScopeView` on the already-fulfilled `resp`. Neither rewrites the inbound `body` (the `L8Query`) before the service handler runs the query.

### Why "page 0 by lastName" works by accident

The 45 demo clients have names from the mock generator. When sorted lexicographically by `lastName`, `cli-011`'s row falls within the first 10. With `pageSize=15`, all of `cli-001..cli-015` are on page 0. Either condition keeps the user's row in the result set long enough for the post-filter to leave it intact — which is why the bug is hard to spot in development with small datasets and easy sort orders.

---

## Scope of impact

Any rule of the form `attributes: { "<Type>": "select * from <Type> where <scope-expr>" }`. In `l8physio` alone, the affected rules are:

| Role | Rule ID | Type | Scope |
|---|---|---|---|
| client | `client-deny-physio-scope` | `PhysioClient` | `clientId != ${userId}` |
| client | `client-deny-plan-scope` | `TreatmentPlan` | `clientId != ${userId}` |
| client | `client-deny-session-scope` | `SessionReport` | `clientId != ${userId}` |
| client | `client-deny-feedback-scope` | `HomeFeedback` | `clientId != ${userId}` |
| client | `client-deny-appt-scope` | `Appointment` | `clientId != ${userId}` |
| client | `client-deny-log-scope` | `ProgressLog` | `clientId != ${userId}` |
| client | `client-deny-workout-scope` | `GeneratedWorkout` | `clientId != ${userId}` |
| therapist | `therapist-deny-other-therapists` | (per the rule body) | analogous |

Every one of these can return 0 rows on page 0 as the dataset grows past the page size of the listing UI. The first symptom is *always* the same: "no data found" for a user who clearly should see their own row.

---

## Proposed fix

Apply scope-deny rules as **query-rewrite** before the ORM, instead of (or in addition to) as a post-filter on the response.

### Where to inject

`l8services/manager/ServiceManager.Handle`, immediately after `CanDoAction` and before dispatching to the service handler. The `pb` argument for GET-style requests is an `*l8api.L8Query`; mutate its `Text` (or its parsed AST) to add an `and (not (<deny-query-where>))` clause for each row-level deny rule that applies to the queried type for the caller's roles.

### Sketch

In `l8secure/.../provider/SecurityProvider.go` add a verb:

```go
// ScopeQuery returns the input query with all applicable row-level deny rules
// for the caller appended as conjunctive negations. For a deny rule
//
//     attributes: { "PhysioClient": "select * from PhysioClient where clientId!=${userId}" }
//
// and a caller request
//
//     select * from PhysioClient [limit … page … sort-by …]
//
// the returned query is
//
//     select * from PhysioClient where not (clientId!=${userId}) [limit … page … sort-by …]
//
// i.e. equivalent to
//
//     select * from PhysioClient where clientId=${userId} [limit … page … sort-by …]
//
// preserving the caller's WHERE, LIMIT, PAGE, and SORT.
func (this *_securityProvider) ScopeQuery(vnic ifs.IVNic, q *l8api.L8Query, aaaid string) (*l8api.L8Query, error)
```

Then in `ServiceManager.Handle`, before dispatching:

```go
if q, ok := pb.Element().(*l8api.L8Query); ok {
    rewritten, err := vnic.Resources().Security().ScopeQuery(vnic, q, msg.AAAId())
    if err != nil { return object.NewError(err.Error()) }
    pb = object.New(nil, rewritten)
}
```

Once `ScopeQuery` is in place, `ScopeView`'s row-filter loop becomes redundant for queries that went through `ScopeQuery` — but it should stay as defense in depth for non-query code paths (proto messages constructed in-process, multicast responses, etc.).

### Field-level denial stays where it is

`ScopeView` already does two things: row-level filtering (broken by this bug) and field-level blanking (fine, operates on whatever rows survive). The field-blanking path keeps working as-is; only the row-filter half moves into the query-rewrite step.

### Action-key semantics

Per `l8secure/go/secure/provider/aaa.go:284-330` (`allowedActions`), deny rules with `actions: {}` are treated as "scope-only" (they do not enumerate which actions to deny — they exist solely to attach a row filter). Same convention should apply to `ScopeQuery`: rewrite the WHERE for every deny rule that targets the queried type *and* has a non-empty row-filter attribute, regardless of the rule's `actions` map.

`${userId}` substitution: lift the existing `strings.ReplaceAll(value, "${userId}", userId)` from `ScopeView.go:67` into a shared helper used by both `ScopeView` and `ScopeQuery`.

---

## Test plan

Add Go tests in `l8secure/go/secure/provider/`:

1. **Rewrite is correct** — given a role with `client-deny-physio-scope` and a query `select * from PhysioClient limit 10 page 0 sort-by clientId`, `ScopeQuery` returns `select * from PhysioClient where not (clientId != "cli-011") limit 10 page 0 sort-by clientId` (or equivalent AST).
2. **Caller's WHERE is preserved** — `select * from PhysioClient where active=true …` becomes `select * from PhysioClient where (active=true) and not (clientId != "cli-011") …`.
3. **Multiple deny rules conjoin** — a role with two deny rules on the same type yields `where not (rule1) and not (rule2) …`.
4. **No scope deny → no change** — admin/operator paths return the query unchanged.

Plus an integration test that uses the existing l8physio fixture: log in as `cli-011`, send `select * from PhysioClient limit 10 page 0 sort-by clientId`, assert the response contains exactly `[cli-011]`. This is the reproduction case above; once the fix lands, it should pass for every `cli-NNN` regardless of `NNN`.

---

## Workarounds available today

These let downstream apps unblock users while the upstream fix is in flight. None of them are a substitute for the fix — they paper over a correctness issue with brittle frontend conventions.

1. **Frontend `baseWhereClause`** — for a per-portal "I am scoped to my own row" UI, set `service.baseWhereClause = '<scopeField>=' + sessionStorage.getItem('currentUser')`. Notably `l8ui/shared/layer8d-service-registry.js` does not currently forward `service.baseWhereClause` into `viewOptions` even though `Layer8DTable` supports it (`l8ui/edit_table/layer8d-table-data.js:34` + `:161`); the mobile equivalent `l8ui/m/js/layer8m-nav-data.js:41` does forward it. The forward is a one-line addition.
2. **Inflate page size** — bumping desktop's hardcoded `pageSize: 10` in `Layer8DServiceRegistry` to a number larger than the worst-case dataset will hide the bug. Brittle.
3. **Force a sort that puts the user's row early** — same brittleness.

We are applying (1) in l8physio so the demo works today; the rest of this document is what we need the proper fix for.

---

## Related code references

- `l8secure/go/secure/provider/ScopeView.go` — current (broken) post-filter site.
- `l8secure/go/secure/provider/aaa.go:347` — `getDeniedAttributes` produces the per-type deny attribute map; reuse it for query rewrite.
- `l8services/go/services/manager/ServiceManager.go:127,165` — `ScopeView` call sites; the new `ScopeQuery` call goes immediately *before* the service-handler dispatch in the same function.
- `l8types/go/ifs/Security.go:53-54` — `ScopeView` interface; add `ScopeQuery` here.
- `l8types/go/sec/ShallowSecurityProvider.go:88` — permissive stub; add a no-op `ScopeQuery` that returns its input unchanged.
- `l8ui/edit_table/layer8d-table-data.js:70-89` — the desktop query builder that produces the page-0 query that triggers the bug.
- `l8ui/m/js/layer8m-data-source.js:93-104` — mobile analog.
- `l8ui/shared/layer8d-service-registry.js:100-114` — desktop registry that currently swallows `service.baseWhereClause`; relevant for the workaround.
