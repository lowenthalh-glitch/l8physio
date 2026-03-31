(function() {
    'use strict';
    window.PhysioManagement = window.PhysioManagement || {};

    const factory = window.Layer8EnumFactory;
    const { createStatusRenderer } = Layer8DRenderers;

    const CLIENT_STATUS = factory.create([
        ['Unspecified', null, ''],
        ['Active',      'active',     'layer8d-status-active'],
        ['Inactive',    'inactive',   'layer8d-status-inactive'],
        ['Discharged',  'discharged', 'layer8d-status-completed']
    ]);

    PhysioManagement.enums = PhysioManagement.enums || {};
    PhysioManagement.enums.CLIENT_STATUS        = CLIENT_STATUS.enum;
    PhysioManagement.enums.CLIENT_STATUS_VALUES = CLIENT_STATUS.values;
    PhysioManagement.enums.CLIENT_STATUS_CLASSES= CLIENT_STATUS.classes;

    PhysioManagement.render = PhysioManagement.render || {};
    PhysioManagement.render.clientStatus = createStatusRenderer(
        CLIENT_STATUS.enum, CLIENT_STATUS.classes
    );
})();
