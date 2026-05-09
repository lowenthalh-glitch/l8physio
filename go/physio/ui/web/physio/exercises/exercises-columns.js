(function() {
    'use strict';
    const col    = window.Layer8ColumnFactory;
    const enums  = PhysioManagement.enums;
    const render = PhysioManagement.render;

    PhysioManagement.columns = PhysioManagement.columns || {};
    PhysioManagement.columns.PhysioExercise = [
        ...col.id('exerciseId',       'Exercise ID'),
        ...col.col('name',            'Name'),
        ...col.custom('categories',    'Categories',  function(item) { return render.categories(item.categories); }, { sortKey: false, filterKey: 'categories' }),
        ...col.custom('joints',        'Joints',     function(item) { return render.joints(item.joints); },         { sortKey: false, filterKey: 'joints' }),
        ...col.status('phase',        'Phase',       null, render.phase,             enums.PHYSIO_PHASE),
        ...col.status('exerciseType', 'Type',        null, render.exerciseType,      enums.EXERCISE_TYPE),
        ...col.enum('loadType',       'Load',        null, render.loadType,          enums.LOAD_TYPE),
        ...col.col('effort',             'Effort (RPE)'),
        ...col.col('defaultRepsDisplay', 'Reps'),
        ...col.col('movementDirection',  'Direction'),
        ...col.col('exerciseAim',        'Aim'),
        ...col.col('equipment',          'Equipment'),
        ...col.boolean('isActive',       'Active'),
        ...col.col('progressionExerciseId', 'Progression'),
        ...col.col('regressionExerciseId',  'Regression'),
        ...col.col('rotationGroupId',       'Rotation Group')
    ];

    PhysioManagement.primaryKeys = PhysioManagement.primaryKeys || {};
    PhysioManagement.primaryKeys.PhysioExercise = 'exerciseId';
})();
