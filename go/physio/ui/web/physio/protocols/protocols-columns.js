(function() {
    'use strict';
    const col    = window.Layer8ColumnFactory;
    const render = PhysioManagement.render;

    PhysioManagement.columns = PhysioManagement.columns || {};
    PhysioManagement.columns.PhysioProtocol = [
        ...col.id('protocolId',    'Protocol ID'),
        ...col.col('name',         'Protocol Name'),
        ...col.col('protocolCode', 'Code'),
        ...col.enum('joint',       'Joint',   null, render.joint),
        ...col.enum('posture',     'Posture', null, render.posture),
        ...col.col('description',  'Description'),
        ...col.boolean('isActive', 'Active')
    ];

    PhysioManagement.primaryKeys = PhysioManagement.primaryKeys || {};
    PhysioManagement.primaryKeys.PhysioProtocol = 'protocolId';
})();
