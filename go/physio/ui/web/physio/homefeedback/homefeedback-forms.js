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
            ...f.text('exercisesDone',         'Exercises Done'),
            ...f.select('compliance',          'Compliance',      enums.COMPLIANCE),
            ...f.number('painBefore',          'Pain Before (0-10)'),
            ...f.number('painDuring',          'Pain During (0-10)'),
            ...f.number('painAfter',           'Pain After (0-10)'),
            ...f.select('difficulty',          'Difficulty',       enums.DIFFICULTY),
            ...f.select('mood',                'Mood',             enums.MOOD),
            ...f.select('status',              'Status',           enums.SESSION_STATUS),
            ...f.textarea('notes',             'Notes')
        ])
    ]);
})();
