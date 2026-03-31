(function() {
    'use strict';
    const col    = window.Layer8ColumnFactory;
    const enums  = MobilePhysioManagement.enums;
    const render = MobilePhysioManagement.render;

    MobilePhysioManagement.columns = MobilePhysioManagement.columns || {};
    MobilePhysioManagement.columns.TreatmentPlan = [
        ...col.id('planId'),
        ...col.col('title',     'Title'),
        ...col.col('clientId',  'Client ID'),
        ...col.status('status', 'Status', enums.PLAN_STATUS_VALUES, render.planStatus),
        ...col.date('startDate','Start'),
        ...col.date('endDate',  'End')
    ].map(function(c) {
        if (c.key === 'title')  return Object.assign({}, c, { primary: true });
        if (c.key === 'status') return Object.assign({}, c, { secondary: true });
        return c;
    });

    MobilePhysioManagement.primaryKeys = MobilePhysioManagement.primaryKeys || {};
    MobilePhysioManagement.primaryKeys.TreatmentPlan = 'planId';
})();
