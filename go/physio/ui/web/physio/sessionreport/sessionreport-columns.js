(function() {
    'use strict';
    const col    = window.Layer8ColumnFactory;
    const enums  = PhysioManagement.enums;
    const render = PhysioManagement.render;

    PhysioManagement.columns = PhysioManagement.columns || {};
    PhysioManagement.columns.SessionReport = [
        ...col.id('reportId',            'Report ID'),
        ...col.date('sessionDate',       'Date'),
        ...col.col('clientId',           'Client'),
        ...col.col('therapistId',        'Therapist'),
        ...col.status('status',          'Status',     enums.SESSION_STATUS_VALUES, render.sessionStatus),
        ...col.number('painBefore',      'Pain Before'),
        ...col.number('painDuring',      'Pain During'),
        ...col.number('painAfter',       'Pain After'),
        ...col.enum('adjustmentLevel',   'Adjustment', enums.ADJUSTMENT_LEVEL_VALUES, render.adjustmentLevel),
        ...col.boolean('followupRequired','Follow-up'),
        ...col.col('notes',             'Notes')
    ];

    PhysioManagement.primaryKeys = PhysioManagement.primaryKeys || {};
    PhysioManagement.primaryKeys.SessionReport = 'reportId';
})();
