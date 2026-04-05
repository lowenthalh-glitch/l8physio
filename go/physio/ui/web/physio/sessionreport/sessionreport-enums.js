(function() {
    'use strict';
    window.PhysioManagement = window.PhysioManagement || {};

    const factory = window.Layer8EnumFactory;
    const { createStatusRenderer, renderEnum } = Layer8DRenderers;

    const SESSION_STATUS = factory.create([
        ['Unspecified', null,    ''],
        ['Green',       'green', 'layer8d-status-active'],
        ['Yellow',      'yellow','layer8d-status-warning'],
        ['Red',         'red',   'layer8d-status-error']
    ]);

    const ADJUSTMENT_LEVEL = factory.create([
        ['Unspecified',      null,    ''],
        ['No Change',        'none',  ''],
        ['Local Adjustment', 'local', 'layer8d-status-warning'],
        ['Major Change',     'major', 'layer8d-status-error']
    ]);

    const DIFFICULTY_TYPE = factory.simple([
        'Unspecified', 'Pain', 'ROM Limitation', 'Load Too Heavy',
        'Coordination', 'Fatigue', 'Other'
    ]);

    const PHASE = factory.simple(['Unspecified', 'Phase 1', 'Phase 2', 'Phase 3']);

    PhysioManagement.enums = PhysioManagement.enums || {};
    PhysioManagement.enums.SESSION_STATUS         = SESSION_STATUS.enum;
    PhysioManagement.enums.SESSION_STATUS_VALUES   = SESSION_STATUS.values;
    PhysioManagement.enums.SESSION_STATUS_CLASSES   = SESSION_STATUS.classes;
    PhysioManagement.enums.ADJUSTMENT_LEVEL        = ADJUSTMENT_LEVEL.enum;
    PhysioManagement.enums.ADJUSTMENT_LEVEL_VALUES = ADJUSTMENT_LEVEL.values;
    PhysioManagement.enums.ADJUSTMENT_LEVEL_CLASSES= ADJUSTMENT_LEVEL.classes;
    PhysioManagement.enums.DIFFICULTY_TYPE         = DIFFICULTY_TYPE.enum;
    PhysioManagement.enums.SESSION_PHASE           = PHASE.enum;

    PhysioManagement.render = PhysioManagement.render || {};
    PhysioManagement.render.sessionStatus = createStatusRenderer(
        SESSION_STATUS.enum, SESSION_STATUS.classes
    );
    PhysioManagement.render.adjustmentLevel = createStatusRenderer(
        ADJUSTMENT_LEVEL.enum, ADJUSTMENT_LEVEL.classes
    );
    PhysioManagement.render.difficultyType = function(value) {
        return renderEnum(value, DIFFICULTY_TYPE.enum);
    };
    PhysioManagement.render.sessionPhase = function(value) {
        return renderEnum(value, PHASE.enum);
    };
})();
