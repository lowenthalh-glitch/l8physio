(function() {
    'use strict';
    const col    = window.Layer8ColumnFactory;
    const enums  = PhysioManagement.enums;
    const render = PhysioManagement.render;

    PhysioManagement.columns = PhysioManagement.columns || {};
    PhysioManagement.columns.HomeFeedback = [
        ...col.id('feedbackId',          'Feedback ID'),
        ...col.date('feedbackDate',      'Date'),
        ...col.col('clientId',           'Client'),
        ...col.status('compliance',      'Compliance',  enums.COMPLIANCE_VALUES, render.compliance),
        ...col.number('painBefore',      'Pain Before'),
        ...col.number('painAfter',       'Pain After'),
        ...col.status('difficulty',      'Difficulty',   enums.DIFFICULTY_VALUES, render.difficulty),
        ...col.enum('mood',             'Mood',         null, render.mood),
        ...col.status('status',          'Status',       enums.SESSION_STATUS_VALUES, render.sessionStatus),
        ...col.col('notes',             'Notes')
    ];

    PhysioManagement.primaryKeys = PhysioManagement.primaryKeys || {};
    PhysioManagement.primaryKeys.HomeFeedback = 'feedbackId';
})();
