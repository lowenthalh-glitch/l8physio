// Mobile Session View — multi-client workout plan popup for Boostapp class events
// Each client tab calls MobilePlanRenderer.render() (shared renderer)
(function() {
    'use strict';

    function _api() { return Layer8DConfig.getApiPrefix(); }
    function _get(url) { return Layer8MAuth.get(url); }

    window.MobilePhysioSessionView = {

        show: function(event) {
            if (!event) return;
            var participants = event.participants || [];
            var title = event.title || 'Session';
            var time = (event.startTime || '') + ' \u2014 ' + (event.endTime || '');

            // 1-on-1: open client popup directly
            if (participants.length === 0 && event.physioClientId) {
                if (window.MobilePhysioClientExercises) MobilePhysioClientExercises.open(event.physioClientId);
                return;
            }
            if (participants.length === 0) {
                Layer8MUtils.showError('No participants linked to this event.');
                return;
            }

            // Collect unique physioClientIds
            var clientIds = [];
            participants.forEach(function(p) {
                if (p.physioClientId && clientIds.indexOf(p.physioClientId) === -1) clientIds.push(p.physioClientId);
            });
            if (clientIds.length === 0) {
                var names = participants.map(function(p) { return p.name || 'Unknown'; }).join(', ');
                Layer8MUtils.showError('Participants not linked: ' + names);
                return;
            }

            // Fetch client names in parallel
            var results = [];
            var pending = clientIds.length;
            clientIds.forEach(function(cid) {
                var q = encodeURIComponent(JSON.stringify({ text: 'select * from PhysioClient where clientId=' + cid }));
                _get(_api() + '/50/PhyClient?body=' + q)
                .then(function(data) {
                    var client = (data.list || [])[0];
                    if (client) results.push(client);
                    if (--pending === 0) _openPopup(title, time, results);
                })
                .catch(function() { if (--pending === 0) _openPopup(title, time, results); });
            });
        }
    };

    function _openPopup(title, time, clients) {
        if (clients.length === 0) {
            Layer8MUtils.showError('No linked clients found.');
            return;
        }

        var tabs = clients.map(function(client, idx) {
            var name = (client.firstName || '') + ' ' + (client.lastName || '');
            return {
                id: 'client-' + idx,
                label: name,
                content: '<div style="margin-bottom:8px;color:var(--layer8d-text-medium);font-size:13px;">' +
                    Layer8DUtils.escapeHtml(time) + '</div>' +
                    '<div id="msession-plan-' + idx + '" style="min-height:150px;"></div>'
            };
        });

        var loaded = {};

        Layer8MPopup.show({
            title: title,
            size: 'full',
            showFooter: false,
            tabs: tabs,
            onShow: function(popup) {
                var body = popup && popup.body ? popup.body : popup;
                if (!body || !window.MobilePlanRenderer) return;
                // Render first client immediately
                loaded[0] = true;
                MobilePlanRenderer.render(body.querySelector('#msession-plan-0'), clients[0].clientId);
            },
            onTabChange: function(tabId, popup) {
                var body = popup && popup.body ? popup.body : popup;
                if (!body || !window.MobilePlanRenderer) return;
                var match = tabId && tabId.match(/^client-(\d+)$/);
                if (!match) return;
                var idx = parseInt(match[1], 10);
                if (!loaded[idx] && clients[idx]) {
                    loaded[idx] = true;
                    MobilePlanRenderer.render(body.querySelector('#msession-plan-' + idx), clients[idx].clientId);
                }
            }
        });
    }
})();
