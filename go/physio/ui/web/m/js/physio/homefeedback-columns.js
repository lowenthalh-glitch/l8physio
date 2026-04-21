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
        ...col.status('difficulty',      'Training Level', enums.TRAINING_LEVEL_VALUES, render.trainingLevel),
        ...col.number('painDuring',      'Pain During'),
        ...col.number('painAfter',       'Pain After'),
        ...col.number('painBefore',      'Sleep'),
        ...col.number('compliance',      'Nutrition'),
        ...col.number('mood',            'Stress'),
        ...col.status('status',          'Status', enums.SESSION_STATUS_VALUES, render.sessionStatus)
    ];

    MobilePhysioManagement.columns.HomeFeedback =
        MobilePhysioManagement.columns.HomeFeedback.map(function(c) {
            if (c.key === 'feedbackDate') return Object.assign({}, c, { primary: true });
            if (c.key === 'status')       return Object.assign({}, c, { secondary: true });
            return c;
        });

    MobilePhysioManagement.primaryKeys = MobilePhysioManagement.primaryKeys || {};
    MobilePhysioManagement.primaryKeys.HomeFeedback = 'feedbackId';
})();
