(function() {
    'use strict';
    window.PhysioManagement = window.PhysioManagement || {};
    const col = window.Layer8ColumnFactory;

    PhysioManagement.columns = PhysioManagement.columns || {};
    PhysioManagement.primaryKeys = PhysioManagement.primaryKeys || {};

    Object.assign(PhysioManagement.columns, {
        PhysioTherapist: [
            ...col.id('therapistId', 'ID'),
            ...col.col('firstName', 'First Name'),
            ...col.col('lastName',  'Last Name'),
            ...col.col('email',     'Email'),
            ...col.col('phone',     'Phone'),
            ...col.col('specialization', 'Specialization'),
            ...col.col('licenseNumber',  'License #'),
            ...col.boolean('isActive', 'Active')
        ]
    });

    PhysioManagement.primaryKeys.PhysioTherapist = 'therapistId';
})();
