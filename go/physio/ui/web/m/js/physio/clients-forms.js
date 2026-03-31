(function() {
    'use strict';
    const f     = window.Layer8FormFactory;
    const enums = MobilePhysioManagement.enums;

    MobilePhysioManagement.forms = MobilePhysioManagement.forms || {};
    MobilePhysioManagement.forms.PhysioClient = f.form('Physio Client', [
        f.section('Personal Information', [
            ...f.text('firstName',        'First Name',        true),
            ...f.text('lastName',         'Last Name',         true),
            ...f.text('email',            'Email'),
            ...f.text('phone',            'Phone'),
            ...f.date('dateOfBirth',      'Date of Birth'),
            ...f.select('status',         'Status',            enums.CLIENT_STATUS),
            ...f.text('referralSource',   'Referral Source'),
            ...f.reference('protocolId',  'Protocol', 'PhysioProtocol')
        ]),
        f.section('Medical Information', [
            ...f.textarea('diagnosis',       'Diagnosis'),
            ...f.textarea('medicalHistory',  'Medical History'),
            ...f.text('emergencyContact',    'Emergency Contact')
        ])
    ]);
})();
