(function() {
    'use strict';

    var POSTURE_CODES = { 1:'KYPH', 2:'LORD', 3:'UFLAT', 4:'LFLAT', 5:'VALG', 6:'PRON', 7:'GEN' };
    var JOINT_CODES   = { 1:'SHO',  2:'KNE',  3:'ANK',  4:'LBP',  5:'ELB',  6:'GEN', 7:'HIP', 8:'CORE', 9:'SIJ' };

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

    function _protocolCode(posture, joint) {
        return (POSTURE_CODES[posture] || '?') + '-' + (JOINT_CODES[joint] || '?');
    }

    function _clientOptions() {
        var lookup  = window.PhysioManagement && window.PhysioManagement.lookups;
        var clients = lookup ? lookup._clients : {};
        var opts = '<option value="">— Select Client —</option>';
        Object.keys(clients).forEach(function(id) {
            opts += '<option value="' + id + '">' + Layer8DUtils.escapeHtml(clients[id]) + '</option>';
        });
        return opts;
    }

    function _todayValue() {
        return new Date().toISOString().slice(0, 10);
    }

    function _showAssignPopup(ds) {
        var phase   = ds.phase;
        var volume  = ds.volume;
        var presetClientId = window.PhysioWorkoutBuilder._clientId || '';
        var allProtocols = window.PhysioWorkoutBuilder._lastProtocols || [{ posture: ds.posture, joint: ds.joint }];
        var protoCodes   = allProtocols.map(function(p) { return _protocolCode(p.posture, p.joint); });
        var code         = protoCodes.join(' + ');
        var phaseLabels  = { '1': 'Phase 1', '2': 'Phase 2', '3': 'Phase 3' };
        var defaultTitle = code + ' \u2014 ' + (phaseLabels[phase] || 'Phase ' + phase) + ' Program';

        // If opened from a client popup, skip client selection
        var clientRow = presetClientId
            ? ''
            : '<div class="wb-af-row">' +
                '<label class="wb-af-label">Client <span class="wb-required">*</span></label>' +
                '<select id="wb-af-client" class="wb-af-input">' + _clientOptions() + '</select>' +
              '</div>';

        var content = [
            '<div class="wb-assign-form">',
              clientRow,
              '<div class="wb-af-row">',
                '<label class="wb-af-label">Plan Title</label>',
                '<input type="text" id="wb-af-title" class="wb-af-input" value="' + Layer8DUtils.escapeHtml(defaultTitle) + '">',
              '</div>',
              '<div class="wb-af-row">',
                '<label class="wb-af-label">Start Date</label>',
                '<input type="date" id="wb-af-date" class="wb-af-input" value="' + _todayValue() + '">',
              '</div>',
              '<div class="wb-af-row">',
                '<label class="wb-af-label">Protocol</label>',
                '<span class="wb-af-static">' + code + '</span>',
              '</div>',
              '<div class="wb-af-row">',
                '<label class="wb-af-label">Volume</label>',
                '<span class="wb-af-static">' + volume + ' exercises per circuit</span>',
              '</div>',
            '</div>'
        ].join('');

        Layer8DPopup.show({
            title: presetClientId ? 'Assign Workout' : 'Assign Workout to Client',
            content: content,
            size: 'small',
            showFooter: true,
            saveButtonText: 'Assign',
            onSave: function() {
                var body     = Layer8DPopup.getBody();
                var clientEl = body ? body.querySelector('#wb-af-client') : document.getElementById('wb-af-client');
                var clientId = presetClientId || (clientEl ? clientEl.value : '');
                var titleEl  = body ? body.querySelector('#wb-af-title')  : document.getElementById('wb-af-title');
                var dateEl   = body ? body.querySelector('#wb-af-date')   : document.getElementById('wb-af-date');
                var title    = titleEl.value.trim();
                var dateVal  = dateEl.value;

                if (!clientId) { Layer8DNotification.error('Please select a client.'); return; }
                if (!title)    { Layer8DNotification.error('Please enter a plan title.'); return; }

                var startDate = dateVal ? Math.floor(new Date(dateVal).getTime() / 1000) : 0;
                _saveAssignment({ clientId: clientId, title: title, startDate: startDate, volume: parseInt(volume, 10) });
            }
        });
    }

    async function _saveAssignment(plan) {
        plan.status = 2;
        plan.userId = sessionStorage.getItem('currentUser') || '';

        var exercises = [];
        var idx = 1;
        (window.PhysioWorkoutBuilder._lastCircuits || []).forEach(function(circuit) {
            circuit.slots.forEach(function(slot) {
                if (!slot) return;
                exercises.push({
                    exerciseId:    slot.exerciseId,
                    sets:          slot.sets  !== undefined ? slot.sets  : 0,
                    reps:          slot.reps  !== undefined ? slot.reps  : 0,
                    holdSeconds:   0,
                    frequency:     0,
                    notes:         slot.notes || '',
                    orderIndex:    idx++,
                    circuitNumber: circuit.num,
                    circuitLabel:  circuit.label || ''
                });
            });
        });
        plan.exercises = exercises;

        var url = _apiPrefix() + '/50/PhyPlan';
        try {
            var resp = await fetch(url, {
                method: 'POST',
                headers: _authHeaders(),
                body: JSON.stringify(plan)
            });
            if (!resp.ok) {
                var errorText = await resp.text().catch(function() { return ''; });
                if (errorText && errorText.toLowerCase().includes('access denied')) {
                    throw new Error('Access Denied — you do not have permission to perform this action.');
                }
                throw new Error('HTTP ' + resp.status);
            }
            Layer8DPopup.close();
            Layer8DNotification.success('Workout assigned to client successfully.');

            var cb = window.PhysioWorkoutBuilder._onRefresh;
            if (cb) {
                window.PhysioWorkoutBuilder._onRefresh = null;
                cb();
            }
        } catch(e) {
            Layer8DNotification.error('Failed to assign: ' + e.message);
        }
    }

    async function _updatePlan() {
        var planId = window.PhysioWorkoutBuilder._planId;
        if (!planId) {
            Layer8DNotification.error('No plan ID set for update.');
            return;
        }

        var prefix = _apiPrefix();
        var query  = encodeURIComponent(JSON.stringify({ text: 'select * from TreatmentPlan where planId=' + planId + ' limit 1' }));

        try {
            var getResp = await fetch(prefix + '/50/PhyPlan?body=' + query, { headers: _authHeaders() });
            if (!getResp.ok) throw new Error('Fetch plan HTTP ' + getResp.status);
            var data     = await getResp.json();
            var fullPlan = (data.list || [])[0];
            if (!fullPlan) throw new Error('Plan not found: ' + planId);

            // Build existingIds map (exerciseId -> planExerciseId) to preserve IDs on update
            var existingIds = {};
            (fullPlan.exercises || []).forEach(function(pe) {
                if (pe.exerciseId && pe.planExerciseId) {
                    existingIds[pe.exerciseId] = pe.planExerciseId;
                }
            });

            // Rebuild exercise list from current circuit layout
            var newExercises = [];
            var idx = 1;
            (window.PhysioWorkoutBuilder._lastCircuits || []).forEach(function(circuit) {
                circuit.slots.forEach(function(slot) {
                    if (!slot) return;
                    newExercises.push({
                        planExerciseId: existingIds[slot.exerciseId] || '',
                        exerciseId:     slot.exerciseId,
                        sets:           slot.sets  !== undefined ? slot.sets  : 0,
                        reps:           slot.reps  !== undefined ? slot.reps  : 0,
                        holdSeconds:    0,
                        frequency:      0,
                        notes:          slot.notes || '',
                        orderIndex:     idx++,
                        circuitNumber:  circuit.num,
                        circuitLabel:   circuit.label || ''
                    });
                });
            });
            fullPlan.exercises = newExercises;

            var putResp = await fetch(prefix + '/50/PhyPlan', {
                method:  'PUT',
                headers: _authHeaders(),
                body:    JSON.stringify(fullPlan)
            });
            if (!putResp.ok) throw new Error('Update plan HTTP ' + putResp.status);

            Layer8DNotification.success('Treatment plan updated successfully.');

            var cb = window.PhysioWorkoutBuilder._onRefresh;
            if (cb) {
                cb();
            }
        } catch(e) {
            Layer8DNotification.error('Failed to update plan: ' + e.message);
        }
    }

    // Register on the public API (workout-builder.js initializes these slots to null)
    window.PhysioWorkoutBuilder._showAssignPopup = _showAssignPopup;
    window.PhysioWorkoutBuilder._updatePlan      = _updatePlan;
})();
