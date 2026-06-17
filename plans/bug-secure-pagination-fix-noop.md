# Bug Report: `l8orm 8ef992e` "Add secure pagination" fix is a no-op against real requests

**Author:** l8physio team
**Date:** 2026-06-17
**Status:** open — follow-up to `bug-scope-deny-applied-after-pagination.md`
**Affected commit:** `l8orm 8ef992eb7bcb1218e584fdd2ee775d96fe05ac96` (and the lockstep cluster on 2026-06-13: `l8types 67f2c04`, `l8types 5a88fe0`, `l8secure 101830e`, `l8ql 24b364d`, `l8utils d1acbeb`)

---

## TL;DR

The "secure pagination" fix added to `l8orm/go/orm/plugins/postgres/Read.go::readWithIndex` does compile, run, and execute the new code path — but it filters nothing, because the `aaaid` it receives via `q.AAAId()` does not satisfy `ScopeItem`'s 36-char guard. The original bug is fully present on a clean build of l8physio with all the fix-cluster commits pinned. We need `q.AAAId()` to be populated with the same bearer-token value that `msg.AAAId()` carries — the most likely fix site is `l8services/manager/ServiceManager.Handle`, which currently passes the parsed query to the controller without copying the message's aaaid onto it.

---

## How we got here

1. Original report `bug-scope-deny-applied-after-pagination.md` filed against `main`.
2. Fix landed Sat 2026-06-13 as `l8orm 8ef992e` (+ supporting cluster).
3. l8physio bumped go.mod to those pins (commit `d470b80`) and reverted the local pageSize=60 workaround (commit `0cbf703`, l8ui `ce8420a`).
4. Re-ran the canonical curl reproduction. Bug behaves identically to before the fix.

---

## Reproduction — same as the original report

`l8physio main` with go.mod pinning `l8orm 8ef992e` and call-site pageSizes at production values (10–15). Demo: 45 seeded `PhysioClient` rows, `cli-011` user.

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

q 'select * from PhysioClient'                                   #  ['cli-011']
q 'select * from PhysioClient limit 10 page 0'                   #  []          <-- BUG
q 'select * from PhysioClient limit 10 page 0 sort-by clientId'  #  []          <-- BUG
q 'select * from PhysioClient limit 10 page 0 sort-by lastName'  #  ['cli-011'] (lexicographic luck)
q 'select * from PhysioClient limit 15 page 0'                   #  ['cli-011'] (cli-011 fits in first 15)
q 'select * from PhysioClient limit 100 page 0'                  #  ['cli-011']
```

Build provenance (Tue 2026-06-17):
- `physio_demo` binary built from current `main`, contains `filterRecKeysBySecurity` symbol → the fix code is in the binary.
- Auth returns a 105-char JWT bearer token → the request side has the proper aaaid.

So the fix code is running, but it is not filtering.

---

## Smoking-gun observation: visibility depends only on page-size vs. row position

Tested with the same build of l8physio, varying only the table's `pageSize`:

| pageSize | Who sees their own row | Why |
|---|---|---|
| 60 | every `cli-NNN` (all 45) | one page holds every row → post-filter always finds the user's row |
| 15 | `cli-001..cli-015` | row sorts into first 15 → post-filter keeps it |
| 10 (production) | `cli-001..cli-010` | row sorts into first 10 → post-filter keeps it |

This is *exactly* the original bug's signature. If `filterRecKeysBySecurity` were doing real work, the candidate set would be shrunk to just the user's permitted rows **before** `LIMIT/OFFSET` is applied, and the user would see their row at any pageSize and at offset 0 every time. Instead the response is still purely "is your row in the first N raw rows postgres returns" — i.e. the same condition as before the fix.

The only filter doing real work is still `ServiceManager.ScopeView`, applied to the post-paginated result, exactly as the original report described.

---

## Root cause (hypothesis)

`l8secure/go/secure/provider/ScopeView.go:142` — `ScopeItem` (the new entrypoint the fix calls):

```go
func (this *_securityProvider) ScopeItem(resources ifs.IResources, elem interface{}, alias string, aaaid string, args ...string) interface{} {
    if len(aaaid) < 36 || aaaid[35] == 0 {
        return elem            // <-- early return: no filtering
    }
    ...
}
```

`l8orm/go/orm/plugins/postgres/Read.go::readWithIndex` (the fix):

```go
aaaId := q.AAAId()
hash := int64(q.Hash())
if aaaId != "" {
    hash = hash<<32 | int64(hashString(aaaId))
}
...
if aaaId != "" && resources.Security() != nil {
    recKeys, metadata = this.filterRecKeysBySecurity(q, recKeys, resources, aaaId)
}
```

`l8services/go/services/manager/ServiceManager.go:127, 165` — the post-filter (still in place):

```go
scope := vnic.Resources().Security().ScopeView(vnic, resp, vnic.Resources().SysConfig().LocalUuid, msg.AAAId())
```

Note that `ServiceManager` uses `msg.AAAId()` (the inbound Message's aaaid — the JWT bearer token, 105 chars). That call works correctly. The new ORM path uses `q.AAAId()` instead.

**Hypothesis:** `q.AAAId()` is never populated from `msg.AAAId()` for the request paths l8physio exercises. It is either empty or a short userId (e.g. `cli-011`, 7 chars), so it trips the `len(aaaid) < 36` guard inside `ScopeItem`, the new pre-filter becomes a no-op, the raw first-N rows pass through, and `ServiceManager.ScopeView` then strips them all → empty page.

If this hypothesis is right, the fix is one-line:

```go
// In l8services/manager/ServiceManager.Handle, before dispatching to the controller:
if q, ok := pb.Element().(*l8api.L8Query); ok {
    q.AAAId = msg.AAAId()   // or q.SetAAAId(msg.AAAId()) — whichever the type exposes
}
```

We did not push this change because we don't have commit access to `l8services` / `l8ql`, and because confirming the hypothesis requires reading the controller-invocation path in `ServiceManager.Handle` (specifically: where the L8Query is unmarshaled and how `AAAId` is set on it, if anywhere).

---

## What to verify before fixing

1. **Where is `Query.AAAId` set today?** A grep we ran in l8services and l8web found no `SetAAAId` / `.AAAId =` writes on the query side. Confirm and identify any code path that *does* populate it (so we don't double-write or stomp).
2. **Does `Query` have a public setter for `AAAId`?** `l8ql/go/gsql/interpreter/Query.go:501` is the field declaration. The fix may just need a setter added if one isn't there.
3. **Is `msg` available at the dispatch site in `ServiceManager.Handle`?** It is — `ScopeView` at lines 127/165 already uses `msg.AAAId()` in the same function, so wiring `q.AAAId = msg.AAAId()` immediately before the controller call is mechanically straightforward.
4. **Once the pre-filter actually filters: keep `ScopeView` post-filter too, or remove it?** Recommend keeping it as defense-in-depth — it still does the field-blanking pass on field-level deny rules, which is independent of pagination.

---

## Suggested test

Add an integration test in `l8orm` (or wherever the fix lands) that mirrors the curl repro:

1. Seed 20 rows of a scoped type. Apply a deny rule keyed by `userId`.
2. As a scoped user whose row sorts to position 15, issue `select * from <Type> limit 10 page 0 sort-by <pk>`.
3. Assert the response contains exactly that one row, not zero rows.

Without that test the regression will return on any future refactor of how Query/Message aaaid flow through `ServiceManager`.

---

## What we changed in l8physio while waiting

Reverted (now on `main`):
- `l8ui ce8420a` — reverts `0ce3b42` (the `pageSize: 60` default-bump workaround).
- `l8physio 0cbf703` — bumps the submodule pointer and restores call-site pageSizes (10/15/20) so we can keep verifying the upstream fix without re-baking the workaround into every table.

If a real fix isn't imminent, we can re-apply the workaround locally; please let us know which way to go.

---

## Files / commits referenced

- `l8orm 8ef992e` — Add secure pagination (`go/orm/plugins/postgres/Read.go`, `plans/security-aware-cache-pagination.md`)
- `l8orm 6b4b22a` — Fix compilation
- `l8secure 101830e` — Add ScopeItem (`go/secure/provider/ScopeView.go:141`)
- `l8types 5a88fe0` — Add ScopeItem to security provider interface
- `l8types 67f2c04` — Fix security filter pagination
- `l8ql 24b364d` — Change hash (Hash() → int32)
- `l8utils d1acbeb` — Fix secure pagination (cache layer)
- `l8services/go/services/manager/ServiceManager.go:127, 165` — existing `ScopeView` post-filter call sites (working) and dispatch site (where the proposed wiring belongs)
- `l8secure/go/secure/provider/ScopeView.go:28, 142` — identical 36-char aaaid guard at the head of both `ScopeView` and `ScopeItem`
- `l8ql/go/gsql/interpreter/Query.go:501` — `Query.AAAId` field declaration
- `l8types/go/ifs/Message.go:145` — `Message.AAAId` accessor (confirmed working source of bearer token in current `ScopeView` calls)
- `l8physio/plans/bug-scope-deny-applied-after-pagination.md` — the original report this one supersedes
