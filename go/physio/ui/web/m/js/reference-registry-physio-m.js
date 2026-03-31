(function() {
    'use strict';
    const ref = window.Layer8RefFactory;

    window.Layer8MReferenceRegistryPhysio = {
        ...ref.person('PhysioClient',   'clientId',    'lastName',  'firstName'),
        ...ref.person('PhysioTherapist','therapistId', 'lastName',  'firstName'),
        ...ref.simple('PhysioExercise', 'exerciseId',  'name',      'Exercise'),
        ...ref.simple('TreatmentPlan',  'planId',      'title',     'Treatment Plan'),
        ...ref.simple('Appointment',    'apptId',      'apptId',    'Appointment'),
        ...ref.simple('ProgressLog',    'logId',       'logId',     'Progress Log'),
        ...ref.simple('PhysioProtocol', 'protocolId',  'name',      'Protocol')
    };

    Layer8MReferenceRegistry.register(window.Layer8MReferenceRegistryPhysio);
})();
