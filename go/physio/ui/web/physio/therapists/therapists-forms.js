(function() {
    'use strict';
    window.PhysioManagement = window.PhysioManagement || {};
    const f = window.Layer8FormFactory;

    PhysioManagement.forms = PhysioManagement.forms || {};

    PhysioManagement.forms.PhysioTherapist = f.form('Therapist', [
        f.section('Personal Details', [
            ...f.text('firstName',     'First Name',     true),
            ...f.text('lastName',      'Last Name',      true),
            ...f.text('email',         'Email'),
            ...f.text('phone',         'Phone'),
        ]),
        f.section('Professional Details', [
            ...f.text('specialization', 'Specialization'),
            ...f.text('licenseNumber',  'License Number'),
            ...f.checkbox('isActive',   'Active'),
        ]),
        f.section('Audit', [
            ...f.audit()
        ])
    ]);
})();
