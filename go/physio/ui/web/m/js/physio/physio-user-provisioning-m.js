(function() {
    'use strict';

    var ROLES_ENDPOINT = '/74/roles';
    var USERS_ENDPOINT = '/73/users';
    var DEFAULT_PASSWORD = '12345678';

    async function postRole(role) {
        try {
            await Layer8MAuth.post(Layer8MConfig.resolveEndpoint(ROLES_ENDPOINT), role);
        } catch (e) {
            console.warn('[UserProvisioning] role creation failed', e);
        }
    }

    async function postUser(user) {
        try {
            await Layer8MAuth.post(Layer8MConfig.resolveEndpoint(USERS_ENDPOINT), user);
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
        var clientId = client.clientId;
        if (!clientId) return;

        var scopeRoleId = 'client-scope-' + clientId;
        await postRole({
            roleId: scopeRoleId, roleName: 'Client Scope ' + clientId,
            rules: {
                'cs-client':   denyRule('cs-client',   'PhysioClient',     'select * from PhysioClient where clientId!='     + clientId),
                'cs-plan':     denyRule('cs-plan',     'TreatmentPlan',    'select * from TreatmentPlan where clientId!='    + clientId),
                'cs-appt':     denyRule('cs-appt',     'Appointment',      'select * from Appointment where clientId!='      + clientId),
                'cs-progress': denyRule('cs-progress', 'ProgressLog',      'select * from ProgressLog where clientId!='      + clientId),
                'cs-workout':  denyRule('cs-workout',  'GeneratedWorkout', 'select * from GeneratedWorkout where clientId!=' + clientId)
            }
        });

        var roles = {}; roles['client'] = true; roles[scopeRoleId] = true;
        var ok = await postUser({
            userId: clientId, fullName: (client.firstName + ' ' + client.lastName).trim(),
            email: client.email || '', accountStatus: 'ACCOUNT_STATUS_ACTIVE',
            portal: 'app.html', password: { hash: DEFAULT_PASSWORD }, roles: roles
        });
        if (ok) Layer8MUtils.showSuccess('User account "' + clientId + '" created');
        else    Layer8MUtils.showError('Client saved but user account creation failed');
    }

    async function createTherapistUser(therapist) {
        var therapistId = therapist.therapistId;
        if (!therapistId) return;

        var scopeRoleId = 'therapist-scope-' + therapistId;
        await postRole({
            roleId: scopeRoleId, roleName: 'Therapist Scope ' + therapistId,
            rules: {
                'ts-client': denyRule('ts-client', 'PhysioClient',  'select * from PhysioClient where therapistId!='  + therapistId),
                'ts-plan':   denyRule('ts-plan',   'TreatmentPlan', 'select * from TreatmentPlan where therapistId!=' + therapistId),
                'ts-appt':   denyRule('ts-appt',   'Appointment',   'select * from Appointment where therapistId!='   + therapistId)
            }
        });

        var roles = {}; roles['therapist'] = true; roles[scopeRoleId] = true;
        var ok = await postUser({
            userId: therapistId, fullName: (therapist.firstName + ' ' + therapist.lastName).trim(),
            email: therapist.email || '', accountStatus: 'ACCOUNT_STATUS_ACTIVE',
            portal: 'app.html', password: { hash: DEFAULT_PASSWORD }, roles: roles
        });
        if (ok) Layer8MUtils.showSuccess('User account "' + therapistId + '" created');
        else    Layer8MUtils.showError('Therapist saved but user account creation failed');
    }

    window.PhysioUserProvisioningMobile = {
        createClientUser: createClientUser,
        createTherapistUser: createTherapistUser
    };
})();
