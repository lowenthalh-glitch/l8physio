(function() {
    'use strict';
    var all = PhysioSharedForms.build(PhysioManagement.enums);
    PhysioManagement.forms = PhysioManagement.forms || {};
    Object.keys(all).forEach(function(k) {
        PhysioManagement.forms[k] = all[k];
    });
})();
