(function() {
    'use strict';
    const svc = Layer8ModuleConfigFactory.service;
    const mod = Layer8ModuleConfigFactory.module;

    Layer8ModuleConfigFactory.create({
        namespace: 'Physio',
        modules: {
            'management': mod('Management', 'health', [
                svc('therapists',    'Therapists',           'person',    '/50/PhyTherapt', 'PhysioTherapist'),
                svc('clients',      'Clients',              'person',    '/50/PhyClient',   'PhysioClient'),
                svc('exercises',    'Exercises',            'activity',  '/50/PhyExercis',  'PhysioExercise'),
                svc('protocols',    'Protocol Templates',   'clipboard', '/50/PhyProto',    'PhysioProtocol'),
                svc('plans',        'Treatment Plans',      'clipboard', '/50/PhyPlan',     'TreatmentPlan'),
                svc('appointments', 'Appointments',         'calendar',  '/50/PhyAppt',     'Appointment'),
                svc('progress',     'Progress Logs',        'chart',     '/50/PhyLog',      'ProgressLog'),
                svc('reports',      'Session Reports',      'clipboard', '/50/SessRpt',     'SessionReport'),
                svc('feedback',     'Home Feedback',        'clipboard', '/50/HomeFdbk',    'HomeFeedback')
            ])
        },
        submodules: ['PhysioManagement']
    });
})();
