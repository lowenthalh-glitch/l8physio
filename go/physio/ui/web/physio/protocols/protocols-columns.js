(function() {
    'use strict';
    const col    = window.Layer8ColumnFactory;
    const enums  = PhysioManagement.enums;
    const render = PhysioManagement.render;

    PhysioManagement.columns = PhysioManagement.columns || {};
    PhysioManagement.columns.PhysioProtocol = [
        ...col.id('protocolId',   'Protocol ID'),
        ...col.col('name',        'Protocol Name'),
        ...col.custom('joints',     'Joints',     (item) => render.joints(item.joints),         { enumValues: enums.JOINT,             filterKey: 'joints' }),
        ...col.custom('categories', 'Categories', (item) => render.categories(item.categories), { enumValues: enums.EXERCISE_CATEGORY, filterKey: 'categories' }),
        ...col.custom('postures',   'Posture',    (item) => render.postures(item.postures),     { enumValues: enums.POSTURE,           filterKey: 'postures' }),
        ...col.col('description', 'Description'),
        ...col.boolean('isActive', 'Active')
    ];

    PhysioManagement.primaryKeys = PhysioManagement.primaryKeys || {};
    PhysioManagement.primaryKeys.PhysioProtocol = 'protocolId';
})();
