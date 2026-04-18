(function() {
    'use strict';
    window.MobilePhysioManagement = window.MobilePhysioManagement || {};

    var factory = window.Layer8EnumFactory;
    var createStatusRenderer = Layer8MRenderers.createStatusRenderer;
    var renderEnum = Layer8MRenderers.renderEnum;

    var COMPLIANCE = factory.create([
        ['Unspecified',  null,      ''],
        ['Full',         'full',    'status-active'],
        ['Partial',      'partial', 'status-pending'],
        ['Skipped',      'skipped', 'status-inactive']
    ]);

    var DIFFICULTY = factory.create([
        ['Unspecified',    null,       ''],
        ['Easy',           'easy',     'status-active'],
        ['Moderate',       'moderate', 'status-pending'],
        ['Hard',           'hard',     'status-inactive'],
        ['Could Not',      'couldnot', 'status-inactive']
    ]);

    var MOOD = factory.simple(['Unspecified', 'Good', 'Neutral', 'Low']);

    MobilePhysioManagement.enums = MobilePhysioManagement.enums || {};
    MobilePhysioManagement.enums.COMPLIANCE         = COMPLIANCE.enum;
    MobilePhysioManagement.enums.COMPLIANCE_VALUES   = COMPLIANCE.values;
    MobilePhysioManagement.enums.COMPLIANCE_CLASSES   = COMPLIANCE.classes;
    MobilePhysioManagement.enums.DIFFICULTY          = DIFFICULTY.enum;
    MobilePhysioManagement.enums.DIFFICULTY_VALUES    = DIFFICULTY.values;
    MobilePhysioManagement.enums.DIFFICULTY_CLASSES   = DIFFICULTY.classes;
    MobilePhysioManagement.enums.MOOD               = MOOD.enum;

    MobilePhysioManagement.render = MobilePhysioManagement.render || {};
    MobilePhysioManagement.render.compliance = createStatusRenderer(COMPLIANCE.enum, COMPLIANCE.classes);
    MobilePhysioManagement.render.difficulty = createStatusRenderer(DIFFICULTY.enum, DIFFICULTY.classes);
    MobilePhysioManagement.render.mood = function(value) { return renderEnum(value, MOOD.enum); };
})();
