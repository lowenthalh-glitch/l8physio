(function() {
    'use strict';

    window.PhysioSharedForms = {
        build: function(enums) {
            var f = window.Layer8FormFactory;
            return {
                PhysioClient: f.form('Physio Client', [
                    f.section('Personal Information', [
                        ...f.text('firstName',        'First Name',        true),
                        ...f.text('lastName',         'Last Name',         true),
                        ...f.text('email',            'Email',             true),
                        ...f.text('phone',            'Phone'),
                        ...f.date('dateOfBirth',      'Date of Birth'),
                        ...f.select('status',         'Status',            enums.CLIENT_STATUS),
                        ...f.text('referralSource',      'Referral Source'),
                        ...f.text('boostappId',          'Boostapp ID'),
                        ...f.reference('therapistId',    'Therapist', 'PhysioTherapist'),
                        ...f.reference('protocolId',     'Protocol',  'PhysioProtocol')
                    ]),
                    f.section('Medical Information', [
                        ...f.textarea('diagnosis',       'Diagnosis'),
                        ...f.textarea('medicalHistory',  'Medical History'),
                        ...f.text('emergencyContact',    'Emergency Contact')
                    ])
                ]),

                PhysioExercise: f.form('Exercise', [
                    f.section('Exercise Details', [
                        ...f.text('name',            'Name',        true),
                        ...f.select('category',      'Category',    enums.EXERCISE_CATEGORY),
                        ...f.select('bodyRegion',    'Body Region', enums.BODY_REGION),
                        ...f.textarea('description', 'Description'),
                        ...f.textarea('exerciseAim', 'Exercise Aim'),
                        ...f.checkbox('isActive',    'Active')
                    ]),
                    f.section('Progression / Regression', [
                        ...f.reference('progressionExerciseId', 'Progression (harder)', 'PhysioExercise'),
                        ...f.reference('regressionExerciseId',  'Regression (easier)',  'PhysioExercise')
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
                        ...f.file('imageStoragePath',     'Exercise Image'),
                        ...f.text('videoStoragePath',     'Video Path')
                    ])
                ]),

                TreatmentPlan: f.form('Treatment Plan', [
                    f.section('Plan Information', [
                        ...f.text('title',              'Title',   true),
                        ...f.reference('clientId',      'Client',  'PhysioClient', true),
                        ...f.select('status',           'Status',  enums.PLAN_STATUS),
                        ...f.date('startDate',          'Start Date'),
                        ...f.date('endDate',            'End Date'),
                        ...f.number('volume',           'Workout Volume (variable exercises per circuit)'),
                        ...f.reference('protocolId',    'Protocol', 'PhysioProtocol')
                    ]),
                    f.section('Clinical Details', [
                        ...f.textarea('goals',          'Goals'),
                        ...f.textarea('description',    'Description'),
                        ...f.textarea('therapistNotes', 'Therapist Notes')
                    ])
                ]),

                Appointment: f.form('Appointment', [
                    f.section('Appointment Details', [
                        ...f.reference('clientId',     'Client',         'PhysioClient',    true),
                        ...f.reference('therapistId',  'Therapist',      'PhysioTherapist', true),
                        ...f.reference('planId',       'Treatment Plan', 'TreatmentPlan'),
                        ...f.date('startTime',         'Start Time',     true),
                        ...f.date('endTime',           'End Time',       true),
                        ...f.select('status',          'Status',         enums.APPT_STATUS),
                        ...f.text('location',          'Location')
                    ]),
                    f.section('Notes', [
                        ...f.textarea('therapistNotes', 'Therapist Notes'),
                        ...f.textarea('clientNotes',    'Client Notes')
                    ])
                ]),

                ProgressLog: f.form('Progress Log', [
                    f.section('Log Details', [
                        ...f.reference('clientId',        'Client',        'PhysioClient',  true),
                        ...f.reference('planId',          'Treatment Plan','TreatmentPlan'),
                        ...f.reference('apptId',          'Appointment',   'Appointment'),
                        ...f.date('logDate',              'Log Date',      true),
                        ...f.number('overallPainLevel',   'Overall Pain Level (0-10)')
                    ]),
                    f.section('Notes', [
                        ...f.textarea('generalNotes', 'General Notes')
                    ])
                ]),

                PhysioProtocol: f.form('Protocol Template', [
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
                ]),

                PhysioTherapist: f.form('Therapist', [
                    f.section('Personal Details', [
                        ...f.text('firstName',     'First Name',     true),
                        ...f.text('lastName',      'Last Name',      true),
                        ...f.text('email',         'Email'),
                        ...f.text('phone',         'Phone')
                    ]),
                    f.section('Professional Details', [
                        ...f.text('specialization', 'Specialization'),
                        ...f.text('licenseNumber',  'License Number'),
                        ...f.checkbox('isActive',   'Active')
                    ]),
                    f.section('Audit', [
                        ...f.audit()
                    ])
                ]),

                BoostappCalendarEvent: f.form('Boostapp Event', [
                    f.section('Event Details', [
                        ...f.text('title',       'Title',     false, { readOnly: true }),
                        ...f.text('startTime',   'Start',     false, { readOnly: true }),
                        ...f.text('endTime',     'End',       false, { readOnly: true }),
                        ...f.text('coachName',   'Coach',     false, { readOnly: true }),
                        ...f.select('eventType', 'Type',      enums.BOOSTAPP_EVENT_TYPE, false, { readOnly: true }),
                        ...f.select('eventStatus','Status',   enums.BOOSTAPP_EVENT_STATUS, false, { readOnly: true }),
                        ...f.text('location',    'Location',  false, { readOnly: true })
                    ]),
                    f.section('Client', [
                        ...f.text('clientName',  'Client Name',  false, { readOnly: true }),
                        ...f.text('clientPhone', 'Client Phone', false, { readOnly: true }),
                        ...f.reference('physioClientId', 'Linked Client', 'PhysioClient')
                    ]),
                    f.section('Details', [
                        ...f.text('price',          'Price',     false, { readOnly: true }),
                        ...f.number('members',      'Members',   false, { readOnly: true }),
                        ...f.number('maxMembers',   'Max Members', false, { readOnly: true }),
                        ...f.checkbox('isCancelled', 'Cancelled', false, { readOnly: true })
                    ]),
                    f.section('Participants', [
                        ...f.inlineTable('participants', 'Participants', [
                            { key: 'participantId',    label: 'ID',           hidden: true },
                            { key: 'name',             label: 'Name',         type: 'text' },
                            { key: 'boostappClientId', label: 'Boostapp ID',  type: 'text' },
                            { key: 'status',           label: 'Status',       type: 'text' },
                            { key: 'membership',       label: 'Membership',   type: 'text' },
                            { key: 'physioClientId',   label: 'Linked Client', type: 'reference', lookupModel: 'PhysioClient' }
                        ])
                    ])
                ])
            };
        }
    };
})();
