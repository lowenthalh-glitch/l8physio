// Plan ↔ Protocol bridge — shared helpers for the desktop plan editor and
// workout builder. Mobile uses its own thin equivalents (different auth/popup
// primitives), so this file is intentionally desktop-only.
(function() {
    'use strict';

    function _authHeaders() {
        var t = sessionStorage.getItem('bearerToken');
        var h = { 'Content-Type': 'application/json' };
        if (t) h['Authorization'] = 'Bearer ' + t;
        return h;
    }

    function _apiPrefix() {
        return (typeof Layer8DConfig !== 'undefined' && Layer8DConfig.getApiPrefix)
            ? Layer8DConfig.getApiPrefix() : '/physio';
    }

    function _q(text) {
        return '?body=' + encodeURIComponent(JSON.stringify({ text: text }));
    }

    // replaceExercises — fetches the full TreatmentPlan, hands it to the caller
    // along with a map of existing { exerciseId → planExerciseId } so IDs can be
    // preserved on update, then PUTs the modified plan back.
    //
    //   buildNewExercises(fullPlan, existingIds) → newExercises[]
    //     - May mutate fullPlan (e.g. update description/goals) before returning.
    //     - Should return the array to assign as fullPlan.exercises.
    //
    // Caller is responsible for surfacing success — this helper only throws on
    // HTTP failure so callers can decorate the error message.
    async function replaceExercises(planId, buildNewExercises) {
        if (!planId) throw new Error('No plan ID');

        var prefix  = _apiPrefix();
        var getResp = await fetch(prefix + '/50/PhyPlan' + _q('select * from TreatmentPlan where planId=' + planId + ' limit 1'),
            { headers: _authHeaders() });
        if (!getResp.ok) throw new Error('Fetch plan HTTP ' + getResp.status);

        var data     = await getResp.json();
        var fullPlan = (data.list || [])[0];
        if (!fullPlan) throw new Error('Plan not found: ' + planId);

        var existingIds = {};
        (fullPlan.exercises || []).forEach(function(pe) {
            if (pe.exerciseId && pe.planExerciseId) {
                existingIds[pe.exerciseId] = pe.planExerciseId;
            }
        });

        fullPlan.exercises = buildNewExercises(fullPlan, existingIds);

        var putResp = await fetch(prefix + '/50/PhyPlan', {
            method:  'PUT',
            headers: _authHeaders(),
            body:    JSON.stringify(fullPlan)
        });
        if (!putResp.ok) throw new Error('Update plan HTTP ' + putResp.status);

        return fullPlan;
    }

    // ── Export: TreatmentPlan → PhysioProtocol ────────────────────────────────

    function _unionMulti(exercise, multiKey, singularKey) {
        if (!exercise) return [];
        var arr = exercise[multiKey];
        if (Array.isArray(arr) && arr.length) return arr.slice();
        var single = exercise[singularKey];
        return single ? [single] : [];
    }

    function _mergeInto(set, values) {
        values.forEach(function(v) { if (v) set[v] = true; });
    }

    function _planExerciseToProtocolExercise(pe, exerciseName) {
        return {
            protocolExerciseId: '',
            exerciseId:         pe.exerciseId,
            exerciseName:       exerciseName,
            sets:               pe.sets         || 0,
            orderIndex:         pe.orderIndex   || 0,
            loadType:           pe.loadType     || 0,
            effort:             '',
            weightKg:           pe.weightKg     || 0,
            reps:               pe.reps         || 0,
            holdSeconds:        pe.holdSeconds  || 0,
            frequency:          pe.frequency    || 0,
            notes:              pe.notes        || '',
            circuitNumber:      pe.circuitNumber || 0,
            circuitLabel:       pe.circuitLabel || ''
        };
    }

    // exportPlanAsProtocol — POSTs a new PhysioProtocol mirroring the plan's
    // exercises. joints/categories/postures are derived as the union of source
    // exercises' multi-fields (falling back to singular when multi is empty).
    async function exportPlanAsProtocol(plan, name) {
        if (!plan) throw new Error('No plan to export');
        if (!name) throw new Error('Protocol name is required');

        var lookups = (window.PhysioManagement && window.PhysioManagement.lookups) || null;
        var jointSet = {}, categorySet = {}, postureSet = {};
        var exercises = (plan.exercises || []).map(function(pe) {
            var src = lookups && lookups.exercise ? lookups.exercise(pe.exerciseId) : null;
            _mergeInto(jointSet,    _unionMulti(src, 'joints',     'joint'));
            _mergeInto(categorySet, _unionMulti(src, 'categories', 'category'));
            _mergeInto(postureSet,  _unionMulti(src, 'postures',   'posture'));
            var exerciseName = (src && src.name) || (lookups && lookups.exerciseName(pe.exerciseId)) || pe.exerciseId;
            return _planExerciseToProtocolExercise(pe, exerciseName);
        });

        var toInts = function(set) { return Object.keys(set).map(function(k) { return parseInt(k, 10); }); };

        var protocol = {
            protocolId:  '',
            name:        name,
            description: plan.description || '',
            goals:       plan.goals || '',
            isActive:    true,
            joints:      toInts(jointSet),
            categories:  toInts(categorySet),
            postures:    toInts(postureSet),
            exercises:   exercises
        };

        var resp = await fetch(_apiPrefix() + '/50/PhyProto', {
            method:  'POST',
            headers: _authHeaders(),
            body:    JSON.stringify(protocol)
        });
        if (!resp.ok) throw new Error('Create protocol HTTP ' + resp.status);
        return protocol;
    }

    // ── Import: PhysioProtocol → TreatmentPlan ────────────────────────────────

    function _protocolExerciseToPlanExercise(pre, existingIds) {
        return {
            planExerciseId: existingIds[pre.exerciseId] || '',
            exerciseId:     pre.exerciseId,
            sets:           pre.sets         || 0,
            reps:           pre.reps         || 0,
            holdSeconds:    pre.holdSeconds  || 0,
            frequency:      pre.frequency    || 0,
            notes:          pre.notes        || '',
            orderIndex:     pre.orderIndex   || 0,
            circuitNumber:  pre.circuitNumber || 0,
            circuitLabel:   pre.circuitLabel || '',
            loadType:       pre.loadType     || 0,
            weightKg:       pre.weightKg     || 0
        };
    }

    async function listActiveProtocols() {
        var resp = await fetch(_apiPrefix() + '/50/PhyProto' + _q('select * from PhysioProtocol where isActive=true'),
            { headers: _authHeaders() });
        if (!resp.ok) throw new Error('List protocols HTTP ' + resp.status);
        var data = await resp.json();
        return data.list || [];
    }

    async function fetchProtocol(protocolId) {
        var resp = await fetch(_apiPrefix() + '/50/PhyProto' + _q('select * from PhysioProtocol where protocolId=' + protocolId + ' limit 1'),
            { headers: _authHeaders() });
        if (!resp.ok) throw new Error('Fetch protocol HTTP ' + resp.status);
        var data = await resp.json();
        var p    = (data.list || [])[0];
        if (!p) throw new Error('Protocol not found: ' + protocolId);
        return p;
    }

    // importProtocolIntoPlan — replaces the target plan's exercises with the
    // protocol's, and overwrites description + goals (snapshot, no link).
    async function importProtocolIntoPlan(planId, protocolId) {
        var protocol = await fetchProtocol(protocolId);
        return replaceExercises(planId, function(fullPlan, existingIds) {
            fullPlan.description = protocol.description || '';
            fullPlan.goals       = protocol.goals       || '';
            return (protocol.exercises || []).map(function(pre) {
                return _protocolExerciseToPlanExercise(pre, existingIds);
            });
        });
    }

    // createPlanFromProtocol — POSTs a new Active TreatmentPlan for the client,
    // seeded from the protocol's exercises/description/goals. Used when the
    // client has no plan yet so import can still create one.
    async function createPlanFromProtocol(clientId, protocolId) {
        if (!clientId) throw new Error('Client ID is required');
        var protocol = await fetchProtocol(protocolId);
        var plan = {
            clientId:    clientId,
            userId:      sessionStorage.getItem('currentUser') || '',
            title:       protocol.name || 'Workout Plan',
            description: protocol.description || '',
            goals:       protocol.goals || '',
            status:      2, // Active
            startDate:   Math.floor(Date.now() / 1000),
            exercises:   (protocol.exercises || []).map(function(pre) {
                return _protocolExerciseToPlanExercise(pre, {});
            })
        };
        var resp = await fetch(_apiPrefix() + '/50/PhyPlan', {
            method:  'POST',
            headers: _authHeaders(),
            body:    JSON.stringify(plan)
        });
        if (!resp.ok) throw new Error('Create plan HTTP ' + resp.status);
        return plan;
    }

    window.PhysioPlanProtocol = {
        replaceExercises:        replaceExercises,
        exportPlanAsProtocol:    exportPlanAsProtocol,
        listActiveProtocols:     listActiveProtocols,
        importProtocolIntoPlan:  importProtocolIntoPlan,
        createPlanFromProtocol:  createPlanFromProtocol
    };
})();
