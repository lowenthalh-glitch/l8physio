(function() {
    'use strict';

    var POSTURE_CODES = { 1:'KYPH', 2:'LORD', 3:'UFLAT', 4:'LFLAT', 5:'VALG', 6:'PRON', 7:'GEN' };
    var JOINT_CODES   = { 1:'SHO',  2:'KNE',  3:'ANK',  4:'LBP',  5:'ELB',  6:'GEN', 7:'HIP', 8:'CORE', 9:'SIJ' };

    var CIRCUITS = [
        { id: 1, label: 'Mobility' },
        { id: 2, label: 'Rehab' },
        { id: 3, label: 'Strength' },
        { id: 4, label: 'Functional' }
    ];

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

    function _enumLabel(val, map) {
        if (!map) return val || '—';
        return map[val] || '—';
    }

    function _enumOptions(map) {
        return Object.keys(map).filter(function(k) { return k !== '0'; }).map(function(k) {
            return '<option value="' + k + '">' + map[k] + '</option>';
        }).join('');
    }

    function _renderPanel() {
        var enums      = (window.PhysioManagement && window.PhysioManagement.enums) || {};
        var postureOpts = _enumOptions(enums.POSTURE || {});
        var jointOpts   = _enumOptions(enums.JOINT   || {});

        return [
            '<div class="wb-panel">',
              '<div class="wb-controls">',
                '<div class="wb-ctrl">',
                  '<label class="wb-label">Posture</label>',
                  '<select id="wb-posture" class="wb-select">' + postureOpts + '</select>',
                '</div>',
                '<div class="wb-ctrl">',
                  '<label class="wb-label">Joint</label>',
                  '<select id="wb-joint" class="wb-select">' + jointOpts + '</select>',
                '</div>',
                '<div class="wb-ctrl">',
                  '<label class="wb-label">Phase</label>',
                  '<select id="wb-phase" class="wb-select">',
                    '<option value="1">Phase 1 — ROM / Control</option>',
                    '<option value="2">Phase 2 — Strength</option>',
                    '<option value="3">Phase 3 — Functional</option>',
                  '</select>',
                '</div>',
                '<div class="wb-ctrl">',
                  '<label class="wb-label">Volume</label>',
                  '<select id="wb-volume" class="wb-select">',
                    '<option value="3">3 per circuit</option>',
                    '<option value="4">4 per circuit</option>',
                    '<option value="5">5 per circuit</option>',
                  '</select>',
                '</div>',
                '<div class="wb-ctrl">',
                  '<label class="wb-label">Protocol</label>',
                  '<span id="wb-protocol" class="wb-protocol-badge"></span>',
                '</div>',
                '<div class="wb-ctrl wb-ctrl-build">',
                  '<button id="wb-build" class="layer8d-btn layer8d-btn-primary layer8d-btn-small">&#9654; Build Workout</button>',
                '</div>',
              '</div>',
              '<div id="wb-output"></div>',
            '</div>'
        ].join('');
    }

    function _renderCircuit(num, label, slots) {
        var enums = (window.PhysioManagement && window.PhysioManagement.enums) || {};

        var rows = slots.map(function(ex, i) {
            if (!ex) {
                return '<tr class="wb-empty-row"><td class="wb-num">' + (i+1) +
                       '</td><td colspan="5" class="wb-empty-cell">—</td></tr>';
            }
            var typeLabel = ex.exerciseType === 1 ? 'Fixed' : 'Variable';
            var typeCls   = ex.exerciseType === 1 ? 'wb-badge-fixed' : 'wb-badge-var';
            var reps      = ex.defaultRepsDisplay || (ex.defaultReps ? String(ex.defaultReps) : '—');
            var sets      = ex.defaultSets || '—';
            var load      = _enumLabel(ex.loadType, enums.LOAD_TYPE);
            var effort    = ex.effort ? ' <span class="wb-effort">RPE ' + ex.effort + '</span>' : '';

            return [
                '<tr>',
                  '<td class="wb-num">' + (i+1) + '</td>',
                  '<td class="wb-name">' + Layer8DUtils.escapeHtml(ex.name || '—') + effort + '</td>',
                  '<td class="wb-sets">' + sets + '</td>',
                  '<td class="wb-reps">' + reps + '</td>',
                  '<td class="wb-load">' + load + '</td>',
                  '<td><span class="wb-badge ' + typeCls + '">' + typeLabel + '</span></td>',
                '</tr>'
            ].join('');
        }).join('');

        return [
            '<div class="wb-circuit">',
              '<div class="wb-circuit-header">Circuit ' + num + ' — ' + label + '</div>',
              '<table class="wb-table">',
                '<thead><tr>',
                  '<th>#</th><th>Exercise</th><th>Sets</th><th>Reps</th><th>Load</th><th>Type</th>',
                '</tr></thead>',
                '<tbody>' + rows + '</tbody>',
              '</table>',
            '</div>'
        ].join('');
    }

    function _assemble(exercises, phase, volume) {
        var phaseInt     = parseInt(phase,  10);
        var variableSlots = parseInt(volume, 10) - 2;

        return CIRCUITS.map(function(circ, idx) {
            var catExs = exercises.filter(function(ex) {
                var p = ex.phase || 0;
                return ex.category === circ.id && (p === 0 || p <= phaseInt);
            });
            var fixed    = catExs.filter(function(ex) { return ex.exerciseType === 1; });
            var variable = catExs.filter(function(ex) { return ex.exerciseType === 2; });

            var slots = [];
            slots.push(fixed[0] || null);
            slots.push(fixed[1] || null);
            for (var j = 0; j < variableSlots; j++) slots.push(variable[j] || null);

            return { num: idx + 1, label: circ.label, slots: slots };
        });
    }

    async function _build(container) {
        var posture = parseInt(container.querySelector('#wb-posture').value, 10);
        var joint   = parseInt(container.querySelector('#wb-joint').value,   10);
        var phase   = container.querySelector('#wb-phase').value;
        var volume  = container.querySelector('#wb-volume').value;
        var output  = container.querySelector('#wb-output');
        var codeEl  = container.querySelector('#wb-protocol');
        // Reset stored circuits
        window.PhysioWorkoutBuilder._lastCircuits = null;

        codeEl.textContent = _protocolCode(posture, joint);
        output.innerHTML = '<div class="wb-loading">Loading exercises\u2026</div>';

        // Query by joint, filter posture client-side (L8Query single-condition safety)
        var query = 'select * from PhysioExercise where joint=' + joint + ' limit 500';
        var url   = _apiPrefix() + '/50/PhyExercis?body=' + encodeURIComponent(JSON.stringify({ text: query }));

        try {
            var resp = await fetch(url, { headers: _authHeaders() });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var data = await resp.json();

            // Filter by posture client-side
            var exercises = (data.list || []).filter(function(ex) {
                return ex.posture === posture;
            });

            if (exercises.length === 0) {
                output.innerHTML = [
                    '<div class="wb-empty-state">',
                      '<div class="wb-empty-icon">&#128203;</div>',
                      '<div>No exercises found for <strong>' + _protocolCode(posture, joint) + '</strong>.</div>',
                      '<div class="wb-empty-hint">Add exercises in the Exercises tab with matching Joint and Posture values.</div>',
                    '</div>'
                ].join('');
                return;
            }

            var circuits = _assemble(exercises, phase, volume);
            // Store for use in assignment
            window.PhysioWorkoutBuilder._lastCircuits = circuits;
            var html = '<div class="wb-circuits">';
            circuits.forEach(function(c) { html += _renderCircuit(c.num, c.label, c.slots); });
            html += '</div>';
            html += '<div class="wb-assign-row">' +
                '<button class="layer8d-btn layer8d-btn-primary layer8d-btn-small wb-assign-btn" ' +
                    'data-posture="' + posture + '" data-joint="' + joint + '" ' +
                    'data-phase="' + phase + '" data-volume="' + volume + '">' +
                    '&#128100; Assign to Client' +
                '</button>' +
            '</div>';
            output.innerHTML = html;

            output.querySelector('.wb-assign-btn').addEventListener('click', function() {
                _showAssignPopup(this.dataset);
            });

        } catch(e) {
            output.innerHTML = '<div class="wb-error">&#9888; Error: ' + Layer8DUtils.escapeHtml(e.message) + '</div>';
        }
    }

    function _clientOptions() {
        var lookup = window.PhysioManagement && window.PhysioManagement.lookups;
        var clients = lookup ? lookup._clients : {};
        var opts = '<option value="">— Select Client —</option>';
        Object.keys(clients).forEach(function(id) {
            opts += '<option value="' + id + '">' + Layer8DUtils.escapeHtml(clients[id]) + '</option>';
        });
        return opts;
    }

    function _todayValue() {
        var d = new Date();
        return d.toISOString().slice(0, 10);
    }

    function _showAssignPopup(ds) {
        var posture  = ds.posture;
        var joint    = ds.joint;
        var phase    = ds.phase;
        var volume   = ds.volume;
        var code     = _protocolCode(posture, joint);
        var phaseLabels = { '1': 'Phase 1', '2': 'Phase 2', '3': 'Phase 3' };
        var defaultTitle = code + ' — ' + (phaseLabels[phase] || 'Phase ' + phase) + ' Program';

        var content = [
            '<div class="wb-assign-form">',
              '<div class="wb-af-row">',
                '<label class="wb-af-label">Client <span class="wb-required">*</span></label>',
                '<select id="wb-af-client" class="wb-af-input">' + _clientOptions() + '</select>',
              '</div>',
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
            title: 'Assign Workout to Client',
            content: content,
            size: 'small',
            showFooter: true,
            saveButtonText: 'Assign',
            onSave: function() {
                var clientId = document.getElementById('wb-af-client').value;
                var title    = document.getElementById('wb-af-title').value.trim();
                var dateVal  = document.getElementById('wb-af-date').value;

                if (!clientId) {
                    Layer8DNotification.error('Please select a client.');
                    return;
                }
                if (!title) {
                    Layer8DNotification.error('Please enter a plan title.');
                    return;
                }

                var startDate = dateVal ? Math.floor(new Date(dateVal).getTime() / 1000) : 0;
                _saveAssignment({ clientId: clientId, title: title, startDate: startDate, volume: parseInt(volume, 10) });
            }
        });
    }

    async function _saveAssignment(plan) {
        plan.status = 2; // Active
        plan.userId = sessionStorage.getItem('currentUser') || '';

        // Build exercises list from the last assembled circuits
        var exercises = [];
        var idx = 1;
        (window.PhysioWorkoutBuilder._lastCircuits || []).forEach(function(circuit) {
            circuit.slots.forEach(function(ex) {
                if (!ex) return;
                exercises.push({
                    exerciseId: ex.exerciseId,
                    sets:       ex.defaultSets  || 0,
                    reps:       ex.defaultReps  || 0,
                    notes:      ex.loadNotes    || '',
                    orderIndex: idx++
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
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            Layer8DPopup.close();
            Layer8DNotification.success('Workout assigned to client successfully.');
        } catch(e) {
            Layer8DNotification.error('Failed to assign: ' + e.message);
        }
    }

    window.PhysioWorkoutBuilder = {
        _initialized: false,
        _lastCircuits: null,

        init: function(containerId) {
            var container = document.getElementById(containerId);
            if (!container || this._initialized) return;
            this._initialized = true;

            container.innerHTML = _renderPanel();

            var postureEl = container.querySelector('#wb-posture');
            var jointEl   = container.querySelector('#wb-joint');
            var protocolEl = container.querySelector('#wb-protocol');

            function _syncCode() {
                protocolEl.textContent = _protocolCode(postureEl.value, jointEl.value);
            }
            postureEl.addEventListener('change', _syncCode);
            jointEl.addEventListener('change', _syncCode);
            _syncCode();

            container.querySelector('#wb-build').addEventListener('click', function() {
                _build(container);
            });
        }
    };
})();
