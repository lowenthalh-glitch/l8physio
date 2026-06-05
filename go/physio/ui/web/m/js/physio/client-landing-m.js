// MobilePhysioClientLanding — full-page client view (no popup chrome)
// Mirrors the 6-tab popup from clients-exercises.js but renders directly
// into a container so the client's mobile portal lands here on login.
(function() {
    'use strict';

    var TABS = [
        { id: 'exercises',    label: 'Exercises' },
        { id: 'reports',      label: 'Reports' },
        { id: 'stats',        label: 'Stats' },
        { id: 'feedback',     label: 'Feedback' },
        { id: 'appointments', label: 'Appointments' },
        { id: 'details',      label: 'Details' }
    ];

    function _canCreate(model) {
        var perms = window.Layer8DPermissions;
        if (!perms || Object.keys(perms).length === 0) return true;
        return (perms[model] || []).indexOf(1) !== -1;
    }

    function _renderShell(container, client) {
        var name = ((client.firstName || '') + ' ' + (client.lastName || '')).trim() || 'My Plan';
        var tabsHtml = TABS.map(function(t, idx) {
            return '<button class="mobile-popup-tab ' + (idx === 0 ? 'active' : '') +
                '" data-tab="' + t.id + '">' + Layer8MUtils.escapeHtml(t.label) + '</button>';
        }).join('');
        var contentsHtml = TABS.map(function(t, idx) {
            return '<div class="mobile-popup-tab-content ' + (idx === 0 ? 'active' : '') +
                '" data-tab-content="' + t.id + '"><div id="mclient-' + t.id + '"></div></div>';
        }).join('');
        var addFeedbackHtml = _canCreate('HomeFeedback')
            ? '<button class="mclient-landing-feedback-btn" type="button">+ Add Feedback</button>'
            : '';

        container.innerHTML =
            '<div class="mclient-landing">' +
                '<div class="mclient-landing-title">' +
                    '<span class="mclient-landing-name">' + Layer8MUtils.escapeHtml(name) + '</span>' +
                    addFeedbackHtml +
                '</div>' +
                '<div class="mobile-popup-tabs">' + tabsHtml + '</div>' +
                '<div class="mclient-landing-body">' + contentsHtml + '</div>' +
            '</div>';
    }

    function _injectStylesOnce() {
        if (document.getElementById('mclient-landing-styles')) return;
        var style = document.createElement('style');
        style.id = 'mclient-landing-styles';
        style.textContent =
            '.mclient-landing { padding: 0; }' +
            '.mclient-landing-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; background: var(--bg-primary, #fff); border-bottom: 1px solid var(--border-light, #f3f4f6); }' +
            '.mclient-landing-name { font-size: 18px; font-weight: 600; color: var(--text-primary, #111827); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }' +
            '.mclient-landing-feedback-btn { flex-shrink: 0; padding: 8px 14px; border: none; border-radius: 6px; background: var(--layer8d-primary, #0ea5e9); color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; }' +
            '.mclient-landing-feedback-btn:active { opacity: 0.8; }' +
            '.mclient-landing-body { padding: 12px; }';
        document.head.appendChild(style);
    }

    function _renderTab(container, client, tabId) {
        var clientId = client.clientId;
        var host = container.querySelector('#mclient-' + tabId);
        if (!host || host._loaded) return;
        host._loaded = true;

        if (tabId === 'exercises') {
            if (window.MobilePlanRenderer) MobilePlanRenderer.render(host, clientId);
            return;
        }
        if (tabId === 'reports') {
            if (window.MobilePhysioReportsTab) MobilePhysioReportsTab.render(host, client);
            return;
        }
        if (tabId === 'stats') {
            if (window.MobilePhysioStatsTab) {
                setTimeout(function() { MobilePhysioStatsTab.render(host, client); }, 50);
            }
            return;
        }
        if (tabId === 'feedback') {
            if (window.MobilePhysioFeedbackTab) MobilePhysioFeedbackTab.render(host, client);
            return;
        }
        if (tabId === 'appointments') {
            if (window.MobilePhysioAppointmentsTab) MobilePhysioAppointmentsTab.render(host, client);
            return;
        }
        if (tabId === 'details') {
            var formDef = (window.MobilePhysioManagement && MobilePhysioManagement.forms || {}).PhysioClient;
            if (formDef) {
                host.innerHTML = Layer8MForms.renderForm(formDef, client, true);
                if (typeof Layer8MForms.initFormFields === 'function') Layer8MForms.initFormFields(host);
            }
        }
    }

    function _bindTabs(container, client) {
        var tabs = container.querySelectorAll('.mobile-popup-tab');
        var contents = container.querySelectorAll('.mobile-popup-tab-content');
        tabs.forEach(function(tab) {
            tab.addEventListener('click', function() {
                var tabId = tab.dataset.tab;
                tabs.forEach(function(t) { t.classList.remove('active'); });
                tab.classList.add('active');
                contents.forEach(function(c) {
                    c.classList.toggle('active', c.dataset.tabContent === tabId);
                });
                _renderTab(container, client, tabId);
            });
        });
    }

    function _bindFeedbackButton(container, client) {
        var btn = container.querySelector('.mclient-landing-feedback-btn');
        if (!btn || !window.MobilePhysioFeedbackTab) return;
        btn.addEventListener('click', function() {
            MobilePhysioFeedbackTab.openAdd(client, function() {
                var host = container.querySelector('#mclient-feedback');
                if (host && host._loaded) {
                    host._loaded = false;
                    host.innerHTML = '';
                    MobilePhysioFeedbackTab.render(host, client);
                    host._loaded = true;
                }
            });
        });
    }

    window.MobilePhysioClientLanding = {
        // Render the landing for the logged-in client into the given container.
        // Looks up the client via /50/PhyClient (scope filters return only self).
        renderForCurrentUser: function(container) {
            if (!container) return;
            _injectStylesOnce();
            container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted,#6b7280);font-size:14px;">Loading…</div>';

            var apiPrefix = Layer8MConfig.getConfig().app.apiPrefix;
            var query = encodeURIComponent(JSON.stringify({ text: 'select * from PhysioClient' }));
            Layer8MAuth.get(apiPrefix + '/50/PhyClient?body=' + query)
                .then(function(data) {
                    var client = ((data && data.list) || [])[0];
                    if (!client) {
                        container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted,#6b7280);font-size:14px;">No client record found for your account.</div>';
                        return;
                    }
                    _renderShell(container, client);
                    _bindTabs(container, client);
                    _bindFeedbackButton(container, client);
                    _renderTab(container, client, 'exercises');
                })
                .catch(function() {
                    container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--status-terminated,#dc2626);font-size:14px;">Failed to load your record.</div>';
                });
        }
    };
})();
