(function() {
    'use strict';
    window.PhysioManagement = window.PhysioManagement || {};

    const factory = window.Layer8EnumFactory;
    const { renderEnum, createStatusRenderer } = Layer8DRenderers;

    const EXERCISE_CATEGORY = factory.simple([
        'Unspecified', 'Mobility', 'Rehab', 'Strength', 'Functional',
        'Flexibility', 'Balance', 'Cardio', 'Breathing'
    ]);

    const BODY_REGION = factory.simple([
        'Unspecified', 'Neck', 'Shoulder', 'Upper Back', 'Lower Back',
        'Hip', 'Knee', 'Ankle', 'Foot', 'Elbow', 'Wrist', 'Hand',
        'Core', 'Full Body'
    ]);

    const PHYSIO_PHASE = factory.create([
        ['Unspecified',           null,     ''],
        ['Phase 1 - ROM/Control', 'phase1', 'layer8d-status-pending'],
        ['Phase 2 - Strength',    'phase2', 'layer8d-status-active'],
        ['Phase 3 - Functional',  'phase3', 'layer8d-status-completed']
    ]);

    const EXERCISE_TYPE = factory.create([
        ['Unspecified', null,       ''],
        ['Fixed',       'fixed',    'layer8d-status-active'],
        ['Variable',    'variable', 'layer8d-status-pending']
    ]);

    const LOAD_TYPE = factory.simple([
        'Unspecified', 'Bodyweight', 'Band Light', 'Band Medium', 'Band Heavy',
        'Dumbbell Light', 'Dumbbell Medium', 'Dumbbell Heavy', 'Iso Hold', 'Control'
    ]);

    const POSTURE = factory.simple([
        'Unspecified', 'Kyphosis (Rounded Shoulders)', 'Lordosis (Anterior Pelvic Tilt)',
        'Upper Thoracic Flat', 'Lumbar Flat', 'Valgus (Knee Caving)',
        'Pronation (Foot Collapse)', 'General'
    ]);

    const JOINT = factory.simple([
        'Unspecified', 'Shoulder', 'Knee', 'Ankle', 'Lower Back',
        'Elbow', 'General', 'Hip', 'Core', 'SIJ'
    ]);

    PhysioManagement.enums = PhysioManagement.enums || {};
    PhysioManagement.enums.EXERCISE_CATEGORY = EXERCISE_CATEGORY.enum;
    PhysioManagement.enums.BODY_REGION       = BODY_REGION.enum;
    PhysioManagement.enums.PHYSIO_PHASE      = PHYSIO_PHASE.enum;
    PhysioManagement.enums.EXERCISE_TYPE     = EXERCISE_TYPE.enum;
    PhysioManagement.enums.LOAD_TYPE         = LOAD_TYPE.enum;
    PhysioManagement.enums.POSTURE           = POSTURE.enum;
    PhysioManagement.enums.JOINT             = JOINT.enum;

    PhysioManagement.render = PhysioManagement.render || {};
    PhysioManagement.render.exerciseCategory = (v) => renderEnum(v, EXERCISE_CATEGORY.enum);
    PhysioManagement.render.bodyRegion       = (v) => renderEnum(v, BODY_REGION.enum);
    PhysioManagement.render.phase            = createStatusRenderer(PHYSIO_PHASE.enum, PHYSIO_PHASE.classes);
    PhysioManagement.render.exerciseType     = createStatusRenderer(EXERCISE_TYPE.enum, EXERCISE_TYPE.classes);
    PhysioManagement.render.loadType         = (v) => renderEnum(v, LOAD_TYPE.enum);
    PhysioManagement.render.posture          = (v) => renderEnum(v, POSTURE.enum);
    PhysioManagement.render.joint            = (v) => renderEnum(v, JOINT.enum);
})();
