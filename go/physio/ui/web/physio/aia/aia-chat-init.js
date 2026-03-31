(function() {
    'use strict';

    function initAiaChat() {
        const container = document.getElementById('aia-chat-container');
        if (!container) return;
        if (container.dataset.initialized) return;
        container.dataset.initialized = 'true';

        L8AgentChat.init({
            containerId:  'aia-chat-container',
            chatEndpoint: '/physio/55/AgntChat'
        });
    }

    // Called by sections.js when the aia section is loaded
    window.initAiaChatSection = function() {
        // The AIA section has a tab; wait for the tab to activate
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(m) {
                if (m.type === 'attributes' && m.attributeName === 'class') {
                    const el = m.target;
                    if (el.classList.contains('active') || el.classList.contains('l8-service-view')) {
                        initAiaChat();
                    }
                }
            });
        });

        const serviceView = document.querySelector('.l8-service-view[data-service="chat"]');
        if (serviceView) {
            observer.observe(serviceView, { attributes: true });
            // Also try immediately in case it is already active
            if (serviceView.classList.contains('active')) {
                initAiaChat();
            }
        }
    };
})();
