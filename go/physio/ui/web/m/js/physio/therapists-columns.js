(function() {
    'use strict';
    var col = window.Layer8ColumnFactory;

    MobilePhysioManagement.columns = MobilePhysioManagement.columns || {};
    MobilePhysioManagement.columns.PhysioTherapist = [
        ...col.id('therapistId'),
        ...col.col('firstName', 'First Name'),
        ...col.col('lastName',  'Last Name'),
        ...col.col('email',     'Email'),
        ...col.col('phone',     'Phone'),
        ...col.col('specialization', 'Specialization'),
        ...col.boolean('isActive', 'Active')
    ];

    MobilePhysioManagement.columns.PhysioTherapist =
        MobilePhysioManagement.columns.PhysioTherapist.map(function(c) {
            if (c.key === 'lastName')       return Object.assign({}, c, { primary: true });
            if (c.key === 'specialization') return Object.assign({}, c, { secondary: true });
            return c;
        });

    MobilePhysioManagement.primaryKeys = MobilePhysioManagement.primaryKeys || {};
    MobilePhysioManagement.primaryKeys.PhysioTherapist = 'therapistId';
})();
