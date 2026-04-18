(function() {
    'use strict';
    var col    = window.Layer8ColumnFactory;
    var enums  = PhysioManagement.enums;
    var render = PhysioManagement.render;

    PhysioManagement.columns = PhysioManagement.columns || {};
    PhysioManagement.columns.BoostappCalendarEvent = [
        ...col.id('eventId',        'Event ID'),
        ...col.col('title',         'Title'),
        ...col.col('startTime',     'Start'),
        ...col.col('endTime',       'End'),
        ...col.col('coachName',     'Coach'),
        ...col.enum('eventType',    'Type',    null, render.boostappEventType, enums.BOOSTAPP_EVENT_TYPE),
        ...col.status('eventStatus','Status',  enums.BOOSTAPP_EVENT_STATUS_VALUES, render.boostappEventStatus),
        ...col.col('location',      'Location'),
        ...col.col('clientName',    'Client'),
        ...col.col('clientPhone',   'Phone'),
        ...col.boolean('isCancelled','Cancelled')
    ];

    PhysioManagement.primaryKeys = PhysioManagement.primaryKeys || {};
    PhysioManagement.primaryKeys.BoostappCalendarEvent = 'eventId';
})();
