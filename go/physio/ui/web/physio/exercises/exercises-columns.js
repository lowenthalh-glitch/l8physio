(function() {
    'use strict';
    const col    = window.Layer8ColumnFactory;
    const enums  = PhysioManagement.enums;
    const render = PhysioManagement.render;

    PhysioManagement.columns = PhysioManagement.columns || {};
    PhysioManagement.columns.PhysioExercise = [
        ...col.id('exerciseId',       'Exercise ID'),
        ...col.col('name',            'Name'),
        ...col.enum('category',       'Category',    null, render.exerciseCategory),
        ...col.enum('joint',          'Joint',       null, render.joint),
        ...col.status('phase',        'Phase',       null, render.phase),
        ...col.status('exerciseType', 'Type',        null, render.exerciseType),
        ...col.enum('loadType',       'Load',        null, render.loadType),
        ...col.col('effort',             'Effort (RPE)'),
        ...col.col('defaultRepsDisplay', 'Reps'),
        ...col.col('movementDirection',  'Direction'),
        ...col.col('exerciseAim',        'Aim'),
        ...col.col('equipment',          'Equipment'),
        ...col.boolean('isActive',       'Active')
    ];

    PhysioManagement.primaryKeys = PhysioManagement.primaryKeys || {};
    PhysioManagement.primaryKeys.PhysioExercise = 'exerciseId';
})();
