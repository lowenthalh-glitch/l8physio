(function() {
    'use strict';
    const col    = window.Layer8ColumnFactory;
    const enums  = PhysioManagement.enums;
    const render = PhysioManagement.render;

    PhysioManagement.columns = PhysioManagement.columns || {};
    PhysioManagement.columns.Appointment = [
        ...col.id('apptId',     'Appt ID'),
        ...col.custom('clientId',    'Client',    function(item) { return PhysioManagement.lookups.clientName(item.clientId); }),
        ...col.custom('therapistId', 'Therapist', function(item) { return PhysioManagement.lookups.therapistName(item.therapistId); }),
        ...col.date('startTime', 'Start Time'),
        ...col.date('endTime',   'End Time'),
        ...col.status('status',  'Status', enums.APPT_STATUS_VALUES, render.apptStatus),
        ...col.col('location',   'Location')
    ];

    PhysioManagement.primaryKeys = PhysioManagement.primaryKeys || {};
    PhysioManagement.primaryKeys.Appointment = 'apptId';
})();
