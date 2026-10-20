// Startup dependency check (FailFastNoSilentFallback).
// Every global listed here is called unguarded by the app. If a script tag is
// missing from the shell, name every absent global up front instead of letting
// a ReferenceError surface deep inside a table render.
// Runs at DOMContentLoaded, not synchronously: some l8ui files assign their
// global from an immediate init() that has not run while scripts are still loading.
(function() {
    'use strict';

    var COMMON = [
        'Layer8DConfig', 'Layer8DUtils', 'Layer8DRenderers', 'Layer8DReferenceRegistry',
        'Layer8EnumFactory', 'Layer8ColumnFactory', 'Layer8FormFactory', 'Layer8RefFactory',
        'Layer8ModuleConfigFactory', 'Layer8DModuleFactory', 'Layer8DServiceRegistry',
        'Layer8DNotification', 'Layer8DPopup', 'Layer8DForms', 'Layer8DFormsModal',
        'Layer8DFormsData', 'Layer8DFormsFields', 'Layer8DDatePicker', 'Layer8DInputFormatter',
        'Layer8DReferencePicker', 'Layer8DTable', 'Layer8DViewFactory', 'Layer8DDataSource',
        'Layer8SectionGenerator',
        'PhysioManagement', 'PhysioUserProvisioning'
    ];
    // Only the admin shell hosts the System section.
    var SYSTEM = ['L8Logs', 'L8DataImport', 'Layer8DPermissionFilter'];

    // Bare-identifier typeof also sees top-level `class` declarations (e.g. Layer8DTable), which are not window properties.
    function isDefined(name) {
        return new Function('return typeof ' + name + " !== 'undefined'")();
    }

    function check() {
        var required = COMMON.slice();
        if (document.querySelector('.nav-link[data-section="system"]')) required = required.concat(SYSTEM);
        var missing = required.filter(function(name) { return !isDefined(name); });
        if (missing.length === 0) return;

        var msg = 'Physio cannot start: missing scripts for ' + missing.join(', ') +
                  '. Add the script tag(s) to ' + location.pathname + '.';
        console.error('[physio-deps-check] ' + msg);
        document.body.innerHTML = '<div id="physio-deps-error" style="padding:24px;font-family:sans-serif;color:#b91c1c">' +
            '<h2>Physio failed to load</h2><p></p></div>';
        document.querySelector('#physio-deps-error p').textContent = msg;
        throw new Error(msg);
    }

    document.addEventListener('DOMContentLoaded', check);
})();
