# Consumer Mobility & Rehab Platform — l8physio

## Status

**DRAFT — Phases 0–2 in scope.** Phases 3, 4, and 5 are **DEFERRED**
(see each phase header). Phase 0 must close the remaining open decisions in
[Open Decisions](#open-decisions) before Phase 1 code lands. All
security-plumbing details (anon auth, `consumer` role, provisioning
wiring, PII retention, therapist visibility of consumer clients) are
delegated to the **companion security plan
(`plans/consumer-mobility-security.md`)** and must be at least drafted
and scoped before this plan's Phase 1 begins.

Decisions already locked:
- **Portal:** new `consumer-app.html` (not a fork of `client-app.html` or `m/`).
- **Service area:** new area **51** for consumer entities (`AnonSession`,
  `Assessment`, `AssessmentQuestion`, `AssessmentAnswer`, `AssessmentResult`,
  `ConsumerUser`, `AssessmentRoutingRule`).
- **Consumer identity:** new `ConsumerUser` entity in area 51 that
  references an underlying `PhysioClient` (kept clean for clinical use).
  Not a `ClientOrigin` enum on `PhysioClient`.
- **Assessment routing:** proto-backed `AssessmentRoutingRule` entity in
  area 51, editable via the therapist-app UI. Not a JSON file, not
  hard-coded.

## Goal

Build a self-serve, subscription-based mobility / rehab / prehab product on
top of the existing Layer 8 physio backbone. Model is a convergence of three
reference products:

- **The Prehab Guys** — assessment-first routing ("tell us what hurts") → a
  personalized program pulled from a library of ~55 named programs backed by
  ~4,000 exercise videos.
- **MoveU** — Foundation → Build → Active progression system + community +
  monthly live Q&A. HSA/FSA eligible. Focus on root-cause education.
- **The Ready State** — Kelly Starrett's multi-SKU stack: mobility app +
  cohort program + pro courses + "tap where it hurts" pain-relief protocol
  library.

Target audience for MVP: **consumers with recurring musculoskeletal pain or
prehab goals** who won't or can't see a PT weekly. Explicitly NOT the clinical
practice audience the current therapist app serves — that stays intact.

## Non-goals (for the first year)

- Replacing the clinical therapist app.
- Telehealth video calls.
- Insurance billing / claims.
- Native iOS/Android apps (PWA is enough for v1; wrap in Capacitor later if
  needed for push + App Store distribution).
- Real-time community chat / DMs (async forum only if we do community at all).

## Canonical project classification

*(Rule: `canonical-project-selection`)*

This is an **ERP-style project** (persistent business entities with CRUD
lifecycles: `PhysioClient`, `TreatmentPlan`, `ConsumerUser`, `Assessment*`
records, `Subscription` when Phase 4 reactivates). Canonical reference is
**l8erp**, not probler. Structure, K8s patterns, main.go patterns, and
mock-data patterns follow l8erp conventions.

Deployment topology: a single `physio_demo` process owns all area-50 and
area-51 ORM tables *(rule: `single-owner-database-table`)*. No other
process activates these ORMs locally; boostapp already accesses via remote
POST/GET/PUT/DELETE over vnet and this plan preserves that pattern.

## Core product principle

### Assessment as the front door

**The assessment IS the product's front door — not a step inside it.** All
three reference products lead with a diagnostic quiz *before* asking for
signup or payment. We do the same.

Implications that ripple through every phase:

- The landing page is not a marketing page with a "Take the Assessment" CTA
  buried below the fold — the landing page **is** the assessment. First
  paint = first question.
- The assessment is takeable **anonymously**. No email, no login. Results
  are stored under an anonymous token (cookie / URL) and adopted by the
  `PhysioClient` record on signup.
- The **result screen is the paywall / signup wall**: "Here's your
  personalized program — [Program Name] — start free for 7 days." This is
  the primary conversion moment.
- The assessment is retakeable. Progression graduation (Phase 2) is gated on
  a re-assessment, not on time elapsed.
- Every free tool on the marketing surface (body map, pain guides) points
  back to the assessment.
- SEO landing pages by condition ("sciatica program", "shoulder impingement
  program") route into a pre-scoped variant of the assessment.

This principle is why Phase 1 has anon-token assessment as **default**, not
a stretch goal, and why Phase 3's marketing surface is small — the
assessment does the heavy lifting.

## Other constraints & principles

1. **Reuse the Layer 8 backbone.** Every new entity is a proto message + service
   under area **51** (consumer-specific). No side-channel storage.
2. **PhysioExercise is already the atomic unit.** Progression/regression chains,
   video path, category, joint, load type — all present. We do NOT fork the
   exercise library. Consumer programs are `PhysioProtocol`s (already
   practice-wide templates as of `a959658`).
3. **Mobile-first PWA.** New `consumer-app.html` under `go/physio/ui/web/`
   is the primary surface. Therapist-app and `m/` stay untouched.
4. **Content is the moat.** Video library quality + assessment routing quality
   are the two things users pay for. Everything else is scaffolding.
5. **Ship each phase.** Every phase below is independently shippable and
   testable end-to-end, even if we stop after Phase 1.

## Naming and conventions

*(Rules: `protobuf-model-names`, `maintainability`, `js-protobuf-field-names`,
`protobuf-generation`)*

### ServiceName ↔ Protobuf model name mapping

L8Query strings, JS configs, forms, columns, and nav configs must use the
**protobuf model name** (not the ServiceName). ServiceName is only the
service registration identifier.

| ServiceName | Protobuf Type | Area | Portal usage |
|---|---|---|---|
| `AnonSess` | `AnonSession` | 51 | consumer, therapist (read-only) |
| `Asmnt` | `Assessment` | 51 | consumer, therapist |
| `AsmntRule` | `AssessmentRoutingRule` | 51 | therapist (admin) |
| `AsmntRes` | `AssessmentResult` | 51 | consumer, therapist |
| `ConsUsr` | `ConsumerUser` | 51 | consumer, therapist |

All new ServiceNames are **≤ 10 characters** (rule: `maintainability`) —
verified: `AnonSess`=8, `Asmnt`=5, `AsmntRule`=9, `AsmntRes`=8, `ConsUsr`=7.

### Field-name verification

Every JS field name (columns.js, forms.js, nav configs, idField) must be
verified against the JSON tag in the generated `.pb.go` file. Verification
is a checklist item on every UI PR.

### Proto tooling

After any change to `proto/physio.proto`, run `proto/make-bindings.sh` — no
manual `protoc` invocation. This is a mandatory step at the end of every
proto-touching PR.

## Existing baseline (what we already have)

From current l8physio (as of `a959658`):

- **Exercise library** — `PhysioExercise` with category, joints, postures,
  load types, progression/regression/rotation chains, video+image paths
  (`proto/physio.proto:271-315`). Backfill tooling exists for image files
  (`go/tests/mocks/cmd/backfill_images/main.go`).
- **Program templates** — `PhysioProtocol` reworked as practice-wide templates
  with lossless round-trip to `TreatmentPlan` (multi joints/categories/
  postures, goals field, ProtocolExercise as strict superset of PlanExercise).
- **User plan instances** — `TreatmentPlan` + `PlanExercise` (sets, reps,
  hold_seconds, frequency, circuits, notes, load_type, weight).
- **Home logging** — `HomeFeedback` + `ProgressLog`/`ProgressEntry` for
  per-session self-report (pain, difficulty, compliance, mood).
- **Auth** — Layer 8 `l8secure` area 73, portal-based routing
  (`portal: "client-app.html"` etc.), boostapp-driven auto-onboarding of
  users from calendar events.
- **Mobile UI** — `go/physio/ui/web/m/` with `Layer8MAuth`, section nav,
  exercise cards with embedded video iframes, home-feedback + progress views.
- **Content marketing surface — NONE.** No blog, no landing pages, no email.
- **Payment / billing — NONE.**
- **Video hosting — path strings only, no CDN / player component.**
- **Anonymous / pre-signup flows — NONE.** All existing endpoints require
  area-73 auth.

## Platform completeness audit

*(Rule: `plan-platform-completeness`, `mobile-rules`)*

Two-dimensional (component × platform) audit of everything this plan
delivers. `m/` = existing mobile portal; `consumer-app` = new mobile-first
PWA introduced by this plan; `therapist-app` = existing desktop portal.

| Component | consumer-app (mobile PWA) | therapist-app (desktop) | m/ (existing mobile) |
|---|---|---|---|
| Assessment wizard | **new (Phase 1)** | N/A | N/A |
| Consumer signup | **new (Phase 1)** | N/A | N/A |
| Today's workout + home feedback | **new (Phase 1)** — reuses `plan-renderer-m.js` | N/A | existing |
| Program catalog browse | **new (Phase 2)** | N/A (admin uses existing PhyProto forms) | N/A |
| Start / supersede plan | **new (Phase 2)** | N/A | N/A |
| Re-assessment | **new (Phase 2)** | N/A | N/A |
| Journey / history view | **new (Phase 2)** | N/A | N/A |
| `AssessmentRoutingRule` admin | N/A | **new (Phase 1)** — new "Assessment Rules" section | N/A |
| `PhysioProtocol` catalog fields (`is_public`, `phase`, `hero_image_url`, …) | consumed (Phase 2) | edited via existing `protocols-columns.js` (extend, Phase 2) | N/A |

**Consumer-app is mobile-first PWA only.** There is intentionally no
desktop-native consumer surface: the PWA renders responsively at desktop
widths but is designed and QA'd against mobile. Rule `mobile-rules`
parity check therefore reduces to "the consumer PWA works at both mobile
and desktop viewports"; there is no separate desktop implementation to
maintain parity with.

## Duplication audit

*(Rule: `plan-duplication-audit`)*

Two axes: portal HTMLs, and per-entity user-provisioning JS.

### Axis 1 — Portal HTMLs (PASS, no extraction needed)

Existing portals in `go/physio/ui/web/`:

| Portal | Lines | Uses shared factory? |
|---|---|---|
| `app.html` (dashboard) | 333 | `Layer8DModuleFactory` ✓ |
| `client-app.html` | 277 | `Layer8DModuleFactory` ✓ |
| `therapist-app.html` | 282 | `Layer8DModuleFactory` ✓ |
| `m/app.html` (mobile) | 375 | `Layer8MModuleRegistry` ✓ |

Adding `consumer-app.html` (mobile-first, Phase 1 PR1.4) makes 5 portal
HTMLs. All existing 4 use the shared factory / registry pattern —
behavior lives in the factory, each portal contributes only config +
script-tag wiring.

**Result: PASS.** `consumer-app.html` follows the same pattern (new nav
config + section files under `go/physio/ui/web/consumer/`, no new
behavioral code). Duplicated behavioral lines added by this axis: **0**.

### Axis 2 — User provisioning JS (FAIL — Phase 0 extraction required)

Existing files:

| File | Lines |
|---|---|
| `go/physio/ui/web/physio/physio-user-provisioning.js` (desktop) | 83 |
| `go/physio/ui/web/m/js/physio/physio-user-provisioning-m.js` (mobile) | 86 |

Both follow the same shape: `postRole` + `postUser` + `denyRule` +
`createClientUser` / `createTherapistUser` orchestration. The only real
differences are the `Layer8DAuth` vs `Layer8MAuth` client and
`Layer8DUtils` vs `Layer8MUtils` notifier — i.e., a platform adapter.
`l8c.L8UserJSON()` from vendored `l8common` covers the payload shape but
not the orchestration.

Adding `consumer-user-provisioning.js` (Phase 1 PR1.3) would make it
**3 × ~85 lines ≈ 255 lines of near-duplicated code**, well above the
100-line threshold the rule sets.

**Result: FAIL as currently structured.** Phase 0 must extract shared
behavioral code (see [PR0.4](#phase-0--foundations--decisions-3-4-hours)).
After extraction, all three call sites become thin config-only wrappers
(~10 lines each) and this axis passes.

## Traceability matrix

*(Rule: `plan-traceability-and-verification`)*

Every identified gap maps to a phase. If a row has no phase, it's a
planning error.

| # | Gap | Component | Platform | Phase |
|---|---|---|---|---|
| G0 | User-provisioning logic duplicated across desktop + mobile (~85 LOC each); adding a 3rd copy for consumer would push past the 100-line threshold | JS orchestration | shared | Phase 0 PR0.4 |
| G1 | No anonymous / pre-signup flow — all endpoints require area-73 auth | Auth middleware | server | **Companion security plan** (this plan consumes it in PR1.1) |
| G2 | No `Assessment*` entities in proto | Proto | server | Phase 1 PR1.1 |
| G3 | No routing-rule engine mapping answers → protocol | Service | server | Phase 1 PR1.1 |
| G4 | No admin UI to edit routing rules | UI | therapist-app | Phase 1 PR1.1 |
| G5 | No public assessment landing surface | UI | consumer PWA (new `/assess.html`) | Phase 1 PR1.2 |
| G6 | No CTA on `index.html`, `landing-training.html`, `landing-treatment.html` | UI | landing pages | Phase 1 PR1.2 |
| G7 | `PhysioClient` has no consumer-linkage concept | Proto + service | server | Phase 1 PR1.3 |
| G8 | No consumer signup + user provisioning path | Service + UI | new consumer-app | Phase 1 PR1.3 |
| G9 | No consumer portal at all | UI | new consumer-app | Phase 1 PR1.4 |
| G10 | `PhysioProtocol` has no catalog visibility, difficulty, or graduation-chain fields | Proto | server | Phase 2 PR2.1 |
| G11 | `PhysioPlanStatus` enum missing `SUPERSEDED` | Proto | server | Phase 2 PR2.1 |
| G12 | `/50/PhyProto` requires area-73 auth (no public catalog) | Service | server | Phase 2 PR2.2 |
| G13 | No consumer catalog browse UI | UI | consumer-app | Phase 2 PR2.3 |
| G14 | No program start / supersede flow | Service + UI | consumer-app | Phase 2 PR2.4 |
| G15 | No completion criteria evaluator | Service | server | Phase 2 PR2.5 |
| G16 | No re-assessment / graduation flow | UI + service | consumer-app | Phase 2 PR2.6 |
| G17 | No journey / history view | UI | consumer-app | Phase 2 PR2.7 |

Verification of all 17 gaps: see [Phase V — Verification](#phase-v--verification).

## Phased milestones

Each phase is a shippable milestone. PRs inside a phase are ordered but can be
reviewed independently. Sizing assumes Layer 8 velocity — new services are
proto + callback + `Activate()`, new UI is form/column JS.

---

### Phase 0 — Foundations & decisions (~3–4 hours)

**Goal:** Close the open questions in [Open Decisions](#open-decisions),
extract the shared user-provisioning helper flagged by the
[Duplication audit](#duplication-audit), and land the placeholder content
pack so Phase 1 can start without churn.

- **PR0.1** — Product brief doc: brand name, positioning, MVP audience,
  pricing hypothesis, single-sentence value prop.
- **PR0.2** — Architecture decision doc (records the locked decisions):
  area **51** for all consumer entities; new portal `consumer-app.html`;
  **`ConsumerUser` as a distinct entity referencing `PhysioClient`**;
  **`AssessmentRoutingRule` as an editable proto entity** with a
  therapist-app admin UI. **Role, auth, and access-control details are
  authored in the companion security plan
  (`plans/consumer-mobility-security.md`).**
- **PR0.3** — Content plan (clinician-authored, not engineering):
  - **Assessment question set** — final wording, order, and branching. Engineering
    ships a placeholder question set (~5 questions) to unblock Phase 1; a
    clinician must author and approve the real set before public launch.
  - **Scoring routing table** — the `(goal, primary_pain_area, phase, …) →
    protocol_id` mapping. Ships as editable data (see Open Decision #9), so
    the clinician can iterate without deploys.
  - **Initial 6–10 launch protocols** — clinician confirms which existing
    `PhysioProtocol` records are consumer-ready and which need to be built
    from scratch.
  - **First 5 SEO landing-page conditions** — for Phase 3 deep-link variants.
  - **Video reuse vs new production** — existing exercise library sufficiency.

- **PR0.4 — Extract shared user-provisioning helper** *(rule:
  `plan-duplication-audit`, mandatory)*.
  - Create `go/physio/ui/web/physio/layer8-user-provisioning.js` — a
    platform-neutral orchestrator exposing a single entry point:
    ```js
    Layer8UserProvisioning.createEntityUser(entity, spec, adapter);
    // spec = {
    //   idField, roleName, portal, scopePrefix,
    //   scopeRules: [{ ruleId, elemType, queryTemplate }],
    // }
    // adapter = { post, resolveEndpoint, showSuccess, showError };
    ```
    Handles: build scope role, POST to `/74/roles`, build L8User with
    combined roles, POST to `/73/users`, surface success/error via the
    adapter. All existing role/user JSON shapes preserved verbatim.
  - Refactor `physio-user-provisioning.js` (desktop) — replace inline
    orchestration with `createEntityUser` calls; the two remaining
    public functions (`createClientUser`, `createTherapistUser`) become
    ~10-line config wrappers.
  - Refactor `physio-user-provisioning-m.js` (mobile) — same pattern with
    the mobile adapter (`Layer8MAuth`/`Layer8MConfig`/`Layer8MUtils`).
  - Both existing files must retain their public API
    (`PhysioUserProvisioning.*`, `PhysioUserProvisioningMobile.*`) —
    call-site changes are out of scope for PR0.4.
  - **Verification:** run existing therapist app + mobile client app;
    provisioning a client and a therapist end-to-end still creates the
    correct scope roles and users (no behavior change).
  - After PR0.4, adding `consumer-user-provisioning.js` in Phase 1 PR1.3
    is a ~15-line config wrapper.

---

### Phase 1 — Assessment-first MVP (~18–28 hours)

**Goal:** A stranger lands on a URL, takes an assessment with no login,
sees their personalized program, signs up, and starts training on mobile.
No payments yet.

- **PR1.1 — Anonymous session + Assessment service + routing-rule engine**
  - **Prime Object classification** *(rule: `prime-object-references`)* —
    Applied the four-part test to each entity:
    - Prime Objects (independent lifecycle, own service):
      `AnonSession`, `Assessment`, `AssessmentResult`,
      `AssessmentRoutingRule`.
    - Child types (embedded `repeated` in a parent, **no separate
      service**, UI as inline table only): `AssessmentQuestion` (in
      `Assessment`), `AssessmentAnswer` (in `AssessmentResult`),
      `RuleCondition` (in `AssessmentRoutingRule`).
  - New proto `AnonSession` (token, created_at, ip, ua, referrer,
    assessment_result_id, audit_info).
  - New proto `Assessment` (schema): `assessment_id`, `name`, `version`,
    `is_active`, `repeated AssessmentQuestion questions`, `audit_info`.
  - New proto `AssessmentResult` (submission): `result_id`, `anon_token`
    (nullable once claimed), `consumer_user_id` (nullable pre-signup),
    `assessment_id`, `submitted_at`, `recommended_protocol_id`,
    `repeated AssessmentAnswer answers`, `audit_info`.
    - **Immutable after submit** *(rule: `immutability-ui-alignment`)*:
      UI renders read-only, no edit controls. A new submission creates a
      new `AssessmentResult`; existing ones are never mutated. Old
      results kept for audit trail.
  - New proto `AssessmentRoutingRule` (rule_id, name, priority,
    `repeated RuleCondition conditions`, protocol_id, is_default,
    is_active, audit_info). `RuleCondition = {field, operator, value_str,
    value_int}` — embedded child type. Rules loaded from ORM at scoring
    time (cache with invalidation on writes).
  - **Enum zero-value hygiene** *(rule: `proto-enum-zero-value`)* — every
    new enum has an `UNSPECIFIED = 0` first entry, including any operator
    or question-type enums introduced with the above protos.
  - **List convention** *(rule: `proto-list-convention`)* — new list
    wrappers (`AssessmentList`, `AssessmentResultList`,
    `AssessmentRoutingRuleList`, `AnonSessionList`) all use the pattern
    `repeated X list = 1; l8api.L8MetaData metadata = 2`.
  - **After proto edits** *(rule: `protobuf-generation`)* — run
    `proto/make-bindings.sh`. Do not invoke `protoc` manually.
  - Scoring engine: given an answer set, walk active rules in `priority`
    order, return the first `protocol_id` whose conditions all match; if
    none, use the `is_default = true` rule.
  - New endpoints `/51/Asmnt`, `/51/AsmntRes`, `/51/AsmntRule`,
    `/51/AnonSess`. **Auth model for these endpoints (which are
    anon-accessible, which require the consumer role, which require
    area-73) is defined in the companion security plan
    (`plans/consumer-mobility-security.md`).** Precedent: `l8web`'s
    `/register` + `/captcha` unauthenticated route pattern
    (`WebService.go:115-143`).
  - **Events service** *(rule: `events-service-required`)* — assessment
    submissions publish `EventRecord`s (already-active `l8events` in this
    project); no new service activation required, just verify the
    handler wiring.
  - **Therapist-app admin UI for rules** — new section "Assessment Rules"
    under `go/physio/ui/web/physio/protocols/` alongside the existing
    protocols admin. Uses `Layer8DModuleFactory` config-driven pattern
    with a new `physio-assessment-rules-columns.js`,
    `-forms.js`, and `-enums.js` per the existing module conventions.
    Reuses `physio-lookups.js` for protocol name lookups.

- **PR1.2 — Assessment UI (public, mobile-first)**
  - **Access model (Option B — locked in):** existing `index.html`,
    `landing-training.html`, and `landing-treatment.html` each get a
    prominent above-the-fold CTA — "Take Your Free Assessment · 90 seconds"
    — linking to `/assess.html`. Existing clinic content preserved.
    Assessment lives at `/assess.html` under a new `go/physio/ui/web/assess/`
    directory. Future promotion to root (Option A) or subdomain (Option C)
    is a config change, not a rewrite.
  - **Load sequence:** static HTML shell + JS bundle. No auth gate. JS
    checks `localStorage` for an `AnonSession` token; if missing, POSTs
    `/51/AnonSess` with UTM/referrer/UA to mint one; if present, GETs
    `/51/Asmnt/state?token=…` to resume prior answers.
  - Wizard component (verify `l8ui` wizard fits mobile touch; may need a
    lightweight fork).
  - Body-map picker reusing joint enum from `physio-lookups.js`.
  - Result screen: named program card + "Start free trial" CTA → signup
    modal (PR1.3). The `assessment_result_id` follows the user through
    signup.
  - **Assessment result is immutable** *(rule: `immutability-ui-alignment`)* —
    the result screen renders read-only. There are no edit controls;
    "retake" starts a *new* result, never mutates the existing one.

- **PR1.3 — `ConsumerUser` entity + signup with assessment adoption**
  - New proto `ConsumerUser` in area 51:
    - Prime Object *(rule: `prime-object-references`)*: independent
      lifecycle, own service.
    - Fields: `consumer_user_id`, `user_id` (area 73 link),
      `physio_client_id` (area 50 link), `email`, `full_name`,
      `assessment_result_id`, `current_plan_id`, `signup_at`, `audit_info`.
    - `PhysioClient` stays clinically clean — no `ClientOrigin` enum, no
      new self-serve fields. It's referenced by ID only, not modified.
  - New endpoint `/51/ConsUsr`. List wrapper `ConsumerUserList` uses the
    canonical `repeated ConsumerUser list = 1; l8api.L8MetaData metadata = 2`
    pattern *(rule: `proto-list-convention`)*.
  - **User provisioning + role definition are in the companion
    security plan** (`plans/consumer-mobility-security.md`). This PR
    covers the *data-shaping* half of signup only. The security plan
    supplies:
    - The `consumer` role JSON stanza and its allow/deny rules.
    - The `associate_ids` population strategy.
    - The signup-time call site into
      `Layer8UserProvisioning.createEntityUser` (helper extracted in
      PR0.4) with the consumer spec.
    - Whether/how consumer-created `PhysioClient` records surface to
      therapists.
  - **Signup data flow** (what this PR builds):
    1. Client-side JS calls the security-plan-owned user-provisioning
       helper (creates area-73 user + associated role).
    2. Creates a bare `PhysioClient` record (empty `therapist_id`, empty
       `boostapp_id`) to hold clinical state (treatment plan linkage,
       home feedback history).
    3. Creates a `ConsumerUser` linking the area-73 user, the
       `PhysioClient`, and the adopted `AnonSession.assessment_result_id`.
    4. Materializes a `TreatmentPlan` from the recommended `PhysioProtocol`
       using the lossless copy from commit `a959658`.
       `TreatmentPlan.client_id = PhysioClient.client_id`,
       `therapist_id = ""`, `status = ACTIVE`.
    5. Sets `ConsumerUser.current_plan_id`.
  - **Multi-area atomicity** — steps 1–5 span areas 73, 50, 51. Adopt
    the `l8services/transaction/states/T05_Rollback.go` state-machine
    pattern for compensating writes on partial failure. Detailed rollback
    semantics for the area-73 user step are in the security plan; this
    PR owns the atomicity envelope covering areas 50 and 51.

- **PR1.4 — Consumer portal `consumer-app.html`**
  - Config-driven mobile portal following the existing `m/app.html`
    pattern (`Layer8MModuleRegistry` + nav config + section files). No
    new behavioral code; **only new config + section files**
    *(verified compliant in [Duplication audit](#duplication-audit) Axis 1)*.
  - New files under `go/physio/ui/web/consumer/`:
    `consumer-nav-config.js` (Layer8MModuleRegistry entry),
    `consumer-app.html` (script wiring + shell).
  - Sections: Home (today's workout), Program (full plan), History
    (`ProgressLog`), Settings.
  - **Reuse of existing modules** *(rule: `reuse-existing-module-forms`)*:
    - `plan-renderer-m.js` — exercise card rendering.
    - `physio-lookups.js` — exercise/protocol name caches.
    - `physio-forms-mobile.js` — form field definitions.
    - `physio-forms-shared.js` — shared form section definitions.
    - **No** new forms, enums, or renderers are defined for existing
      entities.
  - **Date field rendering** *(rule: `date-field-rendering-pipeline`)* —
    consumer views display `TreatmentPlan.start_date`, `end_date`,
    `ProgressLog.date`, all int64 timestamps that serialize as JSON
    strings. All rendering goes through existing `layer8m-utils.js`
    `formatDate` which already handles both numeric and string typed
    values. Verification item: confirm no new date-rendering code paths
    are introduced.
  - **JS field-name verification** *(rule: `js-protobuf-field-names`)* —
    every field in the new consumer nav config's `idField` and column
    keys is cross-referenced against `go/types/physio/physio.pb.go` JSON
    tags. Checklist item on this PR.
  - Auth-gated at the portal level; the specific gate mechanism and
    role are defined in the companion security plan.

**Ship criterion:** Cold browser → landing URL → assessment → result →
signup → mobile daily-workout view. End-to-end, one flow, no dead-ends.

---

### Phase 2 — Program library with structured progression (~8–12 hours)

**Goal:** Users browse a public catalog, filter by joint/category/level,
start a program (superseding the current plan), and graduate through a
Foundation → Build → Advanced chain via re-assessment.

Baseline gap analysis (grounded in `proto/physio.proto` at commit `a959658`):
`PhysioProtocol` already has `name`, `description`, `goals`, `is_active`,
and multi-classification (`joints`, `categories`, `postures`), plus lossless
exercise round-trip to `TreatmentPlan`. `TreatmentPlan.status` covers
DRAFT / ACTIVE / COMPLETED / SUSPENDED. Everything else in this phase is
new.

- **PR2.1 — Protocol catalog schema**
  - **Rename `PhysioPhase` values** (`proto/physio.proto:77-82`) from
    `PHYSIO_PHASE_1/2/3` to `PHYSIO_PHASE_FOUNDATION / BUILD / ADVANCED`.
    Reserve old numbers. Enum is already referenced by exercises,
    `ProgressEntry.current_phase`, and `SessionReport.phase` — audit those
    call sites, no semantic change intended.
  - **New fields on `PhysioProtocol`** (each justified by a Phase-2 PR
    consuming it — no speculative fields):
    - `bool is_public` — catalog visibility (consumed by PR2.3, PR2.4).
    - `PhysioPhase phase` — difficulty level; reuses the enum above
      (consumed by PR2.4 filter chips + badge).
    - `PhysioFrequency target_frequency` — cadence expectation (already
      an existing enum, consumed by PR2.4 card copy).
    - `int32 weeks_estimate` — program length in weeks (PR2.4 copy).
    - `int32 duration_estimate_minutes` — per-session estimate (PR2.4).
    - `string hero_image_url` — card artwork (PR2.4).
    - `int32 sort_order` — editorial ordering (PR2.4).
    - `bool is_featured` — "Start here" flag (PR2.4 featured row).
    - `string next_protocol_id` — graduation chain (consumed by PR2.6, PR2.7).
  - **Extend `PhysioPlanStatus`** with `PHYSIO_PLAN_STATUS_SUPERSEDED = 5`
    (distinct from COMPLETED — the user switched programs mid-flight
    rather than finishing). `PhysioPlanStatus_UNSPECIFIED = 0` already
    exists *(rule: `proto-enum-zero-value`)* — no zero-value change.
  - **Run `proto/make-bindings.sh`** after all proto edits
    *(rule: `protobuf-generation`)*.

- **PR2.2 — Public catalog endpoint**
  - Extend `/50/PhyProto` reads to be reachable pre-auth for records
    where `is_public = true`. Writes remain area-73 auth only.
  - Auth mechanism specifics are owned by the companion security plan
    (same mechanism as `/51/Asmnt` reads from PR1.1).

- **PR2.3 — Consumer catalog UI**
  - New consumer section "Programs" (added to `consumer-nav-config.js`).
  - Filter chips: joint, category, phase (Foundation/Build/Advanced), goal.
  - Cards render: hero image, name, phase badge, duration ("~20 min · 3×
    week"), weeks estimate, exercise count, "Start" button.
  - Featured row at top, sorted by `is_featured` + `sort_order`.
  - **Reuse of existing lookups** *(rule: `reuse-existing-module-forms`)*
    — protocol name/joint/category renderers come from existing
    `physio-lookups.js` and `physio-forms-mobile.js`; no new enum
    renderers introduced.

- **PR2.4 — Start / supersede flow**
  - "Start" on a catalog card:
    1. Marks current `TreatmentPlan` as `SUPERSEDED` (unless it's already
       COMPLETED).
    2. Materializes a new `TreatmentPlan` from the selected protocol via
       the lossless copy shipped in `a959658`.
    3. Redirects to Home with the new plan active.
  - Confirmation modal if there's substantial progress on the current
    plan (>2 weeks or >30% compliance) to avoid accidental resets.

- **PR2.5 — Completion criteria + graduation prompt**
  - New fields on `PhysioProtocol`:
    - `int32 completion_weeks` (default: fall back to `weeks_estimate`).
    - `int32 completion_compliance_pct` (default: 70).
  - New service or callback: on every `HomeFeedback` submit for a plan,
    re-evaluate whether the plan meets its source protocol's completion
    criteria. If yes, set a transient "ready to graduate" flag (in-memory
    or a new field on `TreatmentPlan`).
  - Consumer UI: banner on Home — "You're ready for the next level:
    **[next_protocol.name]**. Take a quick check-in to confirm."

- **PR2.6 — Re-assessment for graduation**
  - Consumer can retake the assessment any time from Settings.
  - Auto-triggered by the "ready to graduate" banner from PR2.5.
  - Assessment scoring receives the current `protocol_id` as context so
    it can bias toward that protocol's `next_protocol_id` (graduation) or
    route sideways if goals changed.
  - On confirmation → same materialize flow as PR2.4. Old plan marked
    `COMPLETED` (not SUPERSEDED — this is a true graduation).

- **PR2.7 — Journey view**
  - New consumer section "My Journey".
  - Timeline of the user's `TreatmentPlan`s with status badges
    (COMPLETED / SUPERSEDED / ACTIVE / next).

---

---

### Phase V — End-to-end verification (~2–3 hours)

*(Rule: `plan-traceability-and-verification`)*

Runs after Phase 2 lands. Verifies every row in the
[Traceability matrix](#traceability-matrix) is exercised end-to-end on
every applicable platform, in a fresh environment.

- **V1 — Consumer path** (mobile viewport + desktop viewport):
  1. Cold browser → `/index.html` → click assessment CTA → answer wizard
     → see recommended program → sign up → land on consumer-app Home
     with active plan. **Covers G1, G2, G3, G5, G6, G7, G8, G9.**
  2. From consumer-app: Browse → filter chips → open a public protocol
     → Start → confirmation → new plan active, old plan `SUPERSEDED`.
     **Covers G10, G11, G12, G13, G14.**
  3. Log a `HomeFeedback` submission that pushes compliance past
     threshold → observe "ready to graduate" banner → retake assessment
     → land on next program, old plan `COMPLETED`.
     **Covers G15, G16.**
  4. Journey section renders full history with correct status badges.
     **Covers G17.**

- **V2 — Therapist path** (desktop viewport):
  1. Log in as therapist → open "Assessment Rules" admin → add / edit /
     delete a routing rule → verify next consumer assessment applies the
     new rule immediately (no restart). **Covers G4.**
  2. Consumer-`PhysioClient` visibility to therapists is verified in the
     **companion security plan** (behavior depends on the scope-rule
     decision made there).

- **V3 — Data-completeness sweep**
  *(Rule: `data-completeness-pipeline`)*
  - For every new proto field in `PhysioProtocol`, `PhysioPlanStatus`,
    `PhysioPhase`, and every new area-51 entity: verify the field flows
    proto → forms/columns → mock data → UI display. No silent empty
    cells.

- **V4 — Rule-compliance sign-off**
  - Every item in the [Rule Compliance Checklist](#rule-compliance-checklist)
    ticks ✓ or is marked N/A with a reason.

**Ship criterion:** all four steps pass in a fresh environment with mock
data + a placeholder assessment content pack.

---

### Phase 3 — Video, landing surface, SEO — **DEFERRED**

Not in current scope. Do not start until Phases 1 and 2 have shipped and a
decision is made to pursue paid launch.

Sketch retained for future reference:

- **PR3.1 — VideoAsset**
  - New proto: `VideoAsset` (url, thumbnail_url, duration_sec, captions_url,
    hls_manifest_url). `PhysioExercise.video_storage_path` migrates to
    `video_asset` reference.
  - Upload tooling extending `go/tests/mocks/cmd/backfill_images/main.go`.
  - Consumer player component (HLS-capable — may need new l8ui component).
  - **External:** CDN account (Cloudflare Stream / Mux — video hosting
    partner decision reopens here).

- **PR3.2 — Condition-specific landing pages**
  - Static per-condition landing pages ("sciatica program",
    "shoulder impingement program", etc.) that route into a pre-scoped
    assessment variant.
  - Not on Layer 8 — static site under `www/` or similar.
  - Body-map landing tool: interactive silhouette → click a joint →
    "take the assessment for X".

- **PR3.3 — Blog (optional / defer)**
  - Markdown-driven blog under `www/blog/`. Purely SEO + email capture.

---

### Phase 4 — Subscription & payments — **DEFERRED**

Not in current scope. Sketch retained for future reference:

- **PR4.1 — Subscription entity + Stripe wiring**
  - New proto: `Subscription` (user_id, tier, status, current_period_end,
    stripe_customer_id, stripe_subscription_id). Service under area 51 (or
    dedicated 52).
  - Stripe SDK integration under new `go/physio/billing/`.
  - Webhook endpoint for subscription lifecycle events.

- **PR4.2 — Access control**
  - New role tier: `consumer_paid` vs `consumer_free`. Gate consumer-app
    routes on active subscription.
  - Free tier scope: assessment result page (always free) + first program
    for 7 days.

- **PR4.3 — Billing UI**
  - Consumer Settings → Subscription tab. Current plan, next charge,
    payment method (Stripe Elements), cancel button.
  - Pricing page on marketing surface.

- **PR4.4 — Trial + HSA/FSA positioning**
  - 7-day free trial default.
  - Optional: HSA/FSA badge + compliant invoice format.

---

### Phase 5 — Community & live coaching — **DEFERRED**

Not in current scope. Sketch retained for future reference:

- **PR5.1** — Async community forum entity + moderation.
- **PR5.2** — Live event scheduling (reuse `BoostappCalendarEvent`).
- **PR5.3** — Recorded live-session library.

---

## Open Decisions

### Resolved

1. ~~**Portal split vs repurpose.**~~ **Resolved: new `consumer-app.html`.**
2. ~~**Service area allocation.**~~ **Resolved: area 51 for consumer entities.**
3. ~~**`PhysioClient` reuse vs new `ConsumerUser`.**~~ **Resolved: new
   `ConsumerUser` entity in area 51 that references an untouched
   `PhysioClient`.**
9. ~~**Assessment routing table format.**~~ **Resolved: proto-backed
   `AssessmentRoutingRule` entity in area 51 with a therapist-app admin
   UI. Editable live, no deploy.**

### Open — content / ownership (blocks real launch, not internal MVP)

- **Clinician availability** to author real assessment questions + scoring
  rules + program list.
- **Existing `PhysioProtocol` records** — are any consumer-ready as-is, or
  do the launch programs all need new authorship?

### Deferred with Phase 3–5

4. **Brand.** l8physio sub-brand, spin-out with own domain, or white-label
   per practice? *(Phase 3 concern.)*
5. **Content strategy for launch.** Reuse existing therapist-shot exercise
   videos, or invest in new production before launch? *(Phase 3 concern.)*
6. **Business model.** Direct-to-consumer subscription, cohort program, or
   hybrid? *(Phase 4 concern.)*
7. **Payments partner.** Stripe + optional HSA/FSA (Truemed / Flex)?
   *(Phase 4 concern.)*
8. **Video hosting partner.** Cloudflare Stream / Mux / self-hosted S3+HLS?
   *(Phase 3 concern.)*

## Related plans

- **`plans/consumer-mobility-security.md`** — companion security plan.
  This main plan intentionally excludes anon-auth mechanism, role/scope
  definitions, user provisioning wiring, PII retention, and
  consumer-vs-therapist visibility rules; they live in the companion. The
  main plan cannot merge its Phase 1 without the companion at least
  drafted and scoped.
- `plans/plan-export-import.md` — protocol↔plan lossless round-trip
  (shipped `a959658`). Foundation for Phase 1 PR1.3.
- `plans/mobile-parity.md` — mobile UI patterns; consumer app inherits its
  scaffolding.
- `plans/realtime-websocket-adoption.md` — DEFERRED. If consumer app needs
  live updates (community, coach responses), unblocking it becomes a
  prerequisite.
- `plans/security-rbac.md` — existing role/scope model that the
  companion security plan extends.

## Rough sizing (Layer 8 velocity)

In-scope:
- **Phase 0:** 3–4 hours (includes PR0.4 user-provisioning extraction)
- **Phase 1:** 18–28 hours (assessment-first MVP — includes `ConsumerUser`
  entity and editable `AssessmentRoutingRule` admin UI). PR1.3 provisioner
  is now a ~15-line wrapper thanks to PR0.4.
- **Phase 2:** 8–12 hours
- **Phase V:** 2–3 hours (end-to-end verification against traceability matrix)

**Total in-scope work: ~4–5 focused days** to a working internal MVP —
stranger → assessment → recommended program → mobile daily workout → catalog
browse → program switch → graduation prompt. No payments, no video CDN, no
marketing surface. Clinician can iterate on routing rules live via the
therapist-app.

Deferred (Phases 3–5) will re-open sizing when scope is reactivated.

## Rule Compliance Checklist

*(Rule: `prd-compliance`)*

Audited against all 132 rules in `../../saichler/l8book/rules/`. Rules not
listed are N/A to a design/plan document (implementation-time only). ✓ =
plan complies; N/A = does not apply to this plan; ⚠ = deferred with the
phase that will address it.

### Plan-workflow

- ✓ `plan-approval-workflow` — draft in `./plans/`, no "should I proceed?" question.
- ✓ `plan-duplication-audit` — [Duplication audit](#duplication-audit) covers two axes. Axis 1 (portal HTMLs): PASS, 0 new duplicated behavioral lines. Axis 2 (user-provisioning JS): initial audit FAILED (3× ~85 LOC ≈ 255 LOC of near-duplication); Phase 0 PR0.4 extracts a shared `Layer8UserProvisioning.createEntityUser` helper before the 3rd instance is added, reducing all three call sites to ~10–15-line wrappers. Post-extraction: PASS on both axes.
- ✓ `plan-platform-completeness` — [Platform completeness audit](#platform-completeness-audit) two-dimensional (component × platform).
- ✓ `plan-traceability-and-verification` — [Traceability matrix](#traceability-matrix) + [Phase V](#phase-v--end-to-end-verification).
- ✓ `prd-compliance` — this section.
- ✓ `never-act-on-questions` — every design decision stated as an explicit choice; open decisions listed separately.
- ✓ `follow-instructions-verify-user-issue` — N/A (this is a greenfield plan, not a bug fix).

### Architecture

- ✓ `architecture-overview` — configuration-driven module pattern stated; consumer-app is a new config, not new behavioral code.
- ✓ `canonical-project-selection` — [classified as ERP-style, canonical = l8erp](#canonical-project-classification).
- ✓ `framework-interface-boundaries` — no changes proposed to `l8types/go/ifs/`.
- ✓ `portals-same-web-server` — `consumer-app.html` under `go/physio/ui/web/`; single `physio_demo` binary.

### Proto / schema

- ✓ `prime-object-references` — classification applied in PR1.1 (Prime Objects: `AnonSession`, `Assessment`, `AssessmentResult`, `AssessmentRoutingRule`, `ConsumerUser`; embedded child types: `AssessmentQuestion`, `AssessmentAnswer`, `RuleCondition`).
- ✓ `proto-enum-zero-value` — every new enum has `UNSPECIFIED = 0`; `PhysioPlanStatus_UNSPECIFIED = 0` already present.
- ✓ `proto-list-convention` — all new `*List` wrappers use `repeated X list = 1; l8api.L8MetaData metadata = 2` (noted in PR1.1, PR1.3).
- ✓ `protobuf-generation` — `proto/make-bindings.sh` mandate stated in [Naming and conventions](#naming-and-conventions) and PR1.1, PR2.1.
- ✓ `protobuf-model-names` — [ServiceName ↔ Protobuf Type table](#servicename--protobuf-model-name-mapping) present.
- ✓ `js-protobuf-field-names` — verification step required in PR1.4 and every UI PR.
- ✓ `data-completeness-pipeline` — V3 in [Phase V](#phase-v--end-to-end-verification).

### Service

- ✓ `events-service-required` — verified in PR1.1 (existing `l8events` activation reused; no new service).
- ✓ `single-owner-database-table` — `physio_demo` owns all area 50/51 tables ([Canonical project classification](#canonical-project-classification)).
- → `associate-ids-scope-view` — companion security plan.
- ⚠ `file-upload-pattern` — `hero_image_url` upload UI deferred to Phase 3 (video/CDN phase); MVP admins can set the URL via existing text field.
- ✓ `maintainability` — all new ServiceNames ≤ 10 chars (audit in [Naming and conventions](#naming-and-conventions)); no plan-introduced files exceed 500 lines.
- N/A `special-cases` — no read-only services or custom CRUD handlers in scope; `AssessmentResult` immutability handled at UI layer, not service layer.

### Security

All security-classification rules are addressed in the **companion security
plan** (`plans/consumer-mobility-security.md`). The main plan is compliant
insofar as it does not embed security concerns; the companion plan is
responsible for its own compliance sign-off.

- → `security-config-structure` — companion security plan.
- → `security-provisioning-channels` — companion security plan.
- → `loginable-entity-user-provisioning` — companion security plan (main plan's PR0.4 extracts the shared provisioning *helper*, security plan owns its *invocation* and role wiring).
- → `associate-ids-scope-view` — companion security plan.
- ✓ `never-import-l8secure` — no Go imports of l8secure anywhere in this plan.
- ✓ `never-edit-vendor` / `never-touch-vendor-or-git` — no vendor / git edits proposed.

### UI (desktop and mobile)

- ✓ `date-field-rendering-pipeline` — existing `layer8m-utils.js formatDate` already dual-type; no new date-rendering paths (PR1.4).
- ✓ `enum-renderer-column-cascade` — new admin UI for routing rules uses existing factory APIs (`Layer8EnumFactory.create/simple/withValues`, `col.enum()` with 4 args).
- ✓ `immutability-ui-alignment` — `AssessmentResult` immutability noted in PR1.2; no edit controls.
- ✓ `inline-popup-rendering-parity` — N/A for consumer-app (wizard, not popup/inline forms); therapist admin rules UI uses standard `Layer8DPopup` pipeline unchanged.
- ✓ `mobile-rules` — consumer-app is mobile-first PWA; the parity requirement reduces to responsive rendering (no separate desktop layer); noted in [Platform completeness audit](#platform-completeness-audit).
- ✓ `reuse-existing-module-forms` — explicit reuse list in PR1.4 (`plan-renderer-m.js`, `physio-lookups.js`, `physio-forms-mobile.js`, `physio-forms-shared.js`) and PR2.3.
- N/A `shared-schemas` — no new schema shapes introduced; new admin UI (rules) follows existing shared schema.
- N/A `desktop-script-loading-order` / `mobile-script-loading-order` — plan-level; specific ordering verified at PR time.
- N/A `app-html-body-from-l8erp` — consumer-app copied from `m/app.html`, not l8erp (mobile portal).

### Deployment

- N/A `deployment-artifacts` — no new deployable service; everything runs in the existing `physio_demo` binary.
- N/A `k8s-three-deployment-modes` / `k8s-yaml-required-entries` — no new deployment.
- ✓ `index-html-redirect` — existing `index.html` retained; plan modifies it to add the assessment CTA (Option B).
- ✓ `login-json-adaptation` — existing `login.json` untouched (no new project copied).
- N/A `demo-directory-sync`, `run-local-script`, `l8pollaris-binary-deployment` — not touched by this plan.

### Framework / vendor

- ✓ `never-edit-vendor`, `never-touch-vendor-or-git`, `no-go-generics`, `vendor-third-party-code`, `introspector-nodes-params` — none violated; plan does not touch vendor code.

### Everything else — audited and N/A

All 132 rules were read. Rules not enumerated above are implementation-time
concerns that this plan does not intersect (specific `l8ui` component
usage, mock generation, test placement, script-loading order, individual
project-location rules for `l8agent`/`l8erp`/`probler`/etc., specific UI
component rules like `layer8d-*` and `layer8m-*` components which the
plan reuses without modification).
