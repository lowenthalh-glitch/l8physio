// PhysioClientAppointments — renders Boostapp events where this client is a participant
(function() {
    'use strict';

    function apiPrefix() {
        return (window.Layer8DConfig && Layer8DConfig.getApiPrefix())
            ? Layer8DConfig.getApiPrefix() : '/physio';
    }

    function authFetch(url) {
        return fetch(url, { headers: getAuthHeaders() }).then(function(r) {
            if (!r.ok) {
                return r.text().then(function(t) { throw new Error(t || ('HTTP ' + r.status)); });
            }
            return r.json();
        });
    }

    var TYPE_MAP = { 1: 'Meeting', 2: 'Class', 3: 'Block' };

    window.PhysioClientAppointments = {

        _table: null,

        init: function(container, client) {
            if (!container) return;
            if (!client.boostappId && !client.clientId) {
                container.innerHTML = '<div class="physio-no-protocol">No Boostapp ID set on this client. Add a Boostapp ID in the client details to see matched appointments.</div>';
                return;
            }

            container.innerHTML = '<div class="physio-exercises-loading">Loading appointments\u2026</div>';

            var self = this;
            var query = encodeURIComponent(JSON.stringify({ text: 'select * from BoostappCalendarEvent limit 500' }));
            authFetch(apiPrefix() + '/50/BstpCal?body=' + query)
            .then(function(data) {
                var all = data.list || [];
                var matched = all.filter(function(e) {
                    if (e.physioClientId && e.physioClientId === client.clientId) return true;
                    if (client.boostappId && Array.isArray(e.participants)) {
                        return e.participants.some(function(p) {
                            return p.boostappClientId === client.boostappId;
                        });
                    }
                    return false;
                });

                if (matched.length === 0) {
                    container.innerHTML = '<div class="physio-no-protocol">No appointments found for this client.<br><span style="font-size:12px;color:var(--layer8d-text-muted)">Boostapp sync will populate this once the client\'s Boostapp ID matches a participant.</span></div>';
                    return;
                }

                // Sort newest first
                matched.sort(function(a, b) {
                    return (b.startTime || '').localeCompare(a.startTime || '');
                });

                // Build status lookup for this client's participation
                var statusMap = {};
                if (client.boostappId) {
                    matched.forEach(function(e) {
                        if (!Array.isArray(e.participants)) return;
                        var p = e.participants.find(function(p) { return p.boostappClientId === client.boostappId; });
                        if (p) statusMap[e.eventId] = p.status || '';
                    });
                }

                // Transform data for table
                var items = matched.map(function(e) {
                    return {
                        eventId: e.eventId,
                        startTime: e.startTime || '',
                        endTime: e.endTime || '',
                        title: e.title || '',
                        eventType: TYPE_MAP[e.eventType] || '',
                        coachName: e.coachName || '',
                        location: e.location || '',
                        participantStatus: statusMap[e.eventId] || '',
                        isCancelled: e.isCancelled ? 'Cancelled' : ''
                    };
                });

                var containerId = 'physio-client-appointments-table';
                container.innerHTML = '<div id="' + containerId + '"></div>';

                var col = window.Layer8ColumnFactory;
                var columns = [
                    ...col.col('startTime', 'Start'),
                    ...col.col('endTime', 'End'),
                    ...col.col('title', 'Title'),
                    ...col.col('eventType', 'Type'),
                    ...col.col('coachName', 'Coach'),
                    ...col.col('location', 'Location'),
                    ...col.col('participantStatus', 'Status'),
                    ...col.col('isCancelled', '')
                ];

                self._table = new Layer8DTable({
                    containerId: containerId,
                    columns: columns,
                    primaryKey: 'eventId',
                    pageSize: 10,
                    serverSide: false,
                    sortable: true,
                    filterable: false,
                    showActions: false
                });
                self._table.init();
                self._table.setData(items);
            })
            .catch(function(err) {
                container.innerHTML = '<div class="physio-no-protocol" style="color:var(--layer8d-error);">Failed to load appointments: ' + Layer8DUtils.escapeHtml(err.message) + '</div>';
            });
        }
    };
})();
