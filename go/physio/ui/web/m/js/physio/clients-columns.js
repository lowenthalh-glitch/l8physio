(function() {
    'use strict';
    const col    = window.Layer8ColumnFactory;
    const enums  = MobilePhysioManagement.enums;
    const render = MobilePhysioManagement.render;

    MobilePhysioManagement.columns = MobilePhysioManagement.columns || {};
    MobilePhysioManagement.columns.PhysioClient = [
        ...col.id('clientId'),
        ...col.custom('name', 'Name',
            (item) => Layer8MUtils.escapeHtml((item.lastName || '') + ', ' + (item.firstName || '')),
            { sortKey: 'lastName', filterKey: 'lastName', primary: true }),
        ...col.status('status', 'Status', enums.CLIENT_STATUS_VALUES, render.clientStatus),
        ...col.col('email',     'Email'),
        ...col.col('diagnosis', 'Diagnosis')
    ];

    MobilePhysioManagement.primaryKeys = MobilePhysioManagement.primaryKeys || {};
    MobilePhysioManagement.primaryKeys.PhysioClient = 'clientId';
})();
