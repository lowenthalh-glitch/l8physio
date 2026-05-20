(function() {
    'use strict';
    const col    = window.Layer8ColumnFactory;
    const enums  = PhysioManagement.enums;
    const render = PhysioManagement.render;

    PhysioManagement.columns = PhysioManagement.columns || {};
    PhysioManagement.columns.PhysioExercise = [
        ...col.id('exerciseId',       'Exercise ID'),
        ...col.col('name',            'Name'),
        ...col.multiEnum('categories', 'Categories', null, render.exerciseCategory, enums.EXERCISE_CATEGORY),
        ...col.multiEnum('joints',     'Joints',     null, render.joint,            enums.JOINT),
        ...col.status('phase',        'Phase',       null, render.phase,             enums.PHYSIO_PHASE),
        ...col.status('exerciseType', 'Type',        null, render.exerciseType,      enums.EXERCISE_TYPE),
        ...col.enum('loadType',       'Load',        null, render.loadType,          enums.LOAD_TYPE),
        ...col.col('effort',             'Effort (RPE)'),
        ...col.col('defaultRepsDisplay', 'Reps'),
        ...col.multiEnum('posture',       'Posture Type', null, render.posture, enums.POSTURE),
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
