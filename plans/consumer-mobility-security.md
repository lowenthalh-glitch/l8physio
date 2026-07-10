# Consumer Mobility — Security Companion Plan

## Status

**STUB — to be authored.** This is the security counterpart to
`plans/consumer-mobility-app.md`. That plan intentionally excludes all
security-plumbing details; they live here. The main plan will not merge
its Phase 1 without this companion plan being at least drafted and
scoped, because Phase 1 has a hard dependency on the anon-auth
mechanism and the consumer role.

## Scope

Everything auth / identity / access-control / privacy for the consumer
product:

1. **Anonymous / pre-auth HTTP routes.** Precedent: `l8web`'s
   `/auth`, `/register`, `/captcha` (`l8web/go/web/server/WebService.go:115-143`,
   `TFA.go:105-143`). `RestServer.Authentication` global flag is the
   nearest existing pattern. Decide whether to reuse or extend for the
   consumer assessment / signup routes.

2. **`consumer` role in area 73.** Full role definition — allow rules
   for area 51 `ConsumerUser` / `AssessmentResult`, area 50
   `TreatmentPlan` scoped by `${associateIds}`, area 50 `PhysioProtocol`
   read when `is_public = true`. Deny rules as needed.

3. **User provisioning channel.** UI-JS provisioning via the shared
   `Layer8UserProvisioning.createEntityUser` helper (extracted in the
   main plan's Phase 0 PR0.4). Consumer spec: role name, portal,
   scope-role rules, `associate_ids` populated with the created
   `PhysioClient.client_id` at signup time.

4. **Signup atomicity.** Multi-area writes (area 73 user → area 50
   `PhysioClient` → area 73 associate_ids update → area 51 `ConsumerUser`
   → area 50 `TreatmentPlan`). Adopt `l8services/transaction/states/T05_Rollback.go`
   state-machine pattern for rollback on partial failure.

5. **`AnonSession` PII retention.** IP, UA, referrer captured on
   anonymous-session creation. Policy: retention window (30 days?
   90 days?), redaction on signup adoption, hard-delete pass. Consider
   whether `l8utils/go/utils/cache/TTL.go` TTL cache fits, or if we need
   an ORM-side sweeper. Reuse or extend `l8erp/go/erp/doc/retentionpolicies`
   stub.

6. **Consumer-created `PhysioClient` visibility to therapists.**
   Whether to hide, filter UI-side, or leave visible. If hiding: needs
   a scope rule that joins area 50 and area 51 (or a discriminator field
   we intentionally avoided). Deferred pending product call — see
   discussion in main plan history.

7. **Assessment endpoint access model.** Which endpoints accept
   `X-Anon-Token`, which require `consumer` bearer, which require area-73
   full auth (e.g., therapist admin editing routing rules).

## Related documents

- `plans/consumer-mobility-app.md` — the main product plan; references
  this document at PR1.1, PR1.3, Phase V, and the compliance checklist.
- `l8book/rules/associate-ids-scope-view.md`
- `l8book/rules/loginable-entity-user-provisioning.md`
- `l8book/rules/never-import-l8secure.md`
- `l8book/rules/security-config-structure.md`
- `l8book/rules/security-provisioning-channels.md`

## Handoff

When this plan is authored, its PRs feed into main-plan PR1.1 (anon-auth
middleware ready), PR1.3 (consumer role + provisioning spec ready), and
Phase V (scope-rule verification tests).
