(function() {
    'use strict';
    const col    = window.Layer8ColumnFactory;
    const enums  = PhysioManagement.enums;
    const render = PhysioManagement.render;

    PhysioManagement.columns = PhysioManagement.columns || {};
    PhysioManagement.columns.TreatmentPlan = [
        ...col.id('planId',      'Plan ID'),
        ...col.col('title',      'Title'),
        {
            key: 'clientId', label: 'Client', sortKey: 'clientId', filterKey: 'clientId',
            render: function(item) {
                var lookup = window.PhysioManagement && window.PhysioManagement.lookups;
                var name   = lookup && lookup.clientName ? lookup.clientName(item.clientId) : null;
                return Layer8DUtils.escapeHtml(name || item.clientId || '\u2014');
            }
        },
        ...col.status('status',  'Status', enums.PLAN_STATUS_VALUES, render.planStatus),
        ...col.date('startDate', 'Start Date'),
        ...col.date('endDate',   'End Date'),
        ...col.col('goals',      'Goals')
    ];

    PhysioManagement.primaryKeys = PhysioManagement.primaryKeys || {};
    PhysioManagement.primaryKeys.TreatmentPlan = 'planId';
})();
