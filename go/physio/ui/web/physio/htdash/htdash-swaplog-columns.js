(function() {
    'use strict';
    var col = window.Layer8ColumnFactory;
    var { createStatusRenderer } = Layer8DRenderers;

    var SWAP_DIR = { 0: 'Unknown', 1: 'Progression', 2: 'Regression' };
    var SWAP_DIR_CLASSES = { 1: 'layer8d-status-active', 2: 'layer8d-status-pending' };

    PhysioManagement.render = PhysioManagement.render || {};
    PhysioManagement.render.swapDirection = createStatusRenderer(SWAP_DIR, SWAP_DIR_CLASSES);

    PhysioManagement.columns = PhysioManagement.columns || {};
    PhysioManagement.columns.ExerciseSwapLog = [
        ...col.id('swapId',          'ID'),
        ...col.date('swapDate',      'Date'),
        ...col.col('oldExerciseId',  'From Exercise'),
        ...col.col('newExerciseId',  'To Exercise'),
        ...col.status('direction',   'Direction', null, PhysioManagement.render.swapDirection),
        ...col.col('therapistId',    'Therapist')
    ];

    PhysioManagement.primaryKeys = PhysioManagement.primaryKeys || {};
    PhysioManagement.primaryKeys.ExerciseSwapLog = 'swapId';
})();
