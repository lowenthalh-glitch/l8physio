// Mobile Workout Builder — simplified flow: select params, build, assign to client
// Uses PhysioWorkoutCircuits.assembleCircuits() for circuit assembly (shared desktop logic)
(function() {
    'use strict';

    function _api() { return Layer8DConfig.getApiPrefix(); }
    function _get(url) { return Layer8MAuth.get(url); }

    var CATEGORY_LABELS = { 1: 'Mobility', 2: 'Rehab', 3: 'Strength', 4: 'Functional' };

    window.MobileWorkoutBuilder = {

        // Open builder from nav or button
        open: function(presetClientId) {
            var enums = (window.PhysioManagement || {}).enums || {};
            var postureOpts = _enumOptions(enums.POSTURE || {});
            var jointOpts = _enumOptions(enums.JOINT || {});

            var html = '<div style="padding:4px 0;">' +
                _selectRow('Posture', 'mwb-posture', postureOpts) +
                _selectRow('Joint', 'mwb-joint', jointOpts) +
                _selectRow('Phase', 'mwb-phase', '<option value="1">Phase 1 \u2014 ROM / Control</option><option value="2">Phase 2 \u2014 Strength</option><option value="3">Phase 3 \u2014 Functional</option>') +
                _selectRow('Volume', 'mwb-volume', '<option value="3">3 per circuit</option><option value="4" selected>4 per circuit</option><option value="5">5 per circuit</option>') +
                '<button id="mwb-build" style="width:100%;padding:12px;border:none;border-radius:6px;background:var(--layer8d-primary);color:#fff;font-size:14px;font-weight:600;cursor:pointer;margin-top:12px;">Build Workout</button>' +
                '<div id="mwb-preview" style="margin-top:16px;"></div>' +
                '</div>';

            Layer8MPopup.show({
                title: 'Workout Builder',
                content: html,
                size: 'full',
                showFooter: false,
                onShow: function(popup) {
                    var body = popup && popup.body ? popup.body : popup;
                    if (!body) return;
                    body.querySelector('#mwb-build').addEventListener('click', function() {
                        _build(body, presetClientId);
                    });
                }
            });
        }
    };

    function _selectRow(label, id, opts) {
        return '<div style="margin-bottom:10px;">' +
            '<label style="font-size:13px;font-weight:600;color:var(--layer8d-text-dark);display:block;margin-bottom:4px;">' + label + '</label>' +
            '<select id="' + id + '" style="width:100%;padding:10px;border:1px solid var(--layer8d-border);border-radius:6px;font-size:14px;">' + opts + '</select></div>';
    }

    function _enumOptions(map) {
        return Object.keys(map).filter(function(k) { return k !== '0'; }).map(function(k) {
            return '<option value="' + k + '">' + map[k] + '</option>';
        }).join('');
    }

    function _build(body, presetClientId) {
        var posture = parseInt(body.querySelector('#mwb-posture').value, 10);
        var joint = parseInt(body.querySelector('#mwb-joint').value, 10);
        var phase = parseInt(body.querySelector('#mwb-phase').value, 10);
        var volume = parseInt(body.querySelector('#mwb-volume').value, 10);
        var preview = body.querySelector('#mwb-preview');
        preview.innerHTML = '<div style="padding:12px;color:var(--layer8d-text-muted);">Building\u2026</div>';

        // Fetch exercises
        var q = encodeURIComponent(JSON.stringify({ text: 'select * from PhysioExercise limit 500' }));
        _get(_api() + '/50/PhyExercis?body=' + q)
        .then(function(data) {
            var allEx = data.list || [];
            if (!window.PhysioWorkoutCircuits) { preview.innerHTML = '<div style="color:var(--layer8d-error);">Builder not available.</div>'; return; }
            var protocols = [{ posture: posture, joint: joint }];
            var circuits = PhysioWorkoutCircuits.assembleCircuits(allEx, protocols, null, phase, volume);
            if (!circuits || circuits.length === 0) { preview.innerHTML = '<div style="padding:12px;color:var(--layer8d-text-muted);">No exercises found for this combination.</div>'; return; }
            _renderPreview(preview, circuits, posture, joint, phase, volume, presetClientId);
        })
        .catch(function(err) { preview.innerHTML = '<div style="color:var(--layer8d-error);">' + Layer8DUtils.escapeHtml(err.message || 'Error') + '</div>'; });
    }

    function _renderPreview(container, circuits, posture, joint, phase, volume, presetClientId) {
        var html = '';
        circuits.forEach(function(c) {
            var label = CATEGORY_LABELS[c.category] || ('Circuit ' + c.number);
            html += '<div style="margin-bottom:12px;">';
            html += '<div style="background:var(--layer8d-primary);color:#fff;font-size:12px;font-weight:600;padding:6px 10px;border-radius:6px 6px 0 0;">' + label + ' (Circuit ' + c.number + ')</div>';
            (c.slots || []).forEach(function(slot) {
                var typeBadge = slot.exerciseType === 1 ? 'Fixed' : 'Variable';
                html += '<div style="border:1px solid var(--layer8d-border);border-top:none;padding:8px 10px;background:var(--layer8d-bg-white);font-size:13px;">' +
                    '<span style="font-weight:600;">' + Layer8DUtils.escapeHtml(slot.name) + '</span>' +
                    ' <span style="font-size:11px;color:var(--layer8d-text-muted);">(' + typeBadge + ')</span>' +
                    (slot.sets ? ' \u2022 ' + slot.sets + ' sets' : '') +
                    (slot.reps ? ' \u2022 ' + (slot.repsDisplay || slot.reps) + ' reps' : '') +
                    '</div>';
            });
            html += '</div>';
        });

        html += '<button id="mwb-assign" style="width:100%;padding:12px;border:none;border-radius:6px;background:var(--layer8d-success);color:#fff;font-size:14px;font-weight:600;cursor:pointer;margin-top:8px;">Assign to Client & Save</button>';
        container.innerHTML = html;

        container.querySelector('#mwb-assign').addEventListener('click', function() {
            _assign(circuits, posture, joint, phase, volume, presetClientId);
        });
    }

    function _assign(circuits, posture, joint, phase, volume, presetClientId) {
        if (presetClientId) {
            _savePlan(circuits, presetClientId, posture, joint, phase, volume);
            return;
        }
        // Show client picker
        Layer8MPopup.show({
            title: 'Select Client', size: 'medium', showFooter: true, saveButtonText: 'Assign',
            content: '<div style="padding:12px;"><div id="mwb-client-ref" style="margin-bottom:8px;"><input id="mwb-client-input" type="text" placeholder="Search client..." style="width:100%;padding:10px;border:1px solid var(--layer8d-border);border-radius:6px;font-size:14px;"></div></div>',
            onSave: function(popup) {
                var b = popup && popup.body ? popup.body : popup;
                var input = b ? b.querySelector('#mwb-client-input') : null;
                var clientId = input ? input.dataset.selectedId || input.value : '';
                if (!clientId) { Layer8MUtils.showError('Select a client'); return; }
                Layer8MPopup.close();
                _savePlan(circuits, clientId, posture, joint, phase, volume);
            },
            onShow: function(popup) {
                var b = popup && popup.body ? popup.body : popup;
                var input = b ? b.querySelector('#mwb-client-input') : null;
                if (input && typeof Layer8MReferencePicker !== 'undefined') {
                    Layer8MReferencePicker.show({
                        endpoint: _api() + '/50/PhyClient',
                        modelName: 'PhysioClient',
                        idColumn: 'clientId',
                        displayColumn: 'lastName',
                        displayFormat: function(item) { return (item.firstName || '') + ' ' + (item.lastName || ''); },
                        onChange: function(id) { input.dataset.selectedId = id; input.value = id; }
                    });
                }
            }
        });
    }

    function _savePlan(circuits, clientId, posture, joint, phase, volume) {
        // Build plan exercises from circuits
        var exercises = [];
        circuits.forEach(function(c) {
            (c.slots || []).forEach(function(slot, idx) {
                exercises.push({
                    planExerciseId: 'pe-' + Date.now() + '-' + exercises.length,
                    exerciseId: slot.exerciseId,
                    sets: slot.sets || 3,
                    reps: slot.reps || 12,
                    notes: slot.notes || '',
                    orderIndex: idx + 1,
                    circuitNumber: c.category || c.number,
                    circuitLabel: CATEGORY_LABELS[c.category] || ('Circuit ' + c.number),
                    loadType: slot.exercise ? (slot.exercise.loadType || 0) : 0
                });
            });
        });

        var POSTURE_CODES = { 1:'KYPH', 2:'LORD', 3:'UFLAT', 4:'LFLAT', 5:'VALG', 6:'PRON', 7:'GEN' };
        var JOINT_CODES = { 1:'SHO', 2:'KNE', 3:'ANK', 4:'LBP', 5:'ELB', 6:'GEN', 7:'HIP', 8:'CORE', 9:'SIJ' };
        var code = (POSTURE_CODES[posture] || '?') + '-' + (JOINT_CODES[joint] || '?');
        var phaseLabels = { 1: 'Phase 1', 2: 'Phase 2', 3: 'Phase 3' };
        var title = code + ' \u2014 ' + (phaseLabels[phase] || 'Phase ' + phase) + ' Program';

        var plan = {
            clientId: clientId,
            title: title,
            status: 2, // Active
            startDate: Math.floor(Date.now() / 1000),
            volume: volume,
            exercises: exercises
        };

        Layer8MAuth.post(_api() + '/50/PhyPlan', plan)
        .then(function() {
            Layer8MPopup.close();
            Layer8MUtils.showSuccess('Plan created and assigned');
        })
        .catch(function(err) { Layer8MUtils.showError('Error: ' + (err.message || err)); });
    }
})();
