// Shared plan editing actions used by both the main workout plan and the session view.
// Avoids duplication of circuit grouping, sorting, move, delete, swap, add, and save logic.
(function() {
    'use strict';

    var CATEGORY_LABELS = { 1: 'Mobility', 2: 'Rehab', 3: 'Strength', 4: 'Functional' };

    function _apiPrefix() { return Layer8DConfig.getApiPrefix(); }
    function _headers() {
        if (typeof getAuthHeaders === 'function') return getAuthHeaders();
        var token = (typeof Layer8MAuth !== 'undefined') ? Layer8MAuth.getBearerToken()
                  : sessionStorage.getItem('bearerToken');
        return { 'Authorization': token ? 'Bearer ' + token : '', 'Content-Type': 'application/json' };
    }
    function _notify(type, msg) {
        if (typeof Layer8DNotification !== 'undefined') { Layer8DNotification[type](msg); return; }
        if (typeof Layer8MUtils !== 'undefined') {
            if (type === 'success') Layer8MUtils.showSuccess(msg);
            else if (type === 'error') Layer8MUtils.showError(msg);
            else if (type === 'warning' || type === 'info') Layer8MUtils.showSuccess(msg);
        }
    }

    window.PhysioPlanActions = {

        CATEGORY_LABELS: CATEGORY_LABELS,

        // Build <select> HTML for loadType. selectedVal is the current integer value.
        loadTypeSelect: function(selectedVal, cssClass, dataAttr) {
            var LOAD_TYPE = (PhysioManagement.enums || {}).LOAD_TYPE || {};
            var html = '<select class="' + (cssClass || '') + '"' + (dataAttr || '') +
                ' style="padding:4px 6px;border:1px solid var(--layer8d-border);border-radius:4px;font-size:13px;">';
            Object.keys(LOAD_TYPE).forEach(function(k) {
                var v = parseInt(k, 10);
                var label = LOAD_TYPE[k];
                if (label === 'Unspecified') label = '\u2014';
                html += '<option value="' + v + '"' + (v === (selectedVal || 0) ? ' selected' : '') + '>' + label + '</option>';
            });
            html += '</select>';
            return html;
        },

        // Group exercises by circuit, sort by exerciseType (Fixed before Variable) then orderIndex, normalize indices.
        // Returns { circuits: { cNum: [pe, ...] }, labels: { cNum: 'label' } }
        groupAndSort: function(exercises, exMap) {
            var circuits = {};
            var labels = {};
            exercises.forEach(function(pe) {
                var c = pe.circuitNumber || 0;
                if (!circuits[c]) circuits[c] = [];
                if (pe.circuitLabel) labels[c] = pe.circuitLabel;
                circuits[c].push(pe);
            });
            Object.keys(circuits).forEach(function(k) {
                circuits[k].sort(function(a, b) {
                    var aType = (exMap[a.exerciseId] || {}).exerciseType || 0;
                    var bType = (exMap[b.exerciseId] || {}).exerciseType || 0;
                    if (aType !== bType) return aType - bType;
                    return (a.orderIndex || 0) - (b.orderIndex || 0);
                });
                for (var i = 0; i < circuits[k].length; i++) {
                    circuits[k][i].orderIndex = i + 1;
                }
            });
            return { circuits: circuits, labels: labels };
        },

        // Move exercise within its circuit. Returns true if moved, false if blocked.
        move: function(exercises, exMap, pe, direction) {
            var cNum = pe.circuitNumber || 0;
            var circuitExs = exercises.filter(function(e) { return (e.circuitNumber || 0) === cNum; })
                .sort(function(a, b) {
                    var aT = (exMap[a.exerciseId] || {}).exerciseType || 0;
                    var bT = (exMap[b.exerciseId] || {}).exerciseType || 0;
                    if (aT !== bT) return aT - bT;
                    return (a.orderIndex || 0) - (b.orderIndex || 0);
                });
            var pos = circuitExs.indexOf(pe);
            var target = pos + direction;
            if (target < 0 || target >= circuitExs.length) return false;

            var curType = (exMap[pe.exerciseId] || {}).exerciseType || 0;
            var tgtType = (exMap[circuitExs[target].exerciseId] || {}).exerciseType || 0;
            if (curType !== tgtType) {
                _notify('warning', 'Cannot move across Fixed/Variable boundary.');
                return false;
            }
            var tmp = pe.orderIndex;
            pe.orderIndex = circuitExs[target].orderIndex;
            circuitExs[target].orderIndex = tmp;
            return true;
        },

        // Delete exercise from plan. Returns true if found and removed.
        remove: function(exercises, pe) {
            var i = exercises.indexOf(pe);
            if (i !== -1) { exercises.splice(i, 1); return true; }
            return false;
        },

        // Swap exercise to progression/regression. Logs to ExSwapLog. Returns new exerciseId or null.
        swap: function(exMap, pe, direction, planId, clientId) {
            var fullEx = exMap[pe.exerciseId] || {};
            var newId = direction === 'progression' ? fullEx.progressionExerciseId : fullEx.regressionExerciseId;
            if (!newId) {
                _notify('warning', 'No ' + direction + ' exercise defined.');
                return null;
            }
            var newEx = exMap[newId] || {};
            var oldName = fullEx.name || pe.exerciseId;
            var newName = newEx.name || newId;
            var cLabel = CATEGORY_LABELS[pe.circuitNumber] || ('Circuit ' + (pe.circuitNumber || '?'));

            pe.exerciseId = newId;
            if (newEx.defaultSets) pe.sets = newEx.defaultSets;
            if (newEx.defaultReps) pe.reps = newEx.defaultReps;

            // Log the swap
            fetch(_apiPrefix() + '/50/ExSwapLog', {
                method: 'POST',
                headers: Object.assign({}, _headers(), { 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    clientId: clientId,
                    planId: planId,
                    oldExerciseId: fullEx.exerciseId,
                    newExerciseId: newId,
                    direction: direction === 'progression' ? 1 : 2,
                    swapDate: Math.floor(Date.now() / 1000),
                    therapistId: sessionStorage.getItem('currentUser') || '',
                    description: '[' + cLabel + '] ' + oldName + ' \u2192 ' + newName
                })
            }).catch(function(err) { console.warn('Failed to log swap:', err); });

            _notify('info', oldName + ' \u2192 ' + newName);
            return newId;
        },

        // Save plan via PUT. Calls onSuccess/onError.
        _saving: false,
        save: function(plan, onSuccess, onError) {
            var self = this;
            if (self._saving) {
                _notify('warning', 'Save in progress\u2026');
                return;
            }
            self._saving = true;
            self._doSave(plan, onSuccess, onError, 0);
        },
        _doSave: function(plan, onSuccess, onError, attempt) {
            var self = this;
            fetch(_apiPrefix() + '/50/PhyPlan', {
                method: 'PUT',
                headers: Object.assign({}, _headers(), { 'Content-Type': 'application/json' }),
                body: JSON.stringify(plan)
            })
            .then(function(r) {
                if (r.ok) {
                    self._saving = false;
                    _notify('success', 'Plan saved.');
                    if (onSuccess) onSuccess();
                } else if (attempt < 2) {
                    // Retry on deadlock or transient error
                    setTimeout(function() { self._doSave(plan, onSuccess, onError, attempt + 1); }, 300);
                } else {
                    self._saving = false;
                    _notify('error', 'Failed to save plan');
                    if (onError) onError();
                }
            })
            .catch(function(err) {
                if (attempt < 2) {
                    setTimeout(function() { self._doSave(plan, onSuccess, onError, attempt + 1); }, 300);
                } else {
                    self._saving = false;
                    _notify('error', 'Error: ' + err.message);
                    if (onError) onError();
                }
            });
        },

        // Build filtered list of available exercises for adding to a circuit.
        // Returns array of { exerciseId, name } objects.
        availableForCircuit: function(exercises, exMap, circuitNumber, planJoint, planPosture) {
            var existing = exercises.filter(function(e) {
                return (e.circuitNumber || 0) === circuitNumber;
            }).map(function(e) { return e.exerciseId; });

            return Object.values(exMap).filter(function(ex) {
                if (ex.category !== circuitNumber) return false;
                if (planJoint != null && ex.joint !== planJoint) return false;
                if (planPosture != null && ex.posture !== planPosture) return false;
                return existing.indexOf(ex.exerciseId) === -1;
            });
        },

        // Add exercise to plan. Returns the new plan exercise object.
        addToPlan: function(exercises, exerciseId, circuitNumber, exMap) {
            var ex = exMap[exerciseId] || {};
            var maxOrder = exercises.reduce(function(mx, e) {
                return (e.circuitNumber || 0) === circuitNumber && e.orderIndex > mx ? e.orderIndex : mx;
            }, 0);
            var pe = {
                planExerciseId: 'pe-' + Date.now(),
                exerciseId: exerciseId,
                sets: ex.defaultSets || 3,
                reps: ex.defaultReps || 12,
                notes: '',
                orderIndex: maxOrder + 1,
                circuitNumber: circuitNumber,
                circuitLabel: CATEGORY_LABELS[circuitNumber] || ('Circuit ' + circuitNumber),
                loadType: ex.loadType || 0
            };
            exercises.push(pe);
            return pe;
        },

        // Build display row data from a plan exercise + exercise map
        displayRow: function(pe, exMap) {
            var ex = exMap[pe.exerciseId] || {};
            return {
                pe: pe,
                exerciseId: pe.exerciseId,
                name: ex.name || pe.exerciseId || '\u2014',
                sets: pe.sets || ex.defaultSets || '',
                reps: pe.reps || ex.defaultRepsDisplay || String(ex.defaultReps || '') || '',
                notes: pe.notes || '',
                exerciseType: ex.exerciseType || 0,
                loadType: pe.loadType || ex.loadType || 0,
                imageStoragePath: ex.imageStoragePath || '',
                progressionExerciseId: ex.progressionExerciseId || '',
                regressionExerciseId: ex.regressionExerciseId || '',
                _circuitNumber: pe.circuitNumber || 0,
                _orderIndex: pe.orderIndex || 0
            };
        },

        // Log plan exercise changes (sets/reps/load/notes) to ExSwapLog.
        // originals: { exerciseId: { sets, reps, notes, loadType } }
        // exercises: plan exercises array (after _collectEdits)
        logChanges: function(plan, exercises, exMap, originals) {
            if (!originals || !exercises || !plan) return;
            var LOAD_LABELS = (PhysioManagement.enums || {}).LOAD_TYPE || {};
            exercises.forEach(function(pe) {
                var orig = originals[pe.exerciseId];
                if (!orig) return;
                var exName = (exMap[pe.exerciseId] || {}).name || pe.exerciseId;
                var cLabel = CATEGORY_LABELS[pe.circuitNumber] || ('Circuit ' + (pe.circuitNumber || '?'));
                var curSets = parseInt(pe.sets, 10) || 0;
                var curReps = parseInt(pe.reps, 10) || 0;
                var curNotes = pe.notes || '';
                var curLoad = parseInt(pe.loadType, 10) || 0;
                var changes = [];
                if (curSets !== orig.sets) changes.push('Sets: ' + orig.sets + ' \u2192 ' + curSets);
                if (curReps !== orig.reps) changes.push('Reps: ' + orig.reps + ' \u2192 ' + curReps);
                if (curLoad !== (orig.loadType || 0)) changes.push('Load: ' + (LOAD_LABELS[orig.loadType] || orig.loadType || 'None') + ' \u2192 ' + (LOAD_LABELS[curLoad] || curLoad || 'None'));
                if (curNotes !== orig.notes) changes.push('Notes changed');
                if (changes.length === 0) return;
                var desc = '[' + cLabel + '] ' + exName + ' \u2014 ' + changes.join(', ');
                fetch(_apiPrefix() + '/50/ExSwapLog', {
                    method: 'POST',
                    headers: Object.assign({}, _headers(), { 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                        clientId: plan.clientId, planId: plan.planId,
                        oldExerciseId: pe.exerciseId, newExerciseId: pe.exerciseId,
                        direction: 0, swapDate: Math.floor(Date.now() / 1000),
                        therapistId: sessionStorage.getItem('currentUser') || '',
                        description: desc
                    })
                }).catch(function(err) { console.warn('Failed to log plan change:', err); });
                originals[pe.exerciseId] = { sets: curSets, reps: curReps, notes: curNotes, loadType: curLoad };
            });
        }
    };
})();
