(function() {
    'use strict';
    window.PhysioManagement = window.PhysioManagement || {};

    const factory = window.Layer8EnumFactory;
    const { createStatusRenderer, renderEnum } = Layer8DRenderers;

    var EVENT_TYPE = factory.simple([
        'Unspecified', 'Meeting', 'Class', 'Block'
    ]);

    var EVENT_STATUS = factory.create([
        ['Unspecified',       null,                ''],
        ['In Process',        'in_process',        'layer8d-status-pending'],
        ['Waiting Approval',  'waiting_approval',  'layer8d-status-pending'],
        ['Booked',            'booked',            'layer8d-status-active'],
        ['Started',           'started',           'layer8d-status-active'],
        ['Completed',         'completed',         'layer8d-status-completed'],
        ['No Show',           'no_show',           'layer8d-status-inactive'],
        ['Done',              'done',              'layer8d-status-completed'],
        ['Cancelled',         'cancelled',         'layer8d-status-inactive']
    ]);

    PhysioManagement.enums = PhysioManagement.enums || {};
    PhysioManagement.enums.BOOSTAPP_EVENT_TYPE         = EVENT_TYPE.enum;
    PhysioManagement.enums.BOOSTAPP_EVENT_STATUS        = EVENT_STATUS.enum;
    PhysioManagement.enums.BOOSTAPP_EVENT_STATUS_VALUES = EVENT_STATUS.values;
    PhysioManagement.enums.BOOSTAPP_EVENT_STATUS_CLASSES = EVENT_STATUS.classes;

    PhysioManagement.render = PhysioManagement.render || {};
    PhysioManagement.render.boostappEventType = function(value) {
        return renderEnum(value, EVENT_TYPE.enum);
    };
    PhysioManagement.render.boostappEventStatus = createStatusRenderer(
        EVENT_STATUS.enum, EVENT_STATUS.classes
    );
})();
