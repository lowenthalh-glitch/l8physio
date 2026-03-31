(function() {
    'use strict';
    const col = window.Layer8ColumnFactory;

    PhysioManagement.columns = PhysioManagement.columns || {};
    PhysioManagement.columns.ProgressLog = [
        ...col.id('logId',              'Log ID'),
        ...col.col('clientId',          'Client ID'),
        ...col.date('logDate',          'Log Date'),
        ...col.col('overallPainLevel',   'Pain Level'),
        ...col.col('planId',            'Plan ID'),
        ...col.col('apptId',            'Appt ID'),
        ...col.col('generalNotes',      'Notes')
    ];

    PhysioManagement.primaryKeys = PhysioManagement.primaryKeys || {};
    PhysioManagement.primaryKeys.ProgressLog = 'logId';
})();
