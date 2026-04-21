(function() {
    'use strict';
    window.PhysioManagement = window.PhysioManagement || {};

    const factory = window.Layer8EnumFactory;
    const { createStatusRenderer } = Layer8DRenderers;

    // Q1: Training Level (maps to difficulty field)
    const TRAINING_LEVEL = factory.create([
        ['Unspecified',                     null,       ''],
        ['Easy, needs adjustment',          'easy',     'layer8d-status-warning'],
        ['Okay, need adjustment',           'ok',       'layer8d-status-warning'],
        ['Perfect',                         'perfect',  'layer8d-status-active'],
        ['Too difficult, needs adjustment', 'toohard',  'layer8d-status-error']
    ]);

    // Q2-Q3: Pain scale 0-5 (for select options)
    var PAIN_SCALE = { 0: '0 - No pain', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5 - Very painful' };

    // Q4-Q6: Rating scale 1-5 (for select options)
    var RATING_SCALE = { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' };

    PhysioManagement.enums = PhysioManagement.enums || {};
    PhysioManagement.enums.TRAINING_LEVEL         = TRAINING_LEVEL.enum;
    PhysioManagement.enums.TRAINING_LEVEL_VALUES   = TRAINING_LEVEL.values;
    PhysioManagement.enums.TRAINING_LEVEL_CLASSES   = TRAINING_LEVEL.classes;
    PhysioManagement.enums.PAIN_SCALE              = PAIN_SCALE;
    PhysioManagement.enums.RATING_SCALE            = RATING_SCALE;

    PhysioManagement.render = PhysioManagement.render || {};
    PhysioManagement.render.trainingLevel = createStatusRenderer(
        TRAINING_LEVEL.enum, TRAINING_LEVEL.classes
    );
})();
