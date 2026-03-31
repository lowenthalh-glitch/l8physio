(function() {
    'use strict';
    const f = window.Layer8FormFactory;

    PhysioManagement.forms = PhysioManagement.forms || {};
    PhysioManagement.forms.ProgressLog = f.form('Progress Log', [
        f.section('Log Details', [
            ...f.reference('clientId',        'Client',        'PhysioClient',  true),
            ...f.reference('planId',          'Treatment Plan','TreatmentPlan'),
            ...f.reference('apptId',          'Appointment',   'Appointment'),
            ...f.date('logDate',              'Log Date',      true),
            ...f.number('overallPainLevel',   'Overall Pain Level (0-10)')
        ]),
        f.section('Notes', [
            ...f.textarea('generalNotes', 'General Notes')
        ])
    ]);
})();
