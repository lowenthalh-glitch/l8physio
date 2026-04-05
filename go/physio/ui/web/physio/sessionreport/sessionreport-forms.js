(function() {
    'use strict';
    var f     = window.Layer8FormFactory;
    var enums = PhysioManagement.enums;

    PhysioManagement.forms = PhysioManagement.forms || {};
    PhysioManagement.forms.SessionReport = f.form('Session Report', [
        f.section('Session Info', [
            ...f.reference('clientId',     'Client',    'PhysioClient',    true),
            ...f.reference('therapistId',  'Therapist', 'PhysioTherapist', true),
            ...f.date('sessionDate',       'Session Date', true),
            ...f.reference('protocolId',   'Protocol',  'PhysioProtocol'),
            ...f.select('currentPhase',    'Phase',     enums.SESSION_PHASE),
            ...f.select('status',          'Status',    enums.SESSION_STATUS, true)
        ]),
        f.section('Assessment', [
            ...f.number('painBefore',          'Pain Before (0-10)'),
            ...f.number('painDuring',          'Pain During (0-10)'),
            ...f.number('painAfter',           'Pain After (0-10)'),
            ...f.checkbox('hadDifficulty',     'Had Difficulty'),
            ...f.text('difficultyExerciseId', 'Difficulty Exercises'),
            ...f.select('difficultyType',      'Difficulty Type',   enums.DIFFICULTY_TYPE),
            ...f.checkbox('adjustmentMade',    'Adjustment Made'),
            ...f.text('adjustmentDetails',     'Adjustment Details'),
            ...f.select('adjustmentLevel',     'Adjustment Level',  enums.ADJUSTMENT_LEVEL),
            ...f.checkbox('followupRequired',  'Follow-up Required'),
            ...f.checkbox('phaseChangeNeeded', 'Phase/Protocol Change Needed'),
            ...f.textarea('notes',             'Notes')
        ])
    ]);
})();
