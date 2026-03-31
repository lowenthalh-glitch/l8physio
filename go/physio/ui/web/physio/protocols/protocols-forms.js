(function() {
    'use strict';
    const f     = window.Layer8FormFactory;
    const enums = PhysioManagement.enums;

    PhysioManagement.forms = PhysioManagement.forms || {};
    PhysioManagement.forms.PhysioProtocol = f.form('Protocol Template', [
        f.section('Protocol Details', [
            ...f.text('name',          'Protocol Name',  true),
            ...f.text('protocolCode',  'Protocol Code'),
            ...f.select('joint',       'Joint',          enums.JOINT),
            ...f.select('posture',     'Posture Type',   enums.POSTURE),
            ...f.textarea('description', 'Description'),
            ...f.checkbox('isActive',  'Active')
        ]),
        f.section('Exercises', [
            ...f.inlineTable('exercises', 'Protocol Exercises', [
                { key: 'protocolExerciseId', label: 'ID',         hidden: true },
                { key: 'orderIndex',         label: '#',           type: 'number' },
                { key: 'exerciseId',         label: 'Exercise',    type: 'reference', lookupModel: 'PhysioExercise' },
                { key: 'exerciseName',       label: 'Name',        type: 'text' },
                { key: 'sets',               label: 'Sets',        type: 'number' },
                { key: 'reps',               label: 'Reps',        type: 'text' },
                { key: 'loadType',           label: 'Load',        type: 'select', options: enums.LOAD_TYPE },
                { key: 'effort',             label: 'Effort',      type: 'text' },
                { key: 'loadNotes',          label: 'Load Notes',  type: 'text' }
            ])
        ])
    ]);
})();
