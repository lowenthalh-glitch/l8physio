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

    function _classificationLabel(posture, joint) {
        var enums = (window.PhysioManagement && window.PhysioManagement.enums) || {};
        var p = (enums.POSTURE && enums.POSTURE[posture]) || '?';
        var j = (enums.JOINT   && enums.JOINT[joint])     || '?';
        return p + ' · ' + j;
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
        var presetClientId = window.PhysioWorkoutBuilder._clientId || '';
        var allProtocols = window.PhysioWorkoutBuilder._lastProtocols || [{ posture: ds.posture, joint: ds.joint }];
        var protoLabels  = allProtocols.map(function(p) { return _classificationLabel(p.posture, p.joint); });
        var defaultTitle = protoLabels.join(' + ') + ' Program';

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
                '<label class="wb-af-label">Notes</label>',
                '<textarea id="wb-af-notes" class="wb-af-input" rows="3" placeholder="Treatment notes for the therapist (not shown to the client)."></textarea>',
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
                var notesEl  = body ? body.querySelector('#wb-af-notes')  : document.getElementById('wb-af-notes');
                var title    = titleEl.value.trim();
                var dateVal  = dateEl.value;
                var notes    = notesEl ? notesEl.value : '';

                if (!clientId) { Layer8DNotification.error('Please select a client.'); return; }
                if (!title)    { Layer8DNotification.error('Please enter a plan title.'); return; }

                var startDate = dateVal ? Math.floor(new Date(dateVal).getTime() / 1000) : 0;
                _saveAssignment({ clientId: clientId, title: title, startDate: startDate, notes: notes });
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
                throw new Error('HTTP ' + resp.status + (errorText ? ': ' + errorText : ''));
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

        try {
            await PhysioPlanProtocol.replaceExercises(planId, function(_fullPlan, existingIds) {
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
                            circuitLabel:   circuit.label || '',
                            loadType:       slot.loadType || 0,
                            weightKg:       slot.weightKg || 0
                        });
                    });
                });
                return newExercises;
            });

            Layer8DNotification.success('Treatment plan updated successfully.');

            var cb = window.PhysioWorkoutBuilder._onRefresh;
            if (cb) cb();
        } catch(e) {
            Layer8DNotification.error('Failed to update plan: ' + e.message);
        }
    }

    // Register on the public API (workout-builder.js initializes these slots to null)
    window.PhysioWorkoutBuilder._showAssignPopup = _showAssignPopup;
    window.PhysioWorkoutBuilder._updatePlan      = _updatePlan;
})();
