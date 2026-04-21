(function() {
    'use strict';

    var ROLES_ENDPOINT = '/74/roles';
    var USERS_ENDPOINT = '/73/users';
    var DEFAULT_PASSWORD = '12345678';

    function getHeaders() {
        return Object.assign({ 'Content-Type': 'application/json' },
            typeof getAuthHeaders === 'function' ? getAuthHeaders() : {});
    }

    async function postRole(role) {
        try {
            var resp = await fetch(Layer8DConfig.resolveEndpoint(ROLES_ENDPOINT), {
                method: 'POST', headers: getHeaders(), body: JSON.stringify(role)
            });
            if (!resp.ok) console.warn('[UserProvisioning] role creation returned', resp.status);
        } catch (e) {
            console.warn('[UserProvisioning] role creation failed', e);
        }
    }

    async function postUser(user) {
        try {
            var resp = await fetch(Layer8DConfig.resolveEndpoint(USERS_ENDPOINT), {
                method: 'POST', headers: getHeaders(), body: JSON.stringify(user)
            });
            if (!resp.ok) {
                console.warn('[UserProvisioning] user creation returned', resp.status, await resp.text());
                return false;
            }
            return true;
        } catch (e) {
            console.warn('[UserProvisioning] user creation failed', e);
            return false;
        }
    }

    function denyRule(ruleId, elemType, queryStr) {
        var attrs = {};
        attrs[elemType] = queryStr;
        return { ruleId: ruleId, elemType: elemType, allowed: false, actions: { '5': true }, attributes: attrs };
    }

    async function createClientUser(client) {
        var email = client.email;
        if (!email) return;
        // userId = clientId so deny-scope rules (${userId} = clientId) work correctly
        // email field enables login by email via l8secure email login
        var userId = client.clientId;
        var roles = {}; roles['client'] = true;
        var ok = await postUser({
            userId: userId, fullName: (client.firstName + ' ' + client.lastName).trim(),
            email: email, accountStatus: 'ACCOUNT_STATUS_ACTIVE',
            portal: 'client-app.html', password: { hash: DEFAULT_PASSWORD }, roles: roles
        });
        if (ok) Layer8DNotification.success('User account "' + email + '" created');
        else    Layer8DNotification.warning('Client saved but user account creation failed');
    }

    async function createTherapistUser(therapist) {
        var therapistId = therapist.therapistId;
        if (!therapistId) return;

        var email = therapist.email;
        if (!email) return;
        // userId = therapistId so deny-scope rules (${userId} = therapistId) work correctly
        var roles = {}; roles['therapist'] = true;
        var ok = await postUser({
            userId: therapistId, fullName: (therapist.firstName + ' ' + therapist.lastName).trim(),
            email: email, accountStatus: 'ACCOUNT_STATUS_ACTIVE',
            portal: 'therapist-app.html', password: { hash: DEFAULT_PASSWORD }, roles: roles
        });
        if (ok) Layer8DNotification.success('User account "' + email + '" created');
        else    Layer8DNotification.warning('Therapist saved but user account creation failed');
    }

    window.PhysioUserProvisioning = {
        createClientUser: createClientUser,
        createTherapistUser: createTherapistUser
    };
})();
