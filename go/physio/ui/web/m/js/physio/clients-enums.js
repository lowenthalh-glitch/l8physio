(function() {
    'use strict';
    window.MobilePhysioManagement = window.MobilePhysioManagement || {};

    const factory = window.Layer8EnumFactory;
    const { createStatusRenderer } = Layer8MRenderers;

    const CLIENT_STATUS = factory.create([
        ['Unspecified', null,         ''],
        ['Active',      'active',     'status-active'],
        ['Inactive',    'inactive',   'status-inactive'],
        ['Discharged',  'discharged', 'status-completed']
    ]);

    const EXERCISE_CATEGORY = factory.simple([
        'Unspecified', 'Mobility', 'Rehab', 'Strength', 'Functional',
        'Flexibility', 'Balance', 'Cardio', 'Breathing'
    ]);

    const LOAD_TYPE = factory.simple([
        'Unspecified', 'Bodyweight', 'Band Light', 'Band Medium', 'Band Heavy',
        'Dumbbell Light', 'Dumbbell Medium', 'Dumbbell Heavy', 'Iso Hold', 'Control'
    ]);

    const JOINT = factory.simple([
        'Unspecified', 'Shoulder', 'Knee', 'Ankle', 'Lower Back',
        'Elbow', 'General', 'Hip', 'Core', 'SIJ'
    ]);

    const POSTURE = factory.simple([
        'Unspecified', 'Kyphosis (Rounded Shoulders)', 'Lordosis (Anterior Pelvic Tilt)',
        'Upper Thoracic Flat', 'Lumbar Flat', 'Valgus (Knee Caving)',
        'Pronation (Foot Collapse)', 'General'
    ]);

    const PHYSIO_PHASE = factory.create([
        ['Unspecified',           null,     ''],
        ['Phase 1 - ROM/Control', 'phase1', 'status-pending'],
        ['Phase 2 - Strength',    'phase2', 'status-active'],
        ['Phase 3 - Functional',  'phase3', 'status-completed']
    ]);

    const EXERCISE_TYPE = factory.create([
        ['Unspecified', null,       ''],
        ['Fixed',       'fixed',    'status-active'],
        ['Variable',    'variable', 'status-pending']
    ]);

    const BODY_REGION = factory.simple([
        'Unspecified', 'Neck', 'Shoulder', 'Upper Back', 'Lower Back',
        'Hip', 'Knee', 'Ankle', 'Foot', 'Elbow', 'Wrist', 'Hand',
        'Core', 'Full Body'
    ]);

    const PLAN_STATUS = factory.create([
        ['Unspecified', null,        ''],
        ['Draft',       'draft',     'status-pending'],
        ['Active',      'active',    'status-active'],
        ['Completed',   'completed', 'status-completed'],
        ['Suspended',   'suspended', 'status-inactive']
    ]);

    const APPT_STATUS = factory.create([
        ['Unspecified', null,        ''],
        ['Scheduled',   'scheduled', 'status-pending'],
        ['Confirmed',   'confirmed', 'status-active'],
        ['Completed',   'completed', 'status-completed'],
        ['Cancelled',   'cancelled', 'status-inactive'],
        ['No Show',     'no-show',   'status-terminated']
    ]);

    MobilePhysioManagement.enums = {
        CLIENT_STATUS:        CLIENT_STATUS.enum,
        CLIENT_STATUS_VALUES: CLIENT_STATUS.values,
        CLIENT_STATUS_CLASSES:CLIENT_STATUS.classes,
        EXERCISE_CATEGORY:    EXERCISE_CATEGORY.enum,
        BODY_REGION:          BODY_REGION.enum,
        PLAN_STATUS:          PLAN_STATUS.enum,
        PLAN_STATUS_VALUES:   PLAN_STATUS.values,
        PLAN_STATUS_CLASSES:  PLAN_STATUS.classes,
        APPT_STATUS:          APPT_STATUS.enum,
        APPT_STATUS_VALUES:   APPT_STATUS.values,
        APPT_STATUS_CLASSES:  APPT_STATUS.classes,
        LOAD_TYPE:            LOAD_TYPE.enum,
        JOINT:                JOINT.enum,
        POSTURE:              POSTURE.enum,
        PHYSIO_PHASE:         PHYSIO_PHASE.enum,
        PHYSIO_PHASE_VALUES:  PHYSIO_PHASE.values,
        PHYSIO_PHASE_CLASSES: PHYSIO_PHASE.classes,
        EXERCISE_TYPE:        EXERCISE_TYPE.enum,
        EXERCISE_TYPE_VALUES: EXERCISE_TYPE.values,
        EXERCISE_TYPE_CLASSES:EXERCISE_TYPE.classes
    };

    const { renderEnum } = Layer8MRenderers;

    MobilePhysioManagement.render = {
        clientStatus:     createStatusRenderer(CLIENT_STATUS.enum, CLIENT_STATUS.classes),
        exerciseCategory: (v) => renderEnum(v, EXERCISE_CATEGORY.enum),
        bodyRegion:       (v) => renderEnum(v, BODY_REGION.enum),
        planStatus:       createStatusRenderer(PLAN_STATUS.enum, PLAN_STATUS.classes),
        apptStatus:       createStatusRenderer(APPT_STATUS.enum, APPT_STATUS.classes),
        loadType:         (v) => renderEnum(v, LOAD_TYPE.enum),
        joint:            (v) => renderEnum(v, JOINT.enum),
        posture:          (v) => renderEnum(v, POSTURE.enum),
        phase:            createStatusRenderer(PHYSIO_PHASE.enum, PHYSIO_PHASE.classes),
        exerciseType:     createStatusRenderer(EXERCISE_TYPE.enum, EXERCISE_TYPE.classes)
    };
})();
