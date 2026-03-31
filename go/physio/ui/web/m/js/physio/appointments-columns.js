(function() {
    'use strict';
    const col    = window.Layer8ColumnFactory;
    const enums  = MobilePhysioManagement.enums;
    const render = MobilePhysioManagement.render;

    MobilePhysioManagement.columns = MobilePhysioManagement.columns || {};
    MobilePhysioManagement.columns.Appointment = [
        ...col.id('apptId'),
        ...col.col('clientId',   'Client ID'),
        ...col.date('startTime', 'Start'),
        ...col.status('status',  'Status', enums.APPT_STATUS_VALUES, render.apptStatus),
        ...col.col('location',   'Location')
    ].map(function(c) {
        if (c.key === 'startTime') return Object.assign({}, c, { primary: true });
        if (c.key === 'status')    return Object.assign({}, c, { secondary: true });
        return c;
    });

    MobilePhysioManagement.primaryKeys = MobilePhysioManagement.primaryKeys || {};
    MobilePhysioManagement.primaryKeys.Appointment = 'apptId';
})();
