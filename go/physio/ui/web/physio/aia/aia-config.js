(function() {
    'use strict';
    const svc = Layer8ModuleConfigFactory.service;
    const mod = Layer8ModuleConfigFactory.module;

    Layer8ModuleConfigFactory.create({
        namespace: 'Aia',
        modules: {
            'agent': mod('AI Agent', 'agent', [
                svc('chat', 'Chat', 'agent', '/55/AgntChat', 'L8AgentChat')
            ])
        },
        submodules: ['AiaAgent']
    });
})();
