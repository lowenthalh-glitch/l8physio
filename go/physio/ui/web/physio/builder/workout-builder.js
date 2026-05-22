(function() {
    'use strict';

    var POSTURE_CODES = { 1:'KYPH', 2:'LORD', 3:'UFLAT', 4:'LFLAT', 5:'VALG', 6:'PRON', 7:'GEN' };
    var JOINT_CODES   = { 1:'SHO',  2:'KNE',  3:'ANK',  4:'LBP',  5:'ELB',  6:'GEN', 7:'HIP', 8:'CORE', 9:'SIJ' };

    var CIRCUIT_CATEGORIES = [
        { value: 1, label: 'Mobility'   },
        { value: 2, label: 'Rehab'      },
        { value: 3, label: 'Strength'   },
        { value: 4, label: 'Functional' }
    ];
    var DEFAULT_CIRCUIT_COUNT = 4;

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

    function _circuitPickerHtml() {
        var items = CIRCUIT_CATEGORIES.map(function(c) {
            return [
                '<label class="wb-circuit-pick">',
                  '<input type="checkbox" class="wb-circuit-check" data-cat="' + c.value + '">',
                  '<span class="wb-circuit-name">' + c.label + '</span>',
                  '<input type="number" class="wb-circuit-count" data-cat="' + c.value + '"',
                    ' min="1" max="20" value="' + DEFAULT_CIRCUIT_COUNT + '" disabled>',
                '</label>'
            ].join('');
        }).join('');
        return '<div class="wb-circuit-picker">' + items + '</div>';
    }

    function _wireCircuitPicker(row) {
        row.querySelectorAll('.wb-circuit-check').forEach(function(cb) {
            cb.addEventListener('change', function() {
                var cat   = cb.dataset.cat;
                var count = row.querySelector('.wb-circuit-count[data-cat="' + cat + '"]');
                if (count) count.disabled = !cb.checked;
            });
        });
    }

    function _readCircuits(row) {
        var out = [];
        row.querySelectorAll('.wb-circuit-check').forEach(function(cb) {
            if (!cb.checked) return;
            var cat   = parseInt(cb.dataset.cat, 10);
            var count = row.querySelector('.wb-circuit-count[data-cat="' + cb.dataset.cat + '"]');
            var n     = count ? parseInt(count.value, 10) : DEFAULT_CIRCUIT_COUNT;
            if (isNaN(n) || n < 1) n = 1;
            out.push({ category: cat, count: n });
        });
        return out;
    }

    function _renderPanel() {
        var enums       = (window.PhysioManagement && window.PhysioManagement.enums) || {};
        var postureOpts = _enumOptions(enums.POSTURE || {});
        var jointOpts   = _enumOptions(enums.JOINT   || {});

        return [
            '<div class="wb-panel">',
              '<div id="wb-primary-row" class="wb-proto-block">',
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
                    '<label class="wb-label">Protocol</label>',
                    '<span id="wb-protocol" class="wb-protocol-badge"></span>',
                  '</div>',
                  '<div class="wb-ctrl wb-ctrl-build">',
                    '<button id="wb-add-protocol" class="layer8d-btn layer8d-btn-secondary layer8d-btn-small">+ Add Protocol</button>',
                    '<button id="wb-build" class="layer8d-btn layer8d-btn-primary layer8d-btn-small">&#9654; Build Workout</button>',
                  '</div>',
                '</div>',
                _circuitPickerHtml(),
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
        row.className = 'wb-extra-row wb-proto-block';
        row.innerHTML = [
            '<div class="wb-extra-row-top">',
              '<span class="wb-extra-row-label">+</span>',
              '<select class="wb-row-posture wb-select">' + postureOpts + '</select>',
              '<select class="wb-row-joint wb-select">' + jointOpts + '</select>',
              '<span class="wb-row-badge wb-protocol-badge"></span>',
              '<button class="wb-row-remove layer8d-btn layer8d-btn-secondary layer8d-btn-small">× Remove</button>',
            '</div>',
            _circuitPickerHtml()
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
        _wireCircuitPicker(row);

        row.querySelector('.wb-row-remove').addEventListener('click', function() {
            row.parentNode.removeChild(row);
        });

        container.querySelector('#wb-extra-rows').appendChild(row);
    }

    async function _build(container) {
        var primaryRow = container.querySelector('#wb-primary-row');
        var posture    = parseInt(container.querySelector('#wb-posture').value, 10);
        var joint      = parseInt(container.querySelector('#wb-joint').value,   10);
        var output     = container.querySelector('#wb-output');
        var codeEl     = container.querySelector('#wb-protocol');

        window.PhysioWorkoutBuilder._lastCircuits  = null;
        window.PhysioWorkoutBuilder._lastProtocols = null;

        codeEl.textContent = _protocolCode(posture, joint);

        // Collect primary protocol + any extra rows, each with its own circuit picks
        var protocols = [{
            posture:  posture,
            joint:    joint,
            circuits: _readCircuits(primaryRow)
        }];
        container.querySelectorAll('.wb-extra-row').forEach(function(row) {
            protocols.push({
                posture:  parseInt(row.querySelector('.wb-row-posture').value, 10),
                joint:    parseInt(row.querySelector('.wb-row-joint').value,   10),
                circuits: _readCircuits(row)
            });
        });

        var anyTicked = protocols.some(function(p) { return p.circuits.length > 0; });
        if (!anyTicked) {
            output.innerHTML = '<div class="wb-empty-state">' +
                '<div class="wb-empty-icon">&#9888;</div>' +
                '<div>Tick at least one circuit on a protocol before building.</div>' +
                '</div>';
            return;
        }

        output.innerHTML = '<div class="wb-loading">Loading exercises…</div>';

        // Find unique joints to minimise fetch calls
        var uniqueJoints = protocols.reduce(function(acc, p) {
            if (acc.indexOf(p.joint) === -1) acc.push(p.joint);
            return acc;
        }, []);

        try {
            var allFetched = [];
            for (var ji = 0; ji < uniqueJoints.length; ji++) {
                var query = 'select * from PhysioExercise where joints=' + uniqueJoints[ji] + ' limit 500';
                var url   = _apiPrefix() + '/50/PhyExercis?body=' + encodeURIComponent(JSON.stringify({ text: query }));
                var resp  = await fetch(url, { headers: _authHeaders() });
                if (!resp.ok) {
                    var errText = await resp.text().catch(function() { return ''; });
                    if (errText && errText.toLowerCase().includes('access denied')) {
                        throw new Error('Access Denied — you do not have permission to view this data.');
                    }
                    throw new Error('HTTP ' + resp.status);
                }
                var data  = await resp.json();
                allFetched = allFetched.concat(data.list || []);
            }

            // Deduplicate fetched exercises by id and filter to ones matching some protocol
            var seen      = {};
            var exercises = [];
            allFetched.forEach(function(ex) {
                if (seen[ex.exerciseId]) return;
                for (var pi = 0; pi < protocols.length; pi++) {
                    var p = protocols[pi];
                    var exPostures = (ex.postures && ex.postures.length) ? ex.postures : (ex.posture ? [ex.posture] : []);
                    if (exPostures.indexOf(p.posture) !== -1 && ex.joints && ex.joints.indexOf(p.joint) !== -1) {
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

            var circuits = window.PhysioWorkoutCircuits.assembleCircuits(exercises, protocols);
            window.PhysioWorkoutBuilder._lastCircuits  = circuits;
            window.PhysioWorkoutBuilder._lastProtocols = protocols;

            window.PhysioWorkoutCircuits.renderAll(output, circuits);

            var isEdit = window.PhysioWorkoutBuilder._mode === 'edit';
            var assignBar = document.createElement('div');
            assignBar.className = 'wb-assign-row';
            assignBar.innerHTML = '<button class="layer8d-btn layer8d-btn-primary layer8d-btn-small wb-assign-btn"' +
                ' data-posture="' + posture + '" data-joint="' + joint + '">' +
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
            backBtn.innerHTML = '← Back';
            backBtn.addEventListener('click', function() {
                if (opts.onCancel) opts.onCancel();
            });
            container.querySelector('.wb-panel').insertBefore(backBtn, container.querySelector('#wb-primary-row'));
            window.PhysioWorkoutBuilder._onCancel = opts.onCancel;
        }

        var primaryRow = container.querySelector('#wb-primary-row');
        var postureEl  = container.querySelector('#wb-posture');
        var jointEl    = container.querySelector('#wb-joint');
        var protocolEl = container.querySelector('#wb-protocol');

        function _syncCode() {
            protocolEl.textContent = _protocolCode(postureEl.value, jointEl.value);
        }
        postureEl.addEventListener('change', _syncCode);
        jointEl.addEventListener('change',   _syncCode);
        _syncCode();
        _wireCircuitPicker(primaryRow);

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
            _syncCode();
        }

        if (opts.mode === 'edit') {
            var note = document.createElement('div');
            note.className = 'wb-phase-note';
            note.textContent = 'Editing existing plan. Adjust settings and click Build Workout to preview, then Update Plan to save.';
            var panel = container.querySelector('.wb-panel');
            panel.insertBefore(note, primaryRow);
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
