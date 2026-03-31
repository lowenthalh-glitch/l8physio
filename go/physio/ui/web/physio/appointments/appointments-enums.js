(function() {
    'use strict';
    window.PhysioManagement = window.PhysioManagement || {};

    const factory = window.Layer8EnumFactory;
    const { createStatusRenderer } = Layer8DRenderers;

    const APPT_STATUS = factory.create([
        ['Unspecified', null,        ''],
        ['Scheduled',   'scheduled', 'layer8d-status-pending'],
        ['Confirmed',   'confirmed', 'layer8d-status-active'],
        ['Completed',   'completed', 'layer8d-status-completed'],
        ['Cancelled',   'cancelled', 'layer8d-status-inactive'],
        ['No Show',     'no-show',   'layer8d-status-error']
    ]);

    PhysioManagement.enums = PhysioManagement.enums || {};
    PhysioManagement.enums.APPT_STATUS        = APPT_STATUS.enum;
    PhysioManagement.enums.APPT_STATUS_VALUES = APPT_STATUS.values;
    PhysioManagement.enums.APPT_STATUS_CLASSES= APPT_STATUS.classes;

    PhysioManagement.render = PhysioManagement.render || {};
    PhysioManagement.render.apptStatus = createStatusRenderer(
        APPT_STATUS.enum, APPT_STATUS.classes
    );
})();
