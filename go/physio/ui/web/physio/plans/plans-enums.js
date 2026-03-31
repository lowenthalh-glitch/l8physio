(function() {
    'use strict';
    window.PhysioManagement = window.PhysioManagement || {};

    const factory = window.Layer8EnumFactory;
    const { createStatusRenderer } = Layer8DRenderers;

    const PLAN_STATUS = factory.create([
        ['Unspecified', null,        ''],
        ['Draft',       'draft',     'layer8d-status-pending'],
        ['Active',      'active',    'layer8d-status-active'],
        ['Completed',   'completed', 'layer8d-status-completed'],
        ['Suspended',   'suspended', 'layer8d-status-inactive']
    ]);

    PhysioManagement.enums = PhysioManagement.enums || {};
    PhysioManagement.enums.PLAN_STATUS        = PLAN_STATUS.enum;
    PhysioManagement.enums.PLAN_STATUS_VALUES = PLAN_STATUS.values;
    PhysioManagement.enums.PLAN_STATUS_CLASSES= PLAN_STATUS.classes;

    PhysioManagement.render = PhysioManagement.render || {};
    PhysioManagement.render.planStatus = createStatusRenderer(
        PLAN_STATUS.enum, PLAN_STATUS.classes
    );
})();
