(function() {
    'use strict';
    const col = window.Layer8ColumnFactory;
    const enums  = PhysioManagement.enums;
    const render = PhysioManagement.render;

    PhysioManagement.columns = PhysioManagement.columns || {};
    PhysioManagement.columns.PhysioClient = [
        ...col.id('clientId',   'Client ID'),
        ...col.col('lastName',  'Last Name'),
        ...col.col('firstName', 'First Name'),
        ...col.col('email',     'Email'),
        ...col.col('phone',     'Phone'),
        ...col.date('dateOfBirth', 'Date of Birth'),
        ...col.status('status', 'Status', enums.CLIENT_STATUS_VALUES, render.clientStatus),
        ...col.col('diagnosis', 'Diagnosis'),
        ...col.custom('therapistId', 'Therapist', function(item) { return PhysioManagement.lookups.therapistName(item.therapistId); })
    ];

    PhysioManagement.primaryKeys = PhysioManagement.primaryKeys || {};
    PhysioManagement.primaryKeys.PhysioClient = 'clientId';
})();
