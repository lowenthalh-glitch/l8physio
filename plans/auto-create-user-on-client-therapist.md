# Auto-Create User Account on Client/Therapist Creation

## Objective
When a PhysioClient or PhysioTherapist is created through the UI Add form, automatically create:
1. A per-entity scope role (e.g., `client-scope-cli-001`)
2. An L8User account with the base role (`client` or `therapist`) + the scope role

This happens silently in the UI layer after the entity POST succeeds, using the same API pattern as System > Security > Users.

---

## Current State

### How Add works today
- `Layer8DModuleCRUD._openAddModal(service)` opens the form via `Layer8DFormsModal.openAddForm()`
- `openAddForm` calls `performSave()` on submit, which calls `Layer8DFormsData.saveRecord()` (POST)
- `saveRecord` returns the server response (parsed JSON containing the created entity with its auto-generated ID)
- **Problem:** `performSave()` discards the response — `.then(function() { ... })` ignores the return value, so the `onSuccess` callback has no access to the created entity's ID

### API endpoints (from l8security)
- **Create role:** `POST /physio/74/roles` with `L8Role` JSON body
- **Create user:** `POST /physio/73/users` with `L8User` JSON body (password as `{ hash: "plaintext" }`)

### Scope role structure (from phy.json)
```json
{
  "roleId": "client-scope-cli-001",
  "roleName": "Client Scope cli-001",
  "rules": {
    "cs-client": {
      "actions": { "5": true },
      "allowed": false,
      "attributes": { "PhysioClient": "select * from PhysioClient where clientId!=cli-001" },
      "elemType": "PhysioClient",
      "ruleId": "cs-client"
    },
    "cs-plan": { ... "TreatmentPlan where clientId!=cli-001" ... },
    "cs-appt": { ... "Appointment where clientId!=cli-001" ... },
    "cs-progress": { ... "ProgressLog where clientId!=cli-001" ... },
    "cs-workout": { ... "GeneratedWorkout where clientId!=cli-001" ... }
  }
}
```

Therapist scope roles follow the same pattern but filter by `therapistId` on PhysioClient, TreatmentPlan, and Appointment (no ProgressLog/GeneratedWorkout — therapists see all).

### User structure
```json
{
  "userId": "james.smith",
  "fullName": "James Smith",
  "email": "james.smith1@example.com",
  "accountStatus": "ACCOUNT_STATUS_ACTIVE",
  "portal": "app.html",
  "password": { "hash": "12345678" },
  "roles": { "client": true, "client-scope-cli-001": true }
}
```

---

## Design

### Approach: Override `_openAddModal` in `physio-init.js`

Override the factory `_openAddModal` for PhysioClient and PhysioTherapist models. The override:
1. Calls the standard form save (POST to `/50/PhyClient` or `/50/PhyTherapt`)
2. Captures the server response to get the generated `clientId`/`therapistId`
3. POSTs the scope role to `/74/roles`
4. POSTs the L8User to `/73/users`

### Why override in the init file (not a new file)
The logic is specific to PhysioClient/PhysioTherapist and tightly coupled to the Add flow. It's a small override (~100 lines) that extends `physio-init.js`, similar to the existing `_showDetailsModal` override there.

### Why not modify `performSave` in the shared library
`performSave` in `layer8d-forms-modal.js` is a shared l8ui component. Modifying it to pass the response to `onSuccess` would be the right long-term fix, but it would change the contract for all projects. Instead, the override will call `saveRecord` directly.

### User ID derivation
- `userId` = `firstName.lastName` (lowercased, no spaces)
- If email is provided, also set it on the user
- Default password: `12345678`

### Error handling
- If the entity POST fails, stop — no role or user creation
- If the scope role POST fails, show a warning but still attempt user creation
- If the user POST fails, show a warning — the entity was already created successfully

---

## Traceability Matrix

| # | Item | Phase |
|---|------|-------|
| 1 | Create `physio-user-provisioning.js` with scope role + user creation helpers | Phase 1 |
| 2 | Override `_openAddModal` for PhysioClient in `physio-init.js` | Phase 2 |
| 3 | Override `_openAddModal` for PhysioTherapist in `physio-init.js` | Phase 2 |
| 4 | Add `therapist` base role and `therapist-scope-*` roles to `phy.json` | Phase 2 |
| 5 | Add script tag for `physio-user-provisioning.js` to `app.html` | Phase 2 |
| 6 | End-to-end verification | Phase 3 |

---

## Phase 1 — User Provisioning Helper

**New file:** `go/physio/ui/web/physio/physio-user-provisioning.js`

This file provides two functions: `createClientUser(entity)` and `createTherapistUser(entity)`.

Each function:
1. Builds the scope role object (deny rules for row-level filtering)
2. POSTs the scope role to `/74/roles`
3. Builds the L8User object with base role + scope role
4. POSTs the user to `/73/users`

```javascript
(function() {
    'use strict';

    var ROLES_ENDPOINT = '/74/roles';
    var USERS_ENDPOINT = '/73/users';
    var DEFAULT_PASSWORD = '12345678';

    function getHeaders() {
        return {
            'Content-Type': 'application/json',
            ...(typeof getAuthHeaders === 'function' ? getAuthHeaders() : {})
        };
    }

    function deriveUserId(firstName, lastName) {
        return (firstName + '.' + lastName).toLowerCase().replace(/\s+/g, '');
    }

    // POST a role, ignoring "already exists" errors
    async function postRole(role) {
        try {
            var resp = await fetch(Layer8DConfig.resolveEndpoint(ROLES_ENDPOINT), {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(role)
            });
            if (!resp.ok) {
                console.warn('PhysioUserProvisioning: role creation returned', resp.status);
            }
        } catch (e) {
            console.warn('PhysioUserProvisioning: role creation failed', e);
        }
    }

    // POST a user
    async function postUser(user) {
        try {
            var resp = await fetch(Layer8DConfig.resolveEndpoint(USERS_ENDPOINT), {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(user)
            });
            if (!resp.ok) {
                var errText = await resp.text();
                console.warn('PhysioUserProvisioning: user creation returned', resp.status, errText);
                return false;
            }
            return true;
        } catch (e) {
            console.warn('PhysioUserProvisioning: user creation failed', e);
            return false;
        }
    }

    // Build a deny rule for row-level scope
    function denyRule(ruleId, elemType, queryStr) {
        var attrs = {};
        attrs[elemType] = queryStr;
        return {
            ruleId: ruleId,
            elemType: elemType,
            allowed: false,
            actions: { '5': true },
            attributes: attrs
        };
    }

    // Create scope role + user for a PhysioClient
    async function createClientUser(client) {
        var clientId = client.clientId;
        if (!clientId) return;

        var scopeRoleId = 'client-scope-' + clientId;

        // 1. Create scope role
        var scopeRole = {
            roleId: scopeRoleId,
            roleName: 'Client Scope ' + clientId,
            rules: {
                'cs-client':   denyRule('cs-client',   'PhysioClient',     'select * from PhysioClient where clientId!='     + clientId),
                'cs-plan':     denyRule('cs-plan',     'TreatmentPlan',    'select * from TreatmentPlan where clientId!='    + clientId),
                'cs-appt':     denyRule('cs-appt',     'Appointment',      'select * from Appointment where clientId!='      + clientId),
                'cs-progress': denyRule('cs-progress', 'ProgressLog',      'select * from ProgressLog where clientId!='      + clientId),
                'cs-workout':  denyRule('cs-workout',  'GeneratedWorkout', 'select * from GeneratedWorkout where clientId!=' + clientId)
            }
        };
        await postRole(scopeRole);

        // 2. Create user
        var userId = deriveUserId(client.firstName, client.lastName);
        var roles = {};
        roles['client'] = true;
        roles[scopeRoleId] = true;

        var user = {
            userId: userId,
            fullName: (client.firstName + ' ' + client.lastName).trim(),
            email: client.email || '',
            accountStatus: 'ACCOUNT_STATUS_ACTIVE',
            portal: 'app.html',
            password: { hash: DEFAULT_PASSWORD },
            roles: roles
        };

        var ok = await postUser(user);
        if (ok) {
            Layer8DNotification.success('User account "' + userId + '" created');
        } else {
            Layer8DNotification.warning('Client saved but user account creation failed');
        }
    }

    // Create scope role + user for a PhysioTherapist
    async function createTherapistUser(therapist) {
        var therapistId = therapist.therapistId;
        if (!therapistId) return;

        var scopeRoleId = 'therapist-scope-' + therapistId;

        // 1. Create scope role
        var scopeRole = {
            roleId: scopeRoleId,
            roleName: 'Therapist Scope ' + therapistId,
            rules: {
                'ts-client': denyRule('ts-client', 'PhysioClient',  'select * from PhysioClient where therapistId!='  + therapistId),
                'ts-plan':   denyRule('ts-plan',   'TreatmentPlan', 'select * from TreatmentPlan where therapistId!=' + therapistId),
                'ts-appt':   denyRule('ts-appt',   'Appointment',   'select * from Appointment where therapistId!='   + therapistId)
            }
        };
        await postRole(scopeRole);

        // 2. Create user
        var userId = deriveUserId(therapist.firstName, therapist.lastName);
        var roles = {};
        roles['therapist'] = true;
        roles[scopeRoleId] = true;

        var user = {
            userId: userId,
            fullName: (therapist.firstName + ' ' + therapist.lastName).trim(),
            email: therapist.email || '',
            accountStatus: 'ACCOUNT_STATUS_ACTIVE',
            portal: 'app.html',
            password: { hash: DEFAULT_PASSWORD },
            roles: roles
        };

        var ok = await postUser(user);
        if (ok) {
            Layer8DNotification.success('User account "' + userId + '" created');
        } else {
            Layer8DNotification.warning('Therapist saved but user account creation failed');
        }
    }

    window.PhysioUserProvisioning = {
        createClientUser: createClientUser,
        createTherapistUser: createTherapistUser
    };
})();
```

---

## Phase 2 — Wire Into Init + Update phy.json

### 2a. Override `_openAddModal` in `physio-init.js`

After the existing `origInit` call, add overrides for `_openAddModal`:

```javascript
// Override _openAddModal for PhysioClient and PhysioTherapist
// to auto-create user accounts after entity creation
var origOpenAdd = window.Physio && window.Physio._openAddModal;
if (typeof origOpenAdd === 'function') {
    window.Physio._openAddModal = function(service) {
        if (service.model === 'PhysioClient' || service.model === 'PhysioTherapist') {
            // Custom add flow: use saveRecord directly to capture the response
            var formDef = Layer8DServiceRegistry.getFormDef('Physio', service.model);
            if (!formDef) {
                origOpenAdd.call(this, service);
                return;
            }
            var serviceConfig = {
                endpoint: Layer8DConfig.resolveEndpoint(service.endpoint),
                primaryKey: Layer8DServiceRegistry.getPrimaryKey('Physio', service.model),
                modelName: service.model
            };

            // Render the standard add form
            var bodyEl = document.createElement('div');
            bodyEl.className = 'probler-popup-body';
            Layer8DFormsFields.generateFormHtml(formDef, {});
            // Use the full modal pipeline but with a custom save handler
            Layer8DFormsPickers.updateFormContext({
                formDef: formDef,
                serviceConfig: serviceConfig,
                isEdit: false,
                onSuccess: null
            });

            Layer8DPopup.show({
                title: 'Add ' + formDef.title,
                content: Layer8DFormsFields.generateFormHtml(formDef, {}),
                size: 'large',
                showFooter: true,
                saveButtonText: 'Save',
                cancelButtonText: 'Cancel',
                onSave: async function() {
                    var ctx = Layer8DFormsPickers.getFormContext();
                    var data = Layer8DFormsData.collectFormData(ctx.formDef);
                    var errors = Layer8DFormsData.validateFormData(ctx.formDef, data);
                    if (errors.length > 0) {
                        Layer8DNotification.error('Validation failed', errors.map(function(e) { return e.message; }));
                        return;
                    }
                    try {
                        var result = await Layer8DFormsData.saveRecord(serviceConfig.endpoint, data, false);
                        Layer8DPopup.close();
                        Layer8DFormsPickers.clearFormContext();
                        Physio.refreshCurrentTable();

                        // Auto-create user account
                        if (result && window.PhysioUserProvisioning) {
                            if (service.model === 'PhysioClient') {
                                PhysioUserProvisioning.createClientUser(result);
                            } else if (service.model === 'PhysioTherapist') {
                                PhysioUserProvisioning.createTherapistUser(result);
                            }
                        }
                    } catch (error) {
                        Layer8DNotification.error('Error saving', [error.message]);
                    }
                },
                onShow: function(body) {
                    Layer8DFormsPickers.setFormContext(formDef, serviceConfig);
                    Layer8DFormsPickers.updateFormContext({
                        formDef: formDef,
                        serviceConfig: serviceConfig,
                        isEdit: false
                    });
                    setTimeout(function() {
                        Layer8DFormsPickers.attachDatePickers(body);
                        Layer8DFormsPickers.attachInlineTableHandlers(body);
                    }, 50);
                }
            });
        } else {
            origOpenAdd.call(this, service);
        }
    };
}
```

### 2b. Add `therapist` base role to `phy.json`

Add the `therapist` role (CRUD on physio types, GET-only on exercises/protocols) alongside the existing `client` role. This was not included in the initial phy.json update.

### 2c. Add script tag to `app.html`

Add `physio-user-provisioning.js` before `physio-init.js`:

```html
<script src="physio/physio-user-provisioning.js"></script>
<script src="physio/physio-init.js"></script>
```

---

## Phase 3 — End-to-End Verification

1. Start system with `run-local.sh`
2. Login as admin
3. Navigate to Physio > Therapists, click Add
   - Fill in firstName, lastName, email
   - Save
   - Verify: success notification "User account xxx created"
   - Navigate to System > Security > Users — verify new user exists with `therapist` + `therapist-scope-{id}` roles
   - Navigate to System > Security > Roles — verify scope role exists
4. Navigate to Physio > Clients, click Add
   - Fill in firstName, lastName, email
   - Save
   - Verify: success notification "User account xxx created"
   - Navigate to System > Security > Users — verify new user with `client` + `client-scope-{id}` roles
5. Login as the newly created client user — verify only their data is visible
6. Login as the newly created therapist user — verify only their clients are visible

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `go/physio/ui/web/physio/physio-user-provisioning.js` | **Create** — scope role + user creation helpers |
| `go/physio/ui/web/physio/physio-init.js` | **Modify** — override `_openAddModal` for PhysioClient/PhysioTherapist |
| `go/physio/ui/web/app.html` | **Modify** — add script tag for provisioning file |
| `../l8secure/go/secure/plugin/phy/phy.json` | **Modify** — add `therapist` base role |

---

## Known Risks

| Risk | Mitigation |
|------|-----------|
| User ID collision (two "James Smith" clients) | `deriveUserId` produces the same ID — second POST will fail with duplicate. Could append clientId suffix if needed. |
| `saveRecord` response format | Verify the POST response returns the entity directly (not wrapped in `{ list: [...] }`). Service callbacks return the entity object. |
| Form context race | The `onShow` callback sets form context after popup renders; the `onSave` reads it. Standard pattern — no race. |
| Scope role POST may fail if `!=` operator unsupported | Same risk as noted in `security-rbac.md` (gap A1). The role will be stored even if the query syntax isn't validated at creation time. |
