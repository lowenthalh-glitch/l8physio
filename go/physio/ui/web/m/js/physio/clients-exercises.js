// MobilePhysioClientExercises — client popup with 6 tabs
// Delegates workout to MobilePlanRenderer, tabs to clients-popup-tabs-m.js
(function() {
    'use strict';

    window.MobilePhysioClientExercises = {

        open: function(clientId) {
            var self = this;
            var config = Layer8MConfig.getConfig();
            var apiPrefix = config && config.app ? config.app.apiPrefix : '';
            var query = encodeURIComponent(JSON.stringify({ text: 'select * from PhysioClient where clientId=' + clientId }));
            Layer8MAuth.get(apiPrefix + '/50/PhyClient?body=' + query)
            .then(function(data) {
                var client = ((data && data.list) || [])[0];
                if (!client) { Layer8MUtils.showError('Client not found'); return; }
                self._showPopup(client);
            })
            .catch(function() { Layer8MUtils.showError('Failed to load client'); });
        },

        _showPopup: function(client) {
            var name = (client.firstName || '') + ' ' + (client.lastName || '');
            var clientId = client.clientId;

            Layer8MPopup.show({
                title: name,
                size: 'full',
                showFooter: false,
                tabs: [
                    { id: 'exercises', label: 'Exercises', content: '<div id="mclient-plan"></div>' },
                    { id: 'reports', label: 'Reports', content: '<div id="mclient-reports"></div>' },
                    { id: 'stats', label: 'Stats', content: '<div id="mclient-stats"></div>' },
                    { id: 'feedback', label: 'Feedback', content: '<div id="mclient-feedback"></div>' },
                    { id: 'appointments', label: 'Appointments', content: '<div id="mclient-appts"></div>' },
                    { id: 'details', label: 'Details', content: '<div id="mclient-details"></div>' }
                ],
                onShow: function(popup) {
                    var body = popup && popup.body ? popup.body : popup;
                    if (!body) return;
                    // Exercises tab — load immediately
                    if (window.MobilePlanRenderer) {
                        MobilePlanRenderer.render(body.querySelector('#mclient-plan'), clientId);
                    }
                },
                onTabChange: function(tabId, popup) {
                    var body = popup && popup.body ? popup.body : popup;
                    if (!body) return;

                    if (tabId === 'reports') {
                        var rc = body.querySelector('#mclient-reports');
                        if (rc && !rc._loaded && window.MobilePhysioReportsTab) { rc._loaded = true; MobilePhysioReportsTab.render(rc, client); }
                    }
                    if (tabId === 'stats') {
                        var sc = body.querySelector('#mclient-stats');
                        if (sc && !sc._loaded && window.MobilePhysioStatsTab) { sc._loaded = true; setTimeout(function() { MobilePhysioStatsTab.render(sc, client); }, 50); }
                    }
                    if (tabId === 'feedback') {
                        var fc = body.querySelector('#mclient-feedback');
                        if (fc && !fc._loaded && window.MobilePhysioFeedbackTab) { fc._loaded = true; MobilePhysioFeedbackTab.render(fc, client); }
                    }
                    if (tabId === 'appointments') {
                        var ac = body.querySelector('#mclient-appts');
                        if (ac && !ac._loaded && window.MobilePhysioAppointmentsTab) { ac._loaded = true; MobilePhysioAppointmentsTab.render(ac, client); }
                    }
                    if (tabId === 'details') {
                        var dc = body.querySelector('#mclient-details');
                        if (dc && !dc._loaded) {
                            dc._loaded = true;
                            var formDef = (MobilePhysioManagement.forms || {}).PhysioClient;
                            if (formDef) {
                                dc.innerHTML = Layer8MForms.renderForm(formDef, client, true);
                                if (typeof Layer8MForms.initFormFields === 'function') Layer8MForms.initFormFields(dc);
                            }
                        }
                    }
                }
            });
        }
    };
})();
