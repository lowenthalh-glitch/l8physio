(function() {
    'use strict';
    var col    = window.Layer8ColumnFactory;
    var enums  = MobilePhysioManagement.enums;
    var render = MobilePhysioManagement.render;

    MobilePhysioManagement.columns = MobilePhysioManagement.columns || {};
    MobilePhysioManagement.columns.SessionReport = [
        ...col.id('reportId'),
        ...col.date('sessionDate',       'Date'),
        ...col.col('clientId',           'Client'),
        ...col.status('status',          'Status', enums.SESSION_STATUS_VALUES, render.sessionStatus),
        ...col.number('painBefore',      'Pain Before'),
        ...col.number('painAfter',       'Pain After'),
        ...col.enum('adjustmentLevel',   'Adjustment', enums.ADJUSTMENT_LEVEL_VALUES, render.adjustmentLevel),
        ...col.boolean('followupRequired','Follow-up')
    ];

    MobilePhysioManagement.columns.SessionReport =
        MobilePhysioManagement.columns.SessionReport.map(function(c) {
            if (c.key === 'sessionDate') return Object.assign({}, c, { primary: true });
            if (c.key === 'status')      return Object.assign({}, c, { secondary: true });
            return c;
        });

    MobilePhysioManagement.primaryKeys = MobilePhysioManagement.primaryKeys || {};
    MobilePhysioManagement.primaryKeys.SessionReport = 'reportId';
})();
