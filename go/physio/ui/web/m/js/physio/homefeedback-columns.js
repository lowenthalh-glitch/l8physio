(function() {
    'use strict';
    var col    = window.Layer8ColumnFactory;
    var enums  = MobilePhysioManagement.enums;
    var render = MobilePhysioManagement.render;

    MobilePhysioManagement.columns = MobilePhysioManagement.columns || {};
    MobilePhysioManagement.columns.HomeFeedback = [
        ...col.id('feedbackId'),
        ...col.date('feedbackDate',      'Date'),
        ...col.col('clientId',           'Client'),
        ...col.status('compliance',      'Compliance', enums.COMPLIANCE_VALUES, render.compliance),
        ...col.number('painBefore',      'Pain Before'),
        ...col.number('painAfter',       'Pain After'),
        ...col.status('difficulty',      'Difficulty',  enums.DIFFICULTY_VALUES, render.difficulty),
        ...col.enum('mood',             'Mood',        null, render.mood),
        ...col.status('status',          'Status',      enums.SESSION_STATUS_VALUES, render.sessionStatus)
    ];

    MobilePhysioManagement.columns.HomeFeedback =
        MobilePhysioManagement.columns.HomeFeedback.map(function(c) {
            if (c.key === 'feedbackDate') return Object.assign({}, c, { primary: true });
            if (c.key === 'compliance')   return Object.assign({}, c, { secondary: true });
            return c;
        });

    MobilePhysioManagement.primaryKeys = MobilePhysioManagement.primaryKeys || {};
    MobilePhysioManagement.primaryKeys.HomeFeedback = 'feedbackId';
})();
