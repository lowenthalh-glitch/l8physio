(function() {
    'use strict';
    window.MobilePhysioManagement = window.MobilePhysioManagement || {};

    var factory = window.Layer8EnumFactory;
    var createStatusRenderer = Layer8MRenderers.createStatusRenderer;
    var renderEnum = Layer8MRenderers.renderEnum;

    var SESSION_STATUS = factory.create([
        ['Unspecified', null,    ''],
        ['Green',       'green', 'status-active'],
        ['Yellow',      'yellow','status-pending'],
        ['Red',         'red',   'status-inactive']
    ]);

    var ADJUSTMENT_LEVEL = factory.create([
        ['Unspecified',      null,    ''],
        ['No Change',        'none',  ''],
        ['Local Adjustment', 'local', 'status-pending'],
        ['Major Change',     'major', 'status-inactive']
    ]);

    MobilePhysioManagement.enums = MobilePhysioManagement.enums || {};
    MobilePhysioManagement.enums.SESSION_STATUS          = SESSION_STATUS.enum;
    MobilePhysioManagement.enums.SESSION_STATUS_VALUES    = SESSION_STATUS.values;
    MobilePhysioManagement.enums.SESSION_STATUS_CLASSES    = SESSION_STATUS.classes;
    MobilePhysioManagement.enums.ADJUSTMENT_LEVEL         = ADJUSTMENT_LEVEL.enum;
    MobilePhysioManagement.enums.ADJUSTMENT_LEVEL_VALUES  = ADJUSTMENT_LEVEL.values;
    MobilePhysioManagement.enums.ADJUSTMENT_LEVEL_CLASSES = ADJUSTMENT_LEVEL.classes;

    MobilePhysioManagement.render = MobilePhysioManagement.render || {};
    MobilePhysioManagement.render.sessionStatus = createStatusRenderer(SESSION_STATUS.enum, SESSION_STATUS.classes);
    MobilePhysioManagement.render.adjustmentLevel = createStatusRenderer(ADJUSTMENT_LEVEL.enum, ADJUSTMENT_LEVEL.classes);
})();
