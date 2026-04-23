// Mobile Physio module registry — uses desktop PhysioManagement namespace
// with enriched columns (primary/secondary markers for card display).
// Follows l8erp hcm-index.js pattern: reference desktop objects directly.
(function() {
    'use strict';

    // Enrich desktop columns with mobile card display markers
    function _enrich(columns, primaryKey, secondaryKey) {
        if (!columns) return null;
        return columns.map(function(col) {
            if (col.key === primaryKey) return Object.assign({}, col, { primary: true });
            if (col.key === secondaryKey) return Object.assign({}, col, { secondary: true });
            return col;
        });
    }

    // Desktop namespace populated by desktop enum/column files loaded before this script
    var dc = (window.PhysioManagement || {}).columns || {};
    var dp = (window.PhysioManagement || {}).primaryKeys || {};

    // HeadThDashRow columns (dashboard uses custom view on desktop, needs explicit columns on mobile)
    var col = window.Layer8ColumnFactory;
    var render = (window.PhysioManagement || {}).render || {};
    var dashCols = [
        ...col.col('clientName',  'Client'),
        ...col.col('therapistName', 'Therapist'),
        ...col.date('lastFeedbackDate', 'Feedback Date'),
        ...col.status('lastFeedbackStatus', 'Feedback', null, render.sessionStatus),
        ...col.date('lastSessionDate', 'Session Date'),
        ...col.status('lastSessionStatus', 'Session', null, render.sessionStatus),
        ...col.status('overrideStatus', 'Override', null, render.sessionStatus),
        ...col.number('swapCount', 'Swaps'),
        ...col.col('statusReason', 'Reason')
    ];

    // Build enriched column set
    var enrichedColumns = {
        HeadThDashRow: _enrich(dashCols, 'clientName', 'statusReason'),
        PhysioClient:             _enrich(dc.PhysioClient, 'lastName', 'status'),
        PhysioTherapist:          _enrich(dc.PhysioTherapist, 'lastName', 'specialization'),
        PhysioExercise:           _enrich(dc.PhysioExercise, 'name', 'category'),
        TreatmentPlan:            _enrich(dc.TreatmentPlan, 'title', 'status'),
        Appointment:              _enrich(dc.Appointment, 'clientId', 'status'),
        ProgressLog:              _enrich(dc.ProgressLog, 'clientId', 'logDate'),
        PhysioProtocol:           _enrich(dc.PhysioProtocol, 'name', 'joint'),
        SessionReport:            _enrich(dc.SessionReport, 'sessionDate', 'status'),
        HomeFeedback:             _enrich(dc.HomeFeedback, 'feedbackDate', 'status'),
        BoostappCalendarEvent:    _enrich(dc.BoostappCalendarEvent, 'title', 'startTime')
    };

    // Alias desktop namespace for mobile consumers that reference MobilePhysioManagement
    window.MobilePhysioManagement = window.PhysioManagement || {};

    // Add dashboard columns + primaryKey to desktop namespace (not defined elsewhere)
    MobilePhysioManagement.columns = MobilePhysioManagement.columns || {};
    MobilePhysioManagement.columns.HeadThDashRow = dashCols;
    MobilePhysioManagement.primaryKeys = MobilePhysioManagement.primaryKeys || {};
    MobilePhysioManagement.primaryKeys.HeadThDashRow = 'clientId';

    // Create registry using desktop namespace
    window.MobilePhysio = Layer8MModuleRegistry.create('MobilePhysio', {
        'Management': window.MobilePhysioManagement
    });

    // Override getColumns to return enriched versions with primary/secondary
    var origGetColumns = window.MobilePhysio.getColumns;
    window.MobilePhysio.getColumns = function(modelName) {
        return enrichedColumns[modelName] || (origGetColumns ? origGetColumns(modelName) : null);
    };

    // Load name lookup caches (therapist/client/exercise names for column renderers)
    if (MobilePhysioManagement.lookups && MobilePhysioManagement.lookups.load) {
        MobilePhysioManagement.lookups.load();
    }
})();
