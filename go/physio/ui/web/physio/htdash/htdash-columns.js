(function() {
    'use strict';
    var col    = window.Layer8ColumnFactory;
    var enums  = PhysioManagement.enums;
    var render = PhysioManagement.render;

    PhysioManagement.columns = PhysioManagement.columns || {};
    PhysioManagement.columns.HeadThDashRow = [
        ...col.id('rowId',                  'ID'),
        ...col.col('clientName',            'Client'),
        ...col.col('therapistName',         'Therapist'),
        ...col.date('lastFeedbackDate',     'Last Feedback'),
        ...col.status('lastFeedbackStatus', 'Feedback', enums.SESSION_STATUS_VALUES, render.sessionStatus),
        ...col.date('lastSessionDate',      'Last Session'),
        ...col.status('lastSessionStatus',  'Session',  enums.SESSION_STATUS_VALUES, render.sessionStatus),
        ...col.status('overrideStatus',     'Override', enums.SESSION_STATUS_VALUES, render.sessionStatus),
        ...col.number('swapCount',          'Swaps')
    ];

    PhysioManagement.primaryKeys = PhysioManagement.primaryKeys || {};
    PhysioManagement.primaryKeys.HeadThDashRow = 'rowId';
})();
