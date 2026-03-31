/**
 * Physio Nav Data Patch
 *
 * Extends Layer8MNavData to include MobilePhysio and MobileAia registries.
 * Loaded after layer8m-nav-data.js, before layer8m-nav.js.
 *
 * This patch is needed because layer8m-nav-data.js is a shared l8ui library
 * that does not know about project-specific module registries.
 */
(function() {
    'use strict';

    if (!window.Layer8MNavData) return;

    var PHYSIO_REGISTRIES = [window.MobilePhysio, window.MobileAia];

    function withPhysioRegistries(originalFn) {
        return function(serviceConfig) {
            // Try physio-specific registries first
            if (serviceConfig && serviceConfig.model) {
                for (var i = 0; i < PHYSIO_REGISTRIES.length; i++) {
                    var reg = PHYSIO_REGISTRIES[i];
                    if (reg && reg.getColumns) {
                        var cols = reg.getColumns(serviceConfig.model);
                        if (cols) return cols;
                    }
                }
            }
            return originalFn.call(this, serviceConfig);
        };
    }

    function withPhysioRegistriesForm(originalFn) {
        return function(serviceConfig) {
            if (serviceConfig && serviceConfig.model) {
                for (var i = 0; i < PHYSIO_REGISTRIES.length; i++) {
                    var reg = PHYSIO_REGISTRIES[i];
                    if (reg && reg.getFormDef) {
                        var form = reg.getFormDef(serviceConfig.model);
                        if (form) return form;
                    }
                }
            }
            return originalFn.call(this, serviceConfig);
        };
    }

    function withPhysioRegistriesTransform(originalFn) {
        return function(serviceConfig) {
            if (serviceConfig && serviceConfig.model) {
                for (var i = 0; i < PHYSIO_REGISTRIES.length; i++) {
                    var reg = PHYSIO_REGISTRIES[i];
                    if (reg && reg.getTransformData) {
                        var t = reg.getTransformData(serviceConfig.model);
                        if (t) return t;
                    }
                }
            }
            return originalFn.call(this, serviceConfig);
        };
    }

    var nd = window.Layer8MNavData;
    nd.getServiceColumns      = withPhysioRegistries(nd.getServiceColumns.bind(nd));
    nd.getServiceFormDef      = withPhysioRegistriesForm(nd.getServiceFormDef.bind(nd));
    nd.getServiceTransformData= withPhysioRegistriesTransform(nd.getServiceTransformData.bind(nd));
})();
