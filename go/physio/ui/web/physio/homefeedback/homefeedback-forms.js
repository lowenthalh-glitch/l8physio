(function() {
    'use strict';
    var f     = window.Layer8FormFactory;
    var enums = PhysioManagement.enums;

    PhysioManagement.forms = PhysioManagement.forms || {};
    PhysioManagement.forms.HomeFeedback = f.form('Home Feedback', [
        f.section('Session Info', [
            ...f.reference('clientId',     'Client',    'PhysioClient',   true),
            ...f.reference('therapistId',  'Therapist', 'PhysioTherapist'),
            ...f.date('feedbackDate',      'Date',      true),
            ...f.reference('planId',       'Plan',      'TreatmentPlan')
        ]),
        f.section('Feedback', [
            ...f.select('difficulty',  'Training Level',    enums.TRAINING_LEVEL, true),
            ...f.select('painDuring',  'Pain during workout', enums.PAIN_SCALE, true),
            ...f.select('painAfter',   'Pain after workout',  enums.PAIN_SCALE, true),
            ...f.select('painBefore',  'Sleep quality',      enums.RATING_SCALE, true),
            ...f.select('compliance',  'Nutrition quality',  enums.RATING_SCALE, true),
            ...f.select('mood',        'Stress level',       enums.RATING_SCALE, true)
        ])
    ]);
})();
