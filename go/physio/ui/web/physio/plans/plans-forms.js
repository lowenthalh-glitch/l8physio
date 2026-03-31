(function() {
    'use strict';
    const f     = window.Layer8FormFactory;
    const enums = PhysioManagement.enums;

    PhysioManagement.forms = PhysioManagement.forms || {};
    PhysioManagement.forms.TreatmentPlan = f.form('Treatment Plan', [
        f.section('Plan Information', [
            ...f.text('title',              'Title',   true),
            ...f.reference('clientId',      'Client',  'PhysioClient', true),
            ...f.select('status',           'Status',  enums.PLAN_STATUS),
            ...f.date('startDate',          'Start Date'),
            ...f.date('endDate',            'End Date'),
            ...f.number('volume',           'Workout Volume (variable exercises per circuit)'),
            ...f.reference('protocolId',    'Protocol', 'PhysioProtocol')
        ]),
        f.section('Clinical Details', [
            ...f.textarea('goals',          'Goals'),
            ...f.textarea('description',    'Description'),
            ...f.textarea('therapistNotes', 'Therapist Notes')
        ])
    ]);
})();
