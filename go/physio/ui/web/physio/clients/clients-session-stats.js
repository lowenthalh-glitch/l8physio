(function() {
    'use strict';

    var STATUS_LABELS = { 1: 'Green', 2: 'Yellow', 3: 'Red' };

    function _apiPrefix() { return Layer8DConfig.getApiPrefix(); }
    function _headers() { return getAuthHeaders(); }

    function _fetch(url) {
        return fetch(url, { method: 'GET', headers: _headers() }).then(function(r) { return r.json(); });
    }

    function _statusIcon(status) {
        if (status === 1) return '<svg viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 10l3 3 5-5" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>';
        if (status === 2) return '<svg viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 6v5M10 13v1" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>';
        if (status === 3) return '<svg viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>';
        return '';
    }

    function _kpiIcon(type) {
        var icons = {
            sessions: '<svg viewBox="0 0 20 20" width="20" height="20"><rect x="3" y="4" width="14" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3 8h14" stroke="currentColor" stroke-width="1.5"/></svg>',
            pain:     '<svg viewBox="0 0 20 20" width="20" height="20"><path d="M10 3v14M5 8l5-5 5 5" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>',
            adjust:   '<svg viewBox="0 0 20 20" width="20" height="20"><path d="M4 10h12M10 4v12" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>',
            followup: '<svg viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 6v4l3 2" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>'
        };
        return icons[type] || '';
    }

    window.PhysioClientSessionStats = {

        init: function(container, client) {
            var self = this;
            if (!container || !client) return;

            container.innerHTML = '<div class="physio-exercises-loading">Loading statistics\u2026</div>';

            var query = encodeURIComponent(JSON.stringify({
                text: 'select * from SessionReport where clientId=' + client.clientId + ' limit 200'
            }));
            _fetch(_apiPrefix() + '/50/SessRpt?body=' + query)
            .then(function(data) {
                var reports = (data.list || []).sort(function(a, b) {
                    return (a.sessionDate || 0) - (b.sessionDate || 0);
                });
                if (reports.length === 0) {
                    container.innerHTML = '<div class="physio-no-protocol">No session reports yet for this client.</div>';
                    return;
                }
                self._render(container, reports);
            })
            .catch(function(err) {
                container.innerHTML = '<div class="physio-no-protocol">Failed to load statistics: ' + Layer8DUtils.escapeHtml(err.message) + '</div>';
            });
        },

        _render: function(container, reports) {
            var total = reports.length;
            var latest = reports[reports.length - 1];
            var avgPainBefore = reports.reduce(function(s, r) { return s + (r.painBefore || 0); }, 0) / total;
            var avgPainAfter  = reports.reduce(function(s, r) { return s + (r.painAfter  || 0); }, 0) / total;
            var adjustments   = reports.filter(function(r) { return r.adjustmentMade; }).length;
            var followups     = reports.filter(function(r) { return r.followupRequired; }).length;

            // KPI cards
            var kpiHtml = '<div class="physio-stats-grid">';
            kpiHtml += Layer8DWidget.render({ label: 'Total Sessions', iconSvg: _kpiIcon('sessions') }, total, {});
            kpiHtml += Layer8DWidget.render({ label: 'Current Status', iconSvg: _statusIcon(latest.status) }, STATUS_LABELS[latest.status] || '\u2014', {});
            kpiHtml += Layer8DWidget.render({ label: 'Avg Pain Before', iconSvg: _kpiIcon('pain') }, avgPainBefore.toFixed(1), {});
            kpiHtml += Layer8DWidget.render({ label: 'Avg Pain After', iconSvg: _kpiIcon('pain') }, avgPainAfter.toFixed(1), {});
            kpiHtml += Layer8DWidget.render({ label: 'Adjustments', iconSvg: _kpiIcon('adjust') }, adjustments, {});
            kpiHtml += Layer8DWidget.render({ label: 'Follow-ups Pending', iconSvg: _kpiIcon('followup') }, followups, {});
            kpiHtml += '</div>';

            // Chart containers
            var chartsHtml = '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:16px;">' +
                '<div style="flex:2;min-width:300px;"><div class="physio-stats-chart-title">Pain Trend</div><div id="physio-stats-pain-chart" style="height:250px;"></div></div>' +
                '<div style="flex:1;min-width:200px;"><div class="physio-stats-chart-title">Status Distribution</div><div id="physio-stats-status-chart" style="height:250px;"></div></div>' +
                '</div>';

            container.innerHTML = kpiHtml + chartsHtml;

            this._renderPainChart(reports);
            this._renderStatusChart(reports);
        },

        _renderPainChart: function(reports) {
            var painData = reports.map(function(r) {
                return {
                    label: Layer8DUtils.formatDate(r.sessionDate),
                    value: r.painBefore || 0,
                    painDuring: r.painDuring || 0,
                    painAfter: r.painAfter || 0
                };
            });

            try {
                var chart = new Layer8DChart({
                    containerId: 'physio-stats-pain-chart',
                    columns: [],
                    viewConfig: {
                        chartType: 'line',
                        title: '',
                        categoryField: 'label',
                        valueField: 'value'
                    }
                });
                chart.init();
                chart.setData(painData, painData.length);
            } catch (e) {
                console.warn('[session-stats] Pain chart error:', e);
            }
        },

        _renderStatusChart: function(reports) {
            var green  = Layer8DChart.readThemeColor('--layer8d-success', '#22c55e');
            var yellow = Layer8DChart.readThemeColor('--layer8d-warning', '#f59e0b');
            var red    = Layer8DChart.readThemeColor('--layer8d-error',   '#ef4444');

            var greenCount  = reports.filter(function(r) { return r.status === 1; }).length;
            var yellowCount = reports.filter(function(r) { return r.status === 2; }).length;
            var redCount    = reports.filter(function(r) { return r.status === 3; }).length;

            var statusData = [];
            if (greenCount > 0)  statusData.push({ label: 'Green',  value: greenCount });
            if (yellowCount > 0) statusData.push({ label: 'Yellow', value: yellowCount });
            if (redCount > 0)    statusData.push({ label: 'Red',    value: redCount });

            if (statusData.length === 0) return;

            try {
                var chart = new Layer8DChart({
                    containerId: 'physio-stats-status-chart',
                    columns: [],
                    viewConfig: {
                        chartType: 'pie',
                        title: '',
                        categoryField: 'label',
                        valueField: 'value',
                        colors: [green, yellow, red]
                    }
                });
                chart.init();
                chart.setData(statusData, statusData.length);
            } catch (e) {
                console.warn('[session-stats] Status chart error:', e);
            }
        }
    };
})();
