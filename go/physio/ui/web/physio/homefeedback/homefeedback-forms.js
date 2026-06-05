(function() {
    'use strict';
    var f     = window.Layer8FormFactory;
    var enums = PhysioManagement.enums;

    // Form-only variant of TRAINING_LEVEL with "Unspecified" hidden from the
    // dropdown. Index keys are preserved so existing records (which store the
    // numeric index) still render correctly elsewhere.
    var TRAINING_LEVEL_FORM = {};
    Object.keys(enums.TRAINING_LEVEL).forEach(function(k) {
        if (enums.TRAINING_LEVEL[k] !== 'Unspecified') {
            TRAINING_LEVEL_FORM[k] = enums.TRAINING_LEVEL[k];
        }
    });

    PhysioManagement.forms = PhysioManagement.forms || {};
    PhysioManagement.forms.HomeFeedback = f.form('Home Feedback', [
        f.section('Session Info', [
            ...f.reference('clientId',     'Client',    'PhysioClient',   true),
            ...f.reference('therapistId',  'Therapist', 'PhysioTherapist'),
            ...f.date('feedbackDate',      'Date',      true)
        ]),
        f.section('Feedback', [
            ...f.select('difficulty',  'Training Level',    TRAINING_LEVEL_FORM, true),
            ...f.select('painDuring',  'Pain during workout', enums.PAIN_SCALE, true),
            ...f.select('painAfter',   'Pain after workout',  enums.PAIN_SCALE, true),
            ...f.select('painBefore',  'Sleep quality',      enums.RATING_SCALE, true),
            ...f.select('compliance',  'Nutrition quality',  enums.RATING_SCALE, true),
            ...f.select('mood',        'Stress level',       enums.RATING_SCALE, true)
        ])
    ]);
})();
