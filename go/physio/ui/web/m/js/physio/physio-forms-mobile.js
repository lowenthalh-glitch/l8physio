(function() {
    'use strict';
    var enums = MobilePhysioManagement.enums;
    var all = PhysioSharedForms.build(enums);

    // Strip fields that don't apply on mobile
    _removeFields(all.PhysioClient, ['therapistId']);
    _removeFields(all.PhysioExercise, ['exerciseAim', 'muscleGroup', 'imageStoragePath', 'videoStoragePath']);
    _renameSection(all.PhysioExercise, 'Instructions & Media', 'Instructions');
    _relabel(all.TreatmentPlan, 'volume', 'Workout Volume');
    _removeFields(all.Appointment, ['therapistId']);
    _relabel(all.ProgressLog, 'overallPainLevel', 'Pain Level (0-10)');

    MobilePhysioManagement.forms = MobilePhysioManagement.forms || {};
    Object.keys(all).forEach(function(k) {
        MobilePhysioManagement.forms[k] = all[k];
    });

    function _removeFields(formDef, keys) {
        if (!formDef || !formDef.sections) return;
        formDef.sections.forEach(function(section) {
            section.fields = section.fields.filter(function(field) {
                return keys.indexOf(field.key) === -1;
            });
        });
        formDef.sections = formDef.sections.filter(function(s) {
            return s.fields.length > 0;
        });
    }

    function _renameSection(formDef, oldTitle, newTitle) {
        if (!formDef || !formDef.sections) return;
        formDef.sections.forEach(function(s) {
            if (s.title === oldTitle) s.title = newTitle;
        });
    }

    function _relabel(formDef, fieldKey, newLabel) {
        if (!formDef || !formDef.sections) return;
        formDef.sections.forEach(function(s) {
            s.fields.forEach(function(f) {
                if (f.key === fieldKey) f.label = newLabel;
            });
        });
    }
})();
