// Startup dependency check for the mobile shell (FailFastNoSilentFallback).
// See js/physio-deps-check.js for the rationale; runs at DOMContentLoaded.
(function() {
    'use strict';

    var REQUIRED = [
        'Layer8MConfig', 'Layer8MAuth', 'Layer8MUtils', 'Layer8MPopup', 'Layer8MConfirm',
        'Layer8MTable', 'Layer8MEditTable', 'Layer8MForms', 'Layer8MRenderers', 'Layer8MDataSource',
        'Layer8MReferenceRegistry', 'Layer8MModuleRegistry', 'Layer8MNav', 'Layer8MNavCrud', 'Layer8MNavData',
        'Layer8DConfig', 'Layer8DUtils', 'Layer8DRenderers', 'Layer8DPermissionFilter',
        'Layer8EnumFactory', 'Layer8ColumnFactory', 'Layer8FormFactory',
        'LAYER8M_NAV_CONFIG'
    ];

    // Bare-identifier typeof also sees top-level `class` declarations (e.g. Layer8DTable), which are not window properties.
    function isDefined(name) {
        return new Function('return typeof ' + name + " !== 'undefined'")();
    }

    function check() {
        var missing = REQUIRED.filter(function(name) { return !isDefined(name); });
        if (missing.length === 0) return;

        var msg = 'Physio mobile cannot start: missing scripts for ' + missing.join(', ') +
                  '. Add the script tag(s) to ' + location.pathname + '.';
        console.error('[physio-deps-check] ' + msg);
        document.body.innerHTML = '<div id="physio-deps-error" style="padding:24px;font-family:sans-serif;color:#b91c1c">' +
            '<h2>Physio failed to load</h2><p></p></div>';
        document.querySelector('#physio-deps-error p').textContent = msg;
        throw new Error(msg);
    }

    document.addEventListener('DOMContentLoaded', check);
})();
