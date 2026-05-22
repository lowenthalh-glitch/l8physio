(function() {
    'use strict';
    window.PhysioManagement = window.PhysioManagement || {};

    const factory = window.Layer8EnumFactory;
    const { renderEnum, renderEnumList } = Layer8DRenderers;

    const EXERCISE_CATEGORY = factory.simple([
        'Unspecified', 'Mobility', 'Rehab', 'Strength', 'Functional',
        'Flexibility', 'Balance', 'Cardio', 'Breathing'
    ]);

    const BODY_REGION = factory.simple([
        'Unspecified', 'Neck', 'Shoulder', 'Upper Back', 'Lower Back',
        'Hip', 'Knee', 'Ankle', 'Foot', 'Elbow', 'Wrist', 'Hand',
        'Core', 'Full Body'
    ]);

    const LOAD_TYPE = factory.simple([
        'Unspecified', 'Bodyweight', 'Band Light', 'Band Medium', 'Band Heavy',
        'Dumbbell', '', '', 'Iso Hold', 'Control'
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
    PhysioManagement.enums.LOAD_TYPE         = LOAD_TYPE.enum;
    PhysioManagement.enums.POSTURE           = POSTURE.enum;
    PhysioManagement.enums.JOINT             = JOINT.enum;

    PhysioManagement.render = PhysioManagement.render || {};
    PhysioManagement.render.exerciseCategory = (v) => renderEnum(v, EXERCISE_CATEGORY.enum);
    PhysioManagement.render.bodyRegion       = (v) => renderEnum(v, BODY_REGION.enum);
    PhysioManagement.render.loadType         = (v) => renderEnum(v, LOAD_TYPE.enum);
    PhysioManagement.render.posture          = (v) => renderEnum(v, POSTURE.enum);
    PhysioManagement.render.joint            = (v) => renderEnum(v, JOINT.enum);
    PhysioManagement.render.joints           = (v) => renderEnumList(v, JOINT.enum);
    PhysioManagement.render.categories       = (v) => renderEnumList(v, EXERCISE_CATEGORY.enum);
})();
