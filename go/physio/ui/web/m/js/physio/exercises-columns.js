(function() {
    'use strict';
    const col    = window.Layer8ColumnFactory;
    const enums  = MobilePhysioManagement.enums;
    const render = MobilePhysioManagement.render;

    MobilePhysioManagement.columns = MobilePhysioManagement.columns || {};
    MobilePhysioManagement.columns.PhysioExercise = [
        ...col.id('exerciseId'),
        ...col.col('name', 'Name'),
        ...col.enum('category',          'Category',  null, render.exerciseCategory),
        ...col.enum('joint',             'Joint',     null, render.joint),
        ...col.status('phase',           'Phase',     null, render.phase),
        ...col.status('exerciseType',    'Type',      null, render.exerciseType),
        ...col.enum('loadType',          'Load',      null, render.loadType),
        ...col.col('effort',             'Effort'),
        ...col.col('defaultRepsDisplay', 'Reps'),
        ...col.boolean('isActive',       'Active')
    ];

    // Mark primary/secondary for card display
    MobilePhysioManagement.columns.PhysioExercise =
        MobilePhysioManagement.columns.PhysioExercise.map(function(c) {
            if (c.key === 'name')     return Object.assign({}, c, { primary: true });
            if (c.key === 'category') return Object.assign({}, c, { secondary: true });
            return c;
        });

    MobilePhysioManagement.primaryKeys = MobilePhysioManagement.primaryKeys || {};
    MobilePhysioManagement.primaryKeys.PhysioExercise = 'exerciseId';
})();
