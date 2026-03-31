(function() {
    'use strict';

    window.MobileAiaAgent = window.MobileAiaAgent || {};

    // Called by customInit pattern in layer8m-nav when chat service is activated
    MobileAiaAgent.initialize = function() {
        if (typeof L8AgentChatMobile !== 'undefined') {
            L8AgentChatMobile.init({
                containerId:  'aia-chat-container',
                chatEndpoint: '/physio/55/AgntChat'
            });
        }
    };
})();

window.MobileAia = Layer8MModuleRegistry.create('MobileAia', {
    'Agent': MobileAiaAgent
});
