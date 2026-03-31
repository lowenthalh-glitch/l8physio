(function() {
    'use strict';
    const col = window.Layer8ColumnFactory;

    MobilePhysioManagement.columns = MobilePhysioManagement.columns || {};
    MobilePhysioManagement.columns.ProgressLog = [
        ...col.id('logId'),
        ...col.col('clientId',           'Client ID'),
        ...col.date('logDate',           'Date'),
        ...col.number('overallPainLevel','Pain Level'),
        ...col.col('generalNotes',       'Notes')
    ].map(function(c) {
        if (c.key === 'logDate')          return Object.assign({}, c, { primary: true });
        if (c.key === 'overallPainLevel') return Object.assign({}, c, { secondary: true });
        return c;
    });

    MobilePhysioManagement.primaryKeys = MobilePhysioManagement.primaryKeys || {};
    MobilePhysioManagement.primaryKeys.ProgressLog = 'logId';
})();
