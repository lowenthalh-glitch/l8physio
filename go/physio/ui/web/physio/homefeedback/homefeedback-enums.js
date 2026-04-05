(function() {
    'use strict';
    window.PhysioManagement = window.PhysioManagement || {};

    const factory = window.Layer8EnumFactory;
    const { createStatusRenderer, renderEnum } = Layer8DRenderers;

    const COMPLIANCE = factory.create([
        ['Unspecified',  null,      ''],
        ['Full',         'full',    'layer8d-status-active'],
        ['Partial',      'partial', 'layer8d-status-warning'],
        ['Skipped',      'skipped', 'layer8d-status-error']
    ]);

    const DIFFICULTY = factory.create([
        ['Unspecified',    null,       ''],
        ['Easy',           'easy',     'layer8d-status-active'],
        ['Moderate',       'moderate', 'layer8d-status-warning'],
        ['Hard',           'hard',     'layer8d-status-error'],
        ['Could Not',      'couldnot', 'layer8d-status-error']
    ]);

    const MOOD = factory.simple(['Unspecified', 'Good', 'Neutral', 'Low']);

    PhysioManagement.enums = PhysioManagement.enums || {};
    PhysioManagement.enums.COMPLIANCE         = COMPLIANCE.enum;
    PhysioManagement.enums.COMPLIANCE_VALUES   = COMPLIANCE.values;
    PhysioManagement.enums.COMPLIANCE_CLASSES   = COMPLIANCE.classes;
    PhysioManagement.enums.DIFFICULTY          = DIFFICULTY.enum;
    PhysioManagement.enums.DIFFICULTY_VALUES    = DIFFICULTY.values;
    PhysioManagement.enums.DIFFICULTY_CLASSES   = DIFFICULTY.classes;
    PhysioManagement.enums.MOOD               = MOOD.enum;

    PhysioManagement.render = PhysioManagement.render || {};
    PhysioManagement.render.compliance = createStatusRenderer(COMPLIANCE.enum, COMPLIANCE.classes);
    PhysioManagement.render.difficulty = createStatusRenderer(DIFFICULTY.enum, DIFFICULTY.classes);
    PhysioManagement.render.mood = function(value) { return renderEnum(value, MOOD.enum); };
})();
