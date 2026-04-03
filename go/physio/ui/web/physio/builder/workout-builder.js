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

    function _enumOptions(map) {
        return Object.keys(map).filter(function(k) { return k !== '0'; }).map(function(k) {
            return '<option value="' + k + '">' + map[k] + '</option>';
        }).join('');
    }

    function _renderPanel() {
        var enums       = (window.PhysioManagement && window.PhysioManagement.enums) || {};
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
                    '<option value="4" selected>4 per circuit</option>',
                    '<option value="5">5 per circuit</option>',
                  '</select>',
                '</div>',
                '<div class="wb-ctrl">',
                  '<label class="wb-label">Protocol</label>',
                  '<span id="wb-protocol" class="wb-protocol-badge"></span>',
                '</div>',
                '<div class="wb-ctrl wb-ctrl-build">',
                  '<button id="wb-add-protocol" class="layer8d-btn layer8d-btn-secondary layer8d-btn-small">+ Add Protocol</button>',
                  '<button id="wb-build" class="layer8d-btn layer8d-btn-primary layer8d-btn-small">&#9654; Build Workout</button>',
                '</div>',
              '</div>',
              '<div id="wb-extra-rows"></div>',
              '<div id="wb-output"></div>',
            '</div>'
        ].join('');
    }

    function _addExtraRow(container) {
        var enums       = (window.PhysioManagement && window.PhysioManagement.enums) || {};
        var postureOpts = _enumOptions(enums.POSTURE || {});
        var jointOpts   = _enumOptions(enums.JOINT   || {});

        var row = document.createElement('div');
        row.className = 'wb-extra-row';
        row.innerHTML = [
            '<span class="wb-extra-row-label">+</span>',
            '<select class="wb-row-posture wb-select">' + postureOpts + '</select>',
            '<select class="wb-row-joint wb-select">' + jointOpts + '</select>',
            '<span class="wb-row-badge wb-protocol-badge"></span>',
            '<button class="wb-row-remove layer8d-btn layer8d-btn-secondary layer8d-btn-small">\u00d7 Remove</button>'
        ].join('');

        var postureEl = row.querySelector('.wb-row-posture');
        var jointEl   = row.querySelector('.wb-row-joint');
        var badgeEl   = row.querySelector('.wb-row-badge');

        function _sync() {
            badgeEl.textContent = _protocolCode(postureEl.value, jointEl.value);
        }
        postureEl.addEventListener('change', _sync);
        jointEl.addEventListener('change', _sync);
        _sync();

        row.querySelector('.wb-row-remove').addEventListener('click', function() {
            row.parentNode.removeChild(row);
        });

        container.querySelector('#wb-extra-rows').appendChild(row);
    }

    async function _build(container) {
        var posture           = parseInt(container.querySelector('#wb-posture').value, 10);
        var joint             = parseInt(container.querySelector('#wb-joint').value,   10);
        var phase             = container.querySelector('#wb-phase').value;
        var volume            = container.querySelector('#wb-volume').value;
        var output            = container.querySelector('#wb-output');
        var codeEl            = container.querySelector('#wb-protocol');

        window.PhysioWorkoutBuilder._lastCircuits  = null;
        window.PhysioWorkoutBuilder._lastProtocols = null;

        codeEl.textContent = _protocolCode(posture, joint);
        output.innerHTML = '<div class="wb-loading">Loading exercises\u2026</div>';

        // Collect primary protocol + any extra rows
        var protocols = [{ posture: posture, joint: joint }];
        container.querySelectorAll('.wb-extra-row').forEach(function(row) {
            var p = parseInt(row.querySelector('.wb-row-posture').value, 10);
            var j = parseInt(row.querySelector('.wb-row-joint').value,   10);
            protocols.push({ posture: p, joint: j });
        });

        // Find unique joints to minimise fetch calls
        var uniqueJoints = protocols.reduce(function(acc, p) {
            if (acc.indexOf(p.joint) === -1) acc.push(p.joint);
            return acc;
        }, []);

        try {
            var allFetched = [];
            for (var ji = 0; ji < uniqueJoints.length; ji++) {
                var query = 'select * from PhysioExercise where joint=' + uniqueJoints[ji] + ' limit 500';
                var url   = _apiPrefix() + '/50/PhyExercis?body=' + encodeURIComponent(JSON.stringify({ text: query }));
                var resp  = await fetch(url, { headers: _authHeaders() });
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                var data  = await resp.json();
                allFetched = allFetched.concat(data.list || []);
            }

            // Deduplicate and tag each exercise with its matching protocol
            var seen      = {};
            var exercises = [];
            allFetched.forEach(function(ex) {
                if (seen[ex.exerciseId]) return;
                for (var pi = 0; pi < protocols.length; pi++) {
                    var p = protocols[pi];
                    if (ex.posture === p.posture && ex.joint === p.joint) {
                        seen[ex.exerciseId] = true;
                        exercises.push(ex);
                        break;
                    }
                }
            });

            // Cache for inline-edit exercise picker
            window.PhysioWorkoutCircuits._allExercises = exercises;

            if (exercises.length === 0) {
                var protoCodes = protocols.map(function(p) { return _protocolCode(p.posture, p.joint); }).join(', ');
                output.innerHTML = [
                    '<div class="wb-empty-state">',
                      '<div class="wb-empty-icon">&#128203;</div>',
                      '<div>No exercises found for <strong>' + Layer8DUtils.escapeHtml(protoCodes) + '</strong>.</div>',
                      '<div class="wb-empty-hint">Add exercises in the Exercises tab with matching Joint and Posture values.</div>',
                    '</div>'
                ].join('');
                return;
            }

            var circuits = window.PhysioWorkoutCircuits.assembleCircuits(
                exercises, protocols, null, phase, volume
            );
            window.PhysioWorkoutBuilder._lastCircuits  = circuits;
            window.PhysioWorkoutBuilder._lastProtocols = protocols;

            window.PhysioWorkoutCircuits.renderAll(output, circuits);

            var isEdit = window.PhysioWorkoutBuilder._mode === 'edit';
            var assignBar = document.createElement('div');
            assignBar.className = 'wb-assign-row';
            assignBar.innerHTML = '<button class="layer8d-btn layer8d-btn-primary layer8d-btn-small wb-assign-btn"' +
                ' data-posture="' + posture + '" data-joint="' + joint + '"' +
                ' data-phase="' + phase + '" data-volume="' + volume + '">' +
                (isEdit ? '&#9998; Update Plan' : '&#128100; Assign to Client') +
                '</button>';
            output.appendChild(assignBar);

            assignBar.querySelector('.wb-assign-btn').addEventListener('click', function() {
                if (window.PhysioWorkoutBuilder._mode === 'edit') {
                    var fn = window.PhysioWorkoutBuilder._updatePlan;
                    if (fn) fn();
                } else {
                    var fn2 = window.PhysioWorkoutBuilder._showAssignPopup;
                    if (fn2) fn2(assignBar.querySelector('.wb-assign-btn').dataset);
                }
            });

        } catch(e) {
            output.innerHTML = '<div class="wb-error">&#9888; Error: ' + Layer8DUtils.escapeHtml(e.message) + '</div>';
        }
    }

    function _setupBuilder(container, opts) {
        opts = opts || {};
        container.innerHTML = _renderPanel();

        // Back button (shown when opened from within client popup)
        if (opts.onCancel) {
            var backBtn = document.createElement('button');
            backBtn.className = 'layer8d-btn layer8d-btn-secondary layer8d-btn-small wb-back-btn';
            backBtn.innerHTML = '\u2190 Back';
            backBtn.addEventListener('click', function() {
                if (opts.onCancel) opts.onCancel();
            });
            container.querySelector('.wb-panel').insertBefore(backBtn, container.querySelector('.wb-controls'));
            window.PhysioWorkoutBuilder._onCancel = opts.onCancel;
        }

        var postureEl  = container.querySelector('#wb-posture');
        var jointEl    = container.querySelector('#wb-joint');
        var protocolEl = container.querySelector('#wb-protocol');

        function _syncCode() {
            protocolEl.textContent = _protocolCode(postureEl.value, jointEl.value);
        }
        postureEl.addEventListener('change', _syncCode);
        jointEl.addEventListener('change',   _syncCode);
        _syncCode();

        container.querySelector('#wb-add-protocol').addEventListener('click', function() {
            _addExtraRow(container);
        });
        container.querySelector('#wb-build').addEventListener('click', function() {
            _build(container);
        });

        if (opts.preset) {
            var p = opts.preset;
            if (p.posture) postureEl.value = String(p.posture);
            if (p.joint)   jointEl.value   = String(p.joint);
            if (p.phase) {
                var phaseEl = container.querySelector('#wb-phase');
                if (phaseEl) phaseEl.value = String(p.phase);
            }
            if (p.volume) {
                var volEl = container.querySelector('#wb-volume');
                if (volEl) volEl.value = String(p.volume);
            }
            _syncCode();
        }

        if (opts.mode === 'edit') {
            var note = document.createElement('div');
            note.className = 'wb-phase-note';
            note.textContent = 'Editing existing plan. Adjust settings and click Build Workout to preview, then Update Plan to save.';
            var panel = container.querySelector('.wb-panel');
            var controls = container.querySelector('.wb-controls');
            panel.insertBefore(note, controls);
        }

        window.PhysioWorkoutBuilder._mode      = opts.mode      || 'new';
        window.PhysioWorkoutBuilder._planId    = opts.planId    || null;
        window.PhysioWorkoutBuilder._clientId  = opts.clientId  || null;
        window.PhysioWorkoutBuilder._onRefresh = opts.onRefresh || null;
        window.PhysioWorkoutBuilder._onCancel  = opts.onCancel  || null;
    }

    window.PhysioWorkoutBuilder = {
        _initialized:    false,
        _lastCircuits:   null,
        _lastProtocols:  null,
        _mode:           'new',
        _planId:         null,
        _clientId:       null,
        _onRefresh:      null,
        _onCancel:       null,
        _showAssignPopup: null,
        _updatePlan:     null,

        init: function(containerId) {
            var container = document.getElementById(containerId);
            if (!container || this._initialized) return;
            this._initialized = true;
            _setupBuilder(container, {});
        },

        setupInContainer: function(container, opts) {
            _setupBuilder(container, opts || {});
        }
    };

})();
