(function() {
    'use strict';
    const col    = window.Layer8ColumnFactory;
    const enums  = PhysioManagement.enums;
    const render = PhysioManagement.render;

    PhysioManagement.columns = PhysioManagement.columns || {};
    PhysioManagement.columns.HomeFeedback = [
        ...col.id('feedbackId',          'ID'),
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

    PhysioManagement.primaryKeys = PhysioManagement.primaryKeys || {};
    PhysioManagement.primaryKeys.HomeFeedback = 'feedbackId';
})();
