// PhysioClientExercises — extended actions (add exercise, workout builder wiring, details)
// Split from clients-exercises.js to stay under 500 lines.
(function() {
    'use strict';

    var CATEGORY_LABELS = { 1: 'Mobility', 2: 'Rehab', 3: 'Strength', 4: 'Functional' };

    function _apiPrefix() { return Layer8DConfig.getApiPrefix(); }
    function _headers() { return getAuthHeaders(); }

    var self = window.PhysioClientExercises;
    if (!self) return;

    self._addExerciseToCircuit = function(circuitNumber) {
        var exMap = self._exerciseMap || {};
        var existing = (self._currentPlan.exercises || []).filter(function(pe) {
            return (pe.circuitNumber || 0) === circuitNumber;
        }).map(function(pe) { return pe.exerciseId; });
        var pJoint = self._planJoint;
        var pPosture = self._planPosture;
        var available = Object.values(exMap).filter(function(ex) {
            if (ex.category !== circuitNumber) return false;
            if (pJoint != null && ex.joint !== pJoint) return false;
            if (pPosture != null && ex.posture !== pPosture) return false;
            return existing.indexOf(ex.exerciseId) === -1;
        });
        var options = available.length === 0
            ? '<option value="">No exercises available</option>'
            : '<option value="">-- Select --</option>' + available.map(function(ex) {
                return '<option value="' + Layer8DUtils.escapeHtml(ex.exerciseId) + '">'
                    + Layer8DUtils.escapeHtml(ex.name || ex.exerciseId) + '</option>';
            }).join('');
        var r = function(l, h) { return '<div class="wb-af-row"><label class="wb-af-label">' + l + '</label>' + h + '</div>'; };
        var html = '<div class="wb-assign-form">'
            + r('Exercise', '<select id="pe-add-ex-select" class="wb-af-input">' + options + '</select>')
            + r('Sets', '<input type="number" id="pe-add-sets" class="wb-af-input" min="1" max="20" value="3">')
            + r('Reps', '<input type="number" id="pe-add-reps" class="wb-af-input" min="1" max="100" value="12">')
            + r('Notes', '<input type="text" id="pe-add-notes" class="wb-af-input" value="">') + '</div>';
        Layer8DPopup.show({
            title: 'Add Exercise', content: html, size: 'small', showFooter: true, saveButtonText: 'Add',
            onSave: function() {
                var b = Layer8DPopup.getBody();
                var q = function(id) { return b ? b.querySelector('#' + id) : document.getElementById(id); };
                var exerciseId = q('pe-add-ex-select').value;
                if (!exerciseId) { Layer8DNotification.error('Please select an exercise'); return; }
                var alreadyInCircuit = (self._currentPlan.exercises || []).some(function(pe) {
                    return pe.exerciseId === exerciseId && (pe.circuitNumber || 0) === circuitNumber;
                });
                if (alreadyInCircuit) { Layer8DNotification.warning('This exercise is already in this circuit'); return; }
                var circuitLabel = (CATEGORY_LABELS[circuitNumber] || ('Circuit ' + circuitNumber));
                var maxOrder = (self._currentPlan.exercises || []).reduce(function(mx, pe) {
                    return pe.circuitNumber === circuitNumber && pe.orderIndex > mx ? pe.orderIndex : mx;
                }, 0);
                self._currentPlan.exercises = self._currentPlan.exercises || [];
                self._currentPlan.exercises.push({
                    planExerciseId: 'pe-' + Date.now(),
                    exerciseId:     exerciseId,
                    sets:           parseInt(q('pe-add-sets').value, 10) || 3,
                    reps:           parseInt(q('pe-add-reps').value, 10) || 12,
                    notes:          q('pe-add-notes').value.trim(),
                    orderIndex:     maxOrder + 1,
                    circuitNumber:  circuitNumber,
                    circuitLabel:   circuitLabel
                });
                Layer8DPopup.close();
                self._savePlan();
            }
        });
    };

    self._wireWbButton = function(exercisesPane, contentPane, client, infoPane) {
        var wbBtn = exercisesPane.querySelector('#physio-wb-open-btn');
        if (!wbBtn || !contentPane || !window.PhysioWorkoutBuilder) return;
        wbBtn.addEventListener('click', function() {
            var savedHtml = contentPane.innerHTML;
            contentPane.innerHTML = '<div id="physio-wb-container"></div>';
            PhysioWorkoutBuilder.setupInContainer(contentPane.querySelector('#physio-wb-container'), {
                mode:      self._currentPlan ? 'edit' : 'new',
                planId:    self._currentPlan ? self._currentPlan.planId : null,
                clientId:  client.clientId,
                onRefresh: function() { self._loadPlan(client, contentPane, infoPane); },
                onCancel:  function() { contentPane.innerHTML = savedHtml; }
            });
        });
    };

    self._renderDetails = function(client, container) {
        var formDef = (PhysioManagement.forms || {}).PhysioClient;
        if (!formDef) { container.innerHTML = '<p>Form definition not available.</p>'; return; }
        container.innerHTML = Layer8DForms.generateFormHtml(formDef, client);
        container.querySelectorAll('input, select, textarea').forEach(function(el) { el.disabled = true; });
        Layer8DForms.attachDatePickers(container);
        Layer8DForms.attachReferencePickers(container);
    };
})();
