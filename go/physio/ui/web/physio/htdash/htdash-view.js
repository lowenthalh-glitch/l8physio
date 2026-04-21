// PhysioHeadDashboard — frontend-aggregated dashboard view
// Workaround: uses client-side aggregation instead of HTDash backend service
// because the ORM panics on zero-value proto enum fields during postgres Write.
// When the ORM bug is fixed, this should be replaced with the backend HTDash service.
(function() {
    'use strict';

    function _apiPrefix() { return Layer8DConfig.getApiPrefix(); }
    function _headers() { return getAuthHeaders(); }
    function _fetchJson(url) {
        return fetch(url, { method: 'GET', headers: _headers() }).then(function(r) { return r.json(); });
    }
    function _query(endpoint, queryText) {
        var body = encodeURIComponent(JSON.stringify({ text: queryText }));
        return _fetchJson(_apiPrefix() + endpoint + '?body=' + body);
    }

    var STATUS_LABELS = { 0: '—', 1: 'Green', 2: 'Yellow', 3: 'Red' };
    var STATUS_CLASSES = { 1: 'layer8d-status-active', 2: 'layer8d-status-pending', 3: 'layer8d-status-terminated' };

    function _statusDot(val) {
        var cls = STATUS_CLASSES[val] || '';
        var label = STATUS_LABELS[val] || '—';
        if (!cls) return '<span style="color:var(--layer8d-text-muted);">' + label + '</span>';
        return '<span class="layer8d-status-tag ' + cls + '">' + label + '</span>';
    }

    window.PhysioHeadDashboard = {
        _container: null,
        _rows: [],

        init: function(containerId) {
            var self = this;
            var el = document.getElementById(containerId);
            if (!el) return;
            self._container = el;
            el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--layer8d-text-muted);">Loading dashboard\u2026</div>';
            self._loadData();
        },

        _loadData: function() {
            var self = this;
            Promise.all([
                _query('/50/PhyClient',  'select * from PhysioClient limit 500'),
                _query('/50/PhyTherapt', 'select * from PhysioTherapist limit 500'),
                _query('/50/HomeFdbk',   'select * from HomeFeedback limit 500'),
                _query('/50/SessRpt',    'select * from SessionReport limit 500'),
                _query('/50/ExSwapLog',  'select * from ExerciseSwapLog limit 500')
            ]).then(function(results) {
                var clients    = (results[0].list || []).filter(function(c) { return c.status === 1; });
                var therapists = results[1].list || [];
                var feedbacks  = results[2].list || [];
                var reports    = results[3].list || [];
                var swaps      = results[4].list || [];
                self._buildAndRender(clients, therapists, feedbacks, reports, swaps);
            }).catch(function(err) {
                if (self._container) {
                    self._container.innerHTML = '<div style="padding:20px;color:var(--layer8d-error);">Failed to load dashboard: ' + Layer8DUtils.escapeHtml(err.message) + '</div>';
                }
            });
        },

        _buildAndRender: function(clients, therapists, feedbacks, reports, swaps) {
            var self = this;

            // Build lookup maps
            var therapistMap = {};
            therapists.forEach(function(t) { therapistMap[t.therapistId] = t.firstName + ' ' + t.lastName; });

            // Latest feedback per client
            var fbMap = {};
            feedbacks.forEach(function(fb) {
                if (!fbMap[fb.clientId] || fb.feedbackDate > fbMap[fb.clientId].feedbackDate) {
                    fbMap[fb.clientId] = fb;
                }
            });

            // Latest report per client
            var rptMap = {};
            reports.forEach(function(rpt) {
                if (!rptMap[rpt.clientId] || rpt.sessionDate > rptMap[rpt.clientId].sessionDate) {
                    rptMap[rpt.clientId] = rpt;
                }
            });

            // Swap count per client
            var swapCount = {};
            swaps.forEach(function(s) { swapCount[s.clientId] = (swapCount[s.clientId] || 0) + 1; });

            // Build rows
            self._rows = clients.map(function(c) {
                var fb = fbMap[c.clientId];
                var rpt = rptMap[c.clientId];
                return {
                    clientId:           c.clientId,
                    clientName:         (c.firstName || '') + ' ' + (c.lastName || ''),
                    therapistName:      therapistMap[c.therapistId] || '—',
                    lastFeedbackDate:   fb ? fb.feedbackDate : 0,
                    lastFeedbackStatus: fb ? fb.status : 0,
                    lastSessionDate:    rpt ? rpt.sessionDate : 0,
                    lastSessionStatus:  rpt ? rpt.status : 0,
                    overrideStatus:     c.overrideStatus || 0,
                    swapCount:          swapCount[c.clientId] || 0,
                    _client:            c
                };
            });

            self._render();
        },

        _render: function() {
            var self = this;
            if (!self._container || self._rows.length === 0) {
                if (self._container) self._container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--layer8d-text-muted);">No active clients found.</div>';
                return;
            }

            var html = '<div style="margin-bottom:12px;display:flex;justify-content:flex-end;">' +
                '<button class="htdash-refresh-btn layer8d-btn layer8d-btn-secondary layer8d-btn-small">Refresh</button></div>';

            html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
            html += '<thead><tr style="background:var(--layer8d-bg-light);">' +
                '<th style="padding:8px 10px;text-align:left;">Client</th>' +
                '<th style="padding:8px 10px;text-align:left;">Therapist</th>' +
                '<th style="padding:8px 10px;text-align:left;">Last Feedback</th>' +
                '<th style="padding:8px 10px;text-align:left;">Feedback</th>' +
                '<th style="padding:8px 10px;text-align:left;">Last Session</th>' +
                '<th style="padding:8px 10px;text-align:left;">Session</th>' +
                '<th style="padding:8px 10px;text-align:left;">Override</th>' +
                '<th style="padding:8px 10px;text-align:left;">Swaps</th>' +
                '</tr></thead><tbody>';

            self._rows.forEach(function(row, idx) {
                html += '<tr class="htdash-row" data-idx="' + idx + '" style="border-bottom:1px solid var(--layer8d-border);cursor:pointer;">' +
                    '<td style="padding:8px 10px;">' + Layer8DUtils.escapeHtml(row.clientName) + '</td>' +
                    '<td style="padding:8px 10px;">' + Layer8DUtils.escapeHtml(row.therapistName) + '</td>' +
                    '<td style="padding:8px 10px;">' + (row.lastFeedbackDate ? Layer8DUtils.formatDate(row.lastFeedbackDate) : '—') + '</td>' +
                    '<td style="padding:8px 10px;">' + _statusDot(row.lastFeedbackStatus) + '</td>' +
                    '<td style="padding:8px 10px;">' + (row.lastSessionDate ? Layer8DUtils.formatDate(row.lastSessionDate) : '—') + '</td>' +
                    '<td style="padding:8px 10px;">' + _statusDot(row.lastSessionStatus) + '</td>' +
                    '<td style="padding:8px 10px;">' + _statusDot(row.overrideStatus) + '</td>' +
                    '<td style="padding:8px 10px;">' + (row.swapCount || 0) + '</td>' +
                    '</tr>';
            });

            html += '</tbody></table>';
            self._container.innerHTML = html;

            // Refresh button
            self._container.querySelector('.htdash-refresh-btn').addEventListener('click', function() {
                self._loadData();
            });

            // Row click → detail popup
            self._container.querySelectorAll('.htdash-row').forEach(function(tr) {
                tr.addEventListener('click', function() {
                    var idx = parseInt(tr.dataset.idx, 10);
                    var row = self._rows[idx];
                    if (row) _showDashboardDetail(row);
                });
            });
        }
    };
})();
