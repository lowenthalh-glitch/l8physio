# Bug Report: ORM panics on zero-value proto fields during postgres Write

## Summary

The L8 ORM panics with "Value is invalid" when writing a protobuf entity to postgres if any field has a zero/nil reflect.Value. This includes proto enum fields with value 0 (UNSPECIFIED), which are valid proto3 defaults.

## Reproduction

1. Define a proto message with enum fields (e.g., `SessionStatus` which has `UNSPECIFIED = 0`)
2. Create an instance where some enum fields are 0 (the proto3 default)
3. POST or PUT the entity via a service

```go
row := &physio.HeadThDashRow{
    RowId:              "test-1",
    ClientId:           "cli-001",
    LastFeedbackStatus: 0,  // SESSION_STATUS_UNSPECIFIED — valid proto3 default
    LastSessionStatus:  0,  // same
    OverrideStatus:     0,  // same
}
l8c.PostEntity("HTDash", 50, row, vnic)  // PANIC
```

## Stack Trace

```
panic: Value is invalid

goroutine 202 [running]:
github.com/saichler/l8orm/go/orm/convert.TypeOf({0x0?, 0x0?, 0xfc0b01?})
    l8orm/go/orm/convert/ConvertTo.go:92 +0x145
github.com/saichler/l8orm/go/orm/convert.ConvertTo(0x1, ...)
    l8orm/go/orm/convert/ConvertTo.go:42 +0x13c
github.com/saichler/l8orm/go/orm/plugins/postgres.(*Postgres).Write(...)
    l8orm/go/orm/plugins/postgres/Write.go:115 +0xe7
github.com/saichler/l8orm/go/orm/persist.(*OrmService).do(...)
    l8orm/go/orm/persist/OrmDoAction.go:43 +0x12a
github.com/saichler/l8orm/go/orm/persist.(*OrmService).Post(...)
    l8orm/go/orm/persist/OrmService.go:121 +0x38
```

## Root Cause

`ConvertTo.go:92` — `TypeOf()` receives a zero-value `reflect.Value` and panics. The caller (`Write.go:115`) doesn't guard against zero/nil values before calling `ConvertTo`.

In proto3, enum fields default to 0 when not explicitly set. The ORM should treat 0 as a valid value for enum fields, not as an invalid/nil value.

## Expected Behavior

Zero-value proto fields (empty string `""`, int `0`, enum `0`) should serialize to their SQL equivalents (`''`, `0`, `0`) without panicking.

## Actual Behavior

Process panics and crashes.

## Impact

- Blocks any service that writes proto entities with default/zero enum fields
- Specifically blocks the HTDash (Head Therapist Dashboard) service which aggregates data from multiple services and writes summary rows
- Workaround in place: dashboard uses frontend aggregation instead of backend persistence

## Affected Code

- `l8orm/go/orm/convert/ConvertTo.go:92` — `TypeOf()` needs nil/zero guard
- `l8orm/go/orm/plugins/postgres/Write.go:115` — should handle zero values before calling `ConvertTo`

## Workaround

The l8physio dashboard uses client-side aggregation (`htdash-view.js`) instead of the backend HTDash service. When this bug is fixed, replace the frontend aggregation with the backend service (code already exists in `go/physio/htdash/`).

## Environment

- l8orm version: vendored in l8physio (as of 2026-04-21)
- Database: postgres via `saichler/unsecure-postgres`
- Proto: proto3 with enum fields having UNSPECIFIED = 0
