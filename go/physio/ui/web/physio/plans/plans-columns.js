(function() {
    'use strict';
    const col    = window.Layer8ColumnFactory;
    const enums  = PhysioManagement.enums;
    const render = PhysioManagement.render;

    PhysioManagement.columns = PhysioManagement.columns || {};
    PhysioManagement.columns.TreatmentPlan = [
        ...col.id('planId',      'Plan ID'),
        ...col.col('title',      'Title'),
        ...col.col('clientId',   'Client ID'),
        ...col.status('status',  'Status', enums.PLAN_STATUS_VALUES, render.planStatus),
        ...col.date('startDate', 'Start Date'),
        ...col.date('endDate',   'End Date'),
        ...col.col('goals',      'Goals')
    ];

    PhysioManagement.primaryKeys = PhysioManagement.primaryKeys || {};
    PhysioManagement.primaryKeys.TreatmentPlan = 'planId';
})();
