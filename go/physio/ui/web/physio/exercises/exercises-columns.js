(function() {
    'use strict';
    const col    = window.Layer8ColumnFactory;
    const enums  = PhysioManagement.enums;
    const render = PhysioManagement.render;

    PhysioManagement.columns = PhysioManagement.columns || {};
    PhysioManagement.columns.PhysioExercise = [
        ...col.id('exerciseId',       'Exercise ID'),
        ...col.col('name',            'Name'),
        ...col.custom('categories', 'Categories', (item) => render.categories(item.categories), { enumValues: enums.EXERCISE_CATEGORY, filterKey: 'categories' }),
        ...col.custom('joints',     'Joints',     (item) => render.joints(item.joints),         { enumValues: enums.JOINT,             filterKey: 'joints' }),
        ...col.enum('loadType',       'Load',        null, render.loadType,          enums.LOAD_TYPE),
        ...col.col('effort',             'Effort (RPE)'),
        ...col.col('defaultRepsDisplay', 'Reps'),
        ...col.custom('postures',   'Posture Type', (item) => render.postures(item.postures),   { enumValues: enums.POSTURE,           filterKey: 'postures' }),
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
