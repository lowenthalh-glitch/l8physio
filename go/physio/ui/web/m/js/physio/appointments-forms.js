(function() {
    'use strict';
    const f     = window.Layer8FormFactory;
    const enums = MobilePhysioManagement.enums;

    MobilePhysioManagement.forms = MobilePhysioManagement.forms || {};
    MobilePhysioManagement.forms.Appointment = f.form('Appointment', [
        f.section('Appointment Details', [
            ...f.reference('clientId',  'Client',        'PhysioClient', true),
            ...f.reference('planId',    'Treatment Plan','TreatmentPlan'),
            ...f.date('startTime',      'Start Time',    true),
            ...f.date('endTime',        'End Time',      true),
            ...f.select('status',       'Status',        enums.APPT_STATUS),
            ...f.text('location',       'Location')
        ]),
        f.section('Notes', [
            ...f.textarea('therapistNotes', 'Therapist Notes'),
            ...f.textarea('clientNotes',    'Client Notes')
        ])
    ]);
})();
