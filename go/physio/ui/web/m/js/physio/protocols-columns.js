(function() {
    'use strict';
    const col    = window.Layer8ColumnFactory;
    const enums  = MobilePhysioManagement.enums;
    const render = MobilePhysioManagement.render;

    MobilePhysioManagement.columns = MobilePhysioManagement.columns || {};
    MobilePhysioManagement.columns.PhysioProtocol = [
        ...col.id('protocolId'),
        ...col.col('name',         'Protocol Name'),
        ...col.col('protocolCode', 'Code'),
        ...col.enum('joint',       'Joint',   null, render.joint),
        ...col.enum('posture',     'Posture', null, render.posture),
        ...col.boolean('isActive', 'Active')
    ];

    MobilePhysioManagement.columns.PhysioProtocol =
        MobilePhysioManagement.columns.PhysioProtocol.map(function(c) {
            if (c.key === 'name')  return Object.assign({}, c, { primary: true });
            if (c.key === 'joint') return Object.assign({}, c, { secondary: true });
            return c;
        });

    MobilePhysioManagement.primaryKeys = MobilePhysioManagement.primaryKeys || {};
    MobilePhysioManagement.primaryKeys.PhysioProtocol = 'protocolId';
})();
