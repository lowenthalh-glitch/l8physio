// PhysioHeadDashboard — custom dashboard view with refresh, sort, filter
(function() {
    'use strict';

    var render = null;
    function _getRenderer() {
        if (!render && window.PhysioManagement) render = PhysioManagement.render;
        return render || {};
    }

    function _fetchDashboard() {
        var query = encodeURIComponent(JSON.stringify({ text: 'select * from HeadThDashRow' }));
        var url = Layer8DConfig.resolveEndpoint('/50/HTDash') + '?body=' + query + '&_t=' + Date.now();
        return fetch(url, { method: 'GET', headers: getAuthHeaders() }).then(function(r) { return r.json(); });
    }

    var STATUS_LABELS = { 0: '\u2014', 1: 'Green', 2: 'Yellow', 3: 'Red' };

    // Column definitions: key, label, type (text/date/status/number)
    var COLUMNS = [
        { key: 'clientName',         label: 'Client',        type: 'text' },
        { key: 'therapistName',      label: 'Therapist',     type: 'text' },
        { key: 'lastFeedbackDate',   label: 'Last Feedback', type: 'date' },
        { key: 'lastFeedbackStatus', label: 'Feedback',      type: 'status' },
        { key: 'lastSessionDate',    label: 'Last Session',  type: 'date' },
        { key: 'lastSessionStatus',  label: 'Session',       type: 'status' },
        { key: 'overrideStatus',     label: 'Override',      type: 'status' },
        { key: 'swapCount',          label: 'Swaps',         type: 'number' },
        { key: 'statusReason',       label: 'Reason',        type: 'text' }
    ];

    window.PhysioHeadDashboard = {
        _container: null,
        _rows: [],
        _sortKey: null,
        _sortAsc: true,
        _filters: {},

        init: function(containerId) {
            var self = this;
            var el = document.getElementById(containerId);
            if (!el) return;
            self._container = el;
            // Default sort: override ascending (none first, overridden at bottom),
            // then session descending (RED first), then feedback descending (RED first)
            self._sortKeys = [
                { key: 'overrideStatus', asc: true },
                { key: 'lastSessionStatus', asc: false },
                { key: 'lastFeedbackStatus', asc: false }
            ];
            self._filters = {};
            el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--layer8d-text-muted);">Loading dashboard\u2026</div>';
            self.refresh();
        },

        refresh: function() {
            var self = this;
            if (!self._container) return;
            _fetchDashboard().then(function(data) {
                self._rows = data.list || [];
                self._render();
            }).catch(function(err) {
                if (self._container) {
                    self._container.innerHTML = '<div style="padding:20px;color:var(--layer8d-error);">Failed to load: ' + Layer8DUtils.escapeHtml(err.message) + '</div>';
                }
            });
        },

        destroy: function() {
            this._container = null;
            this._rows = [];
        },

        _getFilteredSortedRows: function() {
            var self = this;
            var rows = self._rows.slice();

            // Filter
            Object.keys(self._filters).forEach(function(key) {
                var val = self._filters[key].toLowerCase();
                if (!val) return;
                var col = COLUMNS.filter(function(c) { return c.key === key; })[0];
                rows = rows.filter(function(row) {
                    if (col && col.type === 'status') {
                        return (STATUS_LABELS[row[key]] || '').toLowerCase().indexOf(val) !== -1;
                    }
                    if (col && col.type === 'date') {
                        return row[key] ? Layer8DUtils.formatDate(row[key]).indexOf(val) !== -1 : false;
                    }
                    return String(row[key] || '').toLowerCase().indexOf(val) !== -1;
                });
            });

            // Multi-column sort
            if (self._sortKeys.length > 0) {
                rows.sort(function(a, b) {
                    for (var s = 0; s < self._sortKeys.length; s++) {
                        var sk = self._sortKeys[s];
                        var col = COLUMNS.filter(function(c) { return c.key === sk.key; })[0];
                        var va = a[sk.key], vb = b[sk.key];
                        if (col && (col.type === 'status' || col.type === 'number' || col.type === 'date')) { va = va || 0; vb = vb || 0; }
                        if (typeof va === 'string') va = va.toLowerCase();
                        if (typeof vb === 'string') vb = vb.toLowerCase();
                        if (va < vb) return sk.asc ? -1 : 1;
                        if (va > vb) return sk.asc ? 1 : -1;
                    }
                    return 0;
                });
            }

            return rows;
        },

        _render: function() {
            var self = this;
            var r = _getRenderer();
            if (!self._container) return;

            if (self._rows.length === 0) {
                self._container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--layer8d-text-muted);">No active clients found.</div>';
                return;
            }

            var filtered = self._getFilteredSortedRows();
            var thStyle = 'padding:8px 10px;text-align:left;cursor:pointer;user-select:none;';
            var filterStyle = 'width:100%;padding:4px 6px;border:1px solid var(--layer8d-border);border-radius:3px;font-size:12px;';

            var html = '<div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">' +
                '<span style="color:var(--layer8d-text-muted);font-size:12px;">' + filtered.length + ' of ' + self._rows.length + ' clients</span>' +
                '<button class="htdash-refresh-btn layer8d-btn layer8d-btn-secondary layer8d-btn-small">Refresh</button></div>';

            html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';

            // Header row with sort indicators
            html += '<thead><tr style="background:var(--layer8d-bg-light);">';
            COLUMNS.forEach(function(col) {
                var arrow = '';
                for (var si = 0; si < self._sortKeys.length; si++) {
                    if (self._sortKeys[si].key === col.key) {
                        arrow = self._sortKeys[si].asc ? ' \u25b2' : ' \u25bc';
                        if (self._sortKeys.length > 1) arrow += '<span style="font-size:10px;color:var(--layer8d-text-muted);">' + (si + 1) + '</span>';
                        break;
                    }
                }
                html += '<th class="htdash-sort" data-sort="' + col.key + '" style="' + thStyle + '">' + col.label + arrow + '</th>';
            });
            html += '</tr>';

            // Filter row
            html += '<tr style="background:var(--layer8d-bg-white);">';
            COLUMNS.forEach(function(col) {
                var val = self._filters[col.key] || '';
                html += '<th style="padding:4px 6px;"><input class="htdash-filter" data-key="' + col.key + '" value="' + Layer8DUtils.escapeHtml(val) + '" placeholder="Filter..." style="' + filterStyle + '"></th>';
            });
            html += '</tr></thead><tbody>';

            // Data rows
            filtered.forEach(function(row, idx) {
                var origIdx = self._rows.indexOf(row);
                var fbStatus = r.sessionStatus ? r.sessionStatus(row.lastFeedbackStatus) : (row.lastFeedbackStatus || '');
                var sessStatus = r.sessionStatus ? r.sessionStatus(row.lastSessionStatus) : (row.lastSessionStatus || '');
                var ovrdStatus = r.sessionStatus ? r.sessionStatus(row.overrideStatus) : (row.overrideStatus || '');

                html += '<tr class="htdash-row" data-idx="' + origIdx + '" style="border-bottom:1px solid var(--layer8d-border);cursor:pointer;">' +
                    '<td style="padding:8px 10px;color:var(--layer8d-text-dark);">' + Layer8DUtils.escapeHtml(row.clientName || '') + '</td>' +
                    '<td style="padding:8px 10px;color:var(--layer8d-text-medium);">' + Layer8DUtils.escapeHtml(row.therapistName || '') + '</td>' +
                    '<td style="padding:8px 10px;color:var(--layer8d-text-medium);">' + (row.lastFeedbackDate ? Layer8DUtils.formatDate(row.lastFeedbackDate) : '\u2014') + '</td>' +
                    '<td style="padding:8px 10px;">' + fbStatus + '</td>' +
                    '<td style="padding:8px 10px;color:var(--layer8d-text-medium);">' + (row.lastSessionDate ? Layer8DUtils.formatDate(row.lastSessionDate) : '\u2014') + '</td>' +
                    '<td style="padding:8px 10px;">' + sessStatus + '</td>' +
                    '<td style="padding:8px 10px;">' + ovrdStatus + '</td>' +
                    '<td style="padding:8px 10px;color:var(--layer8d-text-medium);">' + (row.swapCount || 0) + '</td>' +
                    '<td style="padding:8px 10px;color:var(--layer8d-text-muted);font-size:12px;">' + Layer8DUtils.escapeHtml(row.statusReason || '') + '</td>' +
                    '</tr>';
            });

            html += '</tbody></table>';
            self._container.innerHTML = html;

            // Wire events
            self._container.querySelector('.htdash-refresh-btn').addEventListener('click', function() { self.refresh(); });

            // Sort on header click — shift+click adds secondary sort
            self._container.querySelectorAll('.htdash-sort').forEach(function(th) {
                th.addEventListener('click', function(e) {
                    var key = th.dataset.sort;
                    var existing = -1;
                    for (var i = 0; i < self._sortKeys.length; i++) {
                        if (self._sortKeys[i].key === key) { existing = i; break; }
                    }

                    if (e.shiftKey) {
                        // Shift+click: add/toggle secondary sort
                        if (existing !== -1) {
                            self._sortKeys[existing].asc = !self._sortKeys[existing].asc;
                        } else {
                            self._sortKeys.push({ key: key, asc: true });
                        }
                    } else {
                        // Normal click: single column sort or toggle
                        if (existing !== -1 && self._sortKeys.length === 1) {
                            self._sortKeys[0].asc = !self._sortKeys[0].asc;
                        } else {
                            self._sortKeys = [{ key: key, asc: true }];
                        }
                    }
                    self._render();
                });
            });

            // Filter on input
            self._container.querySelectorAll('.htdash-filter').forEach(function(input) {
                input.addEventListener('input', function() {
                    self._filters[input.dataset.key] = input.value;
                    self._render();
                    // Restore focus to the same filter input after re-render
                    var restored = self._container.querySelector('.htdash-filter[data-key="' + input.dataset.key + '"]');
                    if (restored) {
                        restored.focus();
                        restored.setSelectionRange(restored.value.length, restored.value.length);
                    }
                });
            });

            // Row click
            self._container.querySelectorAll('.htdash-row').forEach(function(tr) {
                tr.addEventListener('click', function() {
                    var idx = parseInt(tr.dataset.idx, 10);
                    var row = self._rows[idx];
                    if (row && typeof _showDashboardDetail === 'function') {
                        _showDashboardDetail(row, function() { self.refresh(); });
                    }
                });
            });
        }
    };
})();
