(function() {
    'use strict';
    const f     = window.Layer8FormFactory;
    const enums = PhysioManagement.enums;

    PhysioManagement.forms = PhysioManagement.forms || {};
    PhysioManagement.forms.PhysioExercise = f.form('Exercise', [
        f.section('Exercise Details', [
            ...f.text('name',            'Name',        true),
            ...f.select('category',      'Category',    enums.EXERCISE_CATEGORY),
            ...f.select('bodyRegion',    'Body Region', enums.BODY_REGION),
            ...f.textarea('description', 'Description'),
            ...f.textarea('exerciseAim', 'Exercise Aim'),
            ...f.checkbox('isActive',    'Active')
        ]),
        f.section('Protocol Classification', [
            ...f.select('joint',        'Joint',         enums.JOINT),
            ...f.select('posture',      'Posture Type',  enums.POSTURE),
            ...f.select('phase',        'Phase',         enums.PHYSIO_PHASE),
            ...f.select('exerciseType', 'Type',          enums.EXERCISE_TYPE),
            ...f.select('loadType',     'Load Type',     enums.LOAD_TYPE),
            ...f.text('effort',         'Effort (RPE)'),
            ...f.text('equipment',      'Equipment'),
            ...f.text('muscleGroup',    'Muscle Group'),
            ...f.textarea('loadNotes',  'Load Notes')
        ]),
        f.section('Default Parameters', [
            ...f.number('defaultSets',           'Default Sets'),
            ...f.number('defaultReps',           'Default Reps'),
            ...f.text('defaultRepsDisplay',      'Reps Display (e.g. 8-10)'),
            ...f.number('defaultHoldSeconds',    'Hold (seconds)'),
            ...f.text('movementDirection',       'Movement Direction')
        ]),
        f.section('Instructions & Media', [
            ...f.textarea('instructions',     'Instructions'),
            ...f.textarea('contraindications','Contraindications'),
            ...f.text('imageStoragePath',     'Image Path'),
            ...f.text('videoStoragePath',     'Video Path')
        ])
    ]);
})();
