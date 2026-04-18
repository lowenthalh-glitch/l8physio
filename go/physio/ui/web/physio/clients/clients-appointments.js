// PhysioClientAppointments — renders Boostapp events where this client is a participant
(function() {
    'use strict';

    function apiPrefix() {
        return (window.Layer8DConfig && Layer8DConfig.getApiPrefix())
            ? Layer8DConfig.getApiPrefix() : '/physio';
    }

    function authFetch(url) {
        return fetch(url, { headers: getAuthHeaders() }).then(function(r) { return r.json(); });
    }

    window.PhysioClientAppointments = {

        /**
         * Renders the appointments tab for a client.
         * Matches on client.boostappId → event.participants[].boostappClientId
         * Also falls back to matching event.physioClientId === client.clientId (for 1-on-1 meetings).
         */
        init: function(container, client) {
            if (!container) return;
            if (!client.boostappId && !client.clientId) {
                container.innerHTML = '<div class="physio-no-protocol">No Boostapp ID set on this client. Add a Boostapp ID in the client details to see matched appointments.</div>';
                return;
            }

            container.innerHTML = '<div class="physio-exercises-loading">Loading appointments\u2026</div>';

            // Fetch all Boostapp events and filter client-side (simpler than server query for nested participants)
            var query = encodeURIComponent(JSON.stringify({ text: 'select * from BoostappCalendarEvent limit 500' }));
            authFetch(apiPrefix() + '/50/BstpCal?body=' + query)
            .then(function(data) {
                var all = data.list || [];
                var matched = all.filter(function(e) {
                    // 1-on-1 meetings: physioClientId direct link
                    if (e.physioClientId && e.physioClientId === client.clientId) return true;
                    // Classes: check participants
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

                // Sort by start time (desc = newest first)
                matched.sort(function(a, b) {
                    return (b.startTime || '').localeCompare(a.startTime || '');
                });

                var esc = Layer8DUtils.escapeHtml;
                var rows = matched.map(function(e) {
                    var typeLabel = '';
                    if (e.eventType === 1) typeLabel = 'Meeting';
                    else if (e.eventType === 2) typeLabel = 'Class';
                    else if (e.eventType === 3) typeLabel = 'Block';

                    var statusLabel = '';
                    if (e.participants && client.boostappId) {
                        var part = e.participants.find(function(p) { return p.boostappClientId === client.boostappId; });
                        if (part) statusLabel = part.status || '';
                    }
                    var cancelled = e.isCancelled ? '<span style="color:var(--layer8d-error);font-weight:600;">Cancelled</span>' : '';

                    return '<tr>' +
                        '<td>' + esc(e.startTime || '') + '</td>' +
                        '<td>' + esc(e.endTime || '') + '</td>' +
                        '<td>' + esc(e.title || '') + '</td>' +
                        '<td>' + esc(typeLabel) + '</td>' +
                        '<td>' + esc(e.coachName || '') + '</td>' +
                        '<td>' + esc(e.location || '') + '</td>' +
                        '<td>' + esc(statusLabel) + '</td>' +
                        '<td>' + cancelled + '</td>' +
                    '</tr>';
                }).join('');

                container.innerHTML =
                    '<div style="padding:12px;">' +
                      '<div style="margin-bottom:12px;color:var(--layer8d-text-medium);font-size:13px;">' +
                        matched.length + ' appointment' + (matched.length === 1 ? '' : 's') + ' matched' +
                        (client.boostappId ? ' (Boostapp ID: ' + esc(client.boostappId) + ')' : '') +
                      '</div>' +
                      '<table class="layer8d-table" style="width:100%;">' +
                        '<thead><tr>' +
                          '<th>Start</th><th>End</th><th>Title</th><th>Type</th><th>Coach</th><th>Location</th><th>Status</th><th></th>' +
                        '</tr></thead>' +
                        '<tbody>' + rows + '</tbody>' +
                      '</table>' +
                    '</div>';
            })
            .catch(function(err) {
                container.innerHTML = '<div class="physio-no-protocol" style="color:var(--layer8d-error);">Failed to load appointments: ' + Layer8DUtils.escapeHtml(err.message) + '</div>';
            });
        }
    };
})();
