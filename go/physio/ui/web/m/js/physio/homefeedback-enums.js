(function() {
    'use strict';
    window.MobilePhysioManagement = window.MobilePhysioManagement || {};

    var factory = window.Layer8EnumFactory;
    var createStatusRenderer = Layer8MRenderers.createStatusRenderer;

    // Q1: Training Level (maps to difficulty field)
    var TRAINING_LEVEL = factory.create([
        ['Unspecified',                     null,       ''],
        ['Easy, needs adjustment',          'easy',     'status-pending'],
        ['Okay, need adjustment',           'ok',       'status-pending'],
        ['Perfect',                         'perfect',  'status-active'],
        ['Too difficult, needs adjustment', 'toohard',  'status-inactive']
    ]);

    // Q2-Q3: Pain scale 0-5
    var PAIN_SCALE = { 0: '0 - No pain', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5 - Very painful' };

    // Q4-Q6: Rating scale 1-5
    var RATING_SCALE = { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' };

    MobilePhysioManagement.enums = MobilePhysioManagement.enums || {};
    MobilePhysioManagement.enums.TRAINING_LEVEL         = TRAINING_LEVEL.enum;
    MobilePhysioManagement.enums.TRAINING_LEVEL_VALUES   = TRAINING_LEVEL.values;
    MobilePhysioManagement.enums.TRAINING_LEVEL_CLASSES   = TRAINING_LEVEL.classes;
    MobilePhysioManagement.enums.PAIN_SCALE              = PAIN_SCALE;
    MobilePhysioManagement.enums.RATING_SCALE            = RATING_SCALE;

    MobilePhysioManagement.render = MobilePhysioManagement.render || {};
    MobilePhysioManagement.render.trainingLevel = createStatusRenderer(
        TRAINING_LEVEL.enum, TRAINING_LEVEL.classes
    );
})();
