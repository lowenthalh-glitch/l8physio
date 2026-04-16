(function() {
    'use strict';

    function initAiaChat() {
        if (typeof L8AgentChat === 'undefined') return;
        var container = document.getElementById('aia-chat-container');
        if (!container) return;
        if (container.dataset.initialized) return;
        container.dataset.initialized = 'true';

        L8AgentChat.init({
            containerId:  'aia-chat-container',
            chatEndpoint: '/55/AgntChat'
        });
    }

    // Override the module initializer to also init the chat UI
    var origInit = window.initializeAia;
    window.initializeAia = function() {
        if (origInit) origInit();

        var chatView = document.querySelector('.l8-service-view[data-service="chat"]');
        if (chatView) {
            if (chatView.classList.contains('active')) {
                initAiaChat();
            }
            var observer = new MutationObserver(function() {
                if (chatView.classList.contains('active')) {
                    initAiaChat();
                }
            });
            observer.observe(chatView, { attributes: true, attributeFilter: ['class'] });
        }
    };
})();
