(function() {
    'use strict';
    var col    = window.Layer8ColumnFactory;
    var enums  = MobilePhysioManagement.enums;
    var render = MobilePhysioManagement.render;

    MobilePhysioManagement.columns = MobilePhysioManagement.columns || {};
    MobilePhysioManagement.columns.BoostappCalendarEvent = [
        ...col.id('eventId'),
        ...col.col('title',         'Title'),
        ...col.col('startTime',     'Start'),
        ...col.col('endTime',       'End'),
        ...col.col('coachName',     'Coach'),
        ...col.enum('eventType',    'Type',    null, render.boostappEventType),
        ...col.status('eventStatus','Status',  enums.BOOSTAPP_EVENT_STATUS_VALUES, render.boostappEventStatus),
        ...col.col('location',      'Location'),
        ...col.col('clientName',    'Client'),
        ...col.boolean('isCancelled','Cancelled')
    ];

    // Mark primary/secondary for card display
    MobilePhysioManagement.columns.BoostappCalendarEvent =
        MobilePhysioManagement.columns.BoostappCalendarEvent.map(function(c) {
            if (c.key === 'title')      return Object.assign({}, c, { primary: true });
            if (c.key === 'startTime')  return Object.assign({}, c, { secondary: true });
            return c;
        });

    MobilePhysioManagement.primaryKeys = MobilePhysioManagement.primaryKeys || {};
    MobilePhysioManagement.primaryKeys.BoostappCalendarEvent = 'eventId';
})();
