// Physio-specific dependency graph override
// Replaces the default ERP graph from l8ui with physio module structure
(function() {
    'use strict';
    window.L8SysDependencyGraph = {
        modules: {
            physio: { label: 'Physiotherapy', icon: '🏥', depends: [] }
        },
        subModules: {
            physio: {
                'management': { depends: [], foundation: true }
            }
        },
        services: {}
    };
})();
