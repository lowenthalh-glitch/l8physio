// Mobile client popup tab content renderers
// Session Reports, Statistics, Home Feedback, Appointments
(function() {
    'use strict';

    function _api() { return Layer8DConfig.getApiPrefix(); }
    function _get(url) { return Layer8MAuth.get(url); }

    var STATUS_LABELS = { 1: 'Green', 2: 'Yellow', 3: 'Red' };
    var TYPE_MAP = { 1: 'Meeting', 2: 'Class', 3: 'Block' };

    // ── Session Reports ───────────────────────────────────────────────
    window.MobilePhysioReportsTab = {
        render: function(container, client) {
            if (!container) return;
            container.innerHTML = '<div style="padding:12px;color:var(--layer8d-text-muted);">Loading reports\u2026</div>';
            var divId = 'mreports-tbl-' + Date.now();
            var col = window.Layer8ColumnFactory;
            var enums = PhysioManagement.enums;
            var render = PhysioManagement.render;
            var columns = [
                ...col.date('sessionDate', 'Date'),
                ...col.status('status', 'Status', enums.SESSION_STATUS_VALUES, render.sessionStatus),
                ...col.number('painBefore', 'Pain Before'),
                ...col.number('painAfter', 'Pain After'),
                ...col.boolean('followupRequired', 'Follow-up')
            ];
            container.innerHTML = '<div style="margin-bottom:8px;"><button id="madd-report-btn" style="padding:8px 14px;border:none;border-radius:6px;background:var(--layer8d-primary);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">+ Add Report</button></div><div id="' + divId + '"></div>';

            var table = new Layer8MEditTable(divId, {
                endpoint: _api() + '/50/SessRpt',
                modelName: 'SessionReport',
                columns: columns,
                rowsPerPage: 10,
                getItemId: function(item) { return item.reportId; },
                baseWhereClause: 'clientId=' + client.clientId
            });

            container.querySelector('#madd-report-btn').addEventListener('click', function() {
                _openAddReport(client, function() { table.refresh ? table.refresh() : location.reload(); });
            });
        }
    };

    function _openAddReport(client, onSuccess) {
        var formDef = (MobilePhysioManagement.forms || {}).SessionReport;
        if (!formDef) { Layer8MUtils.showError('Form not found'); return; }
        var preData = {
            clientId: client.clientId,
            therapistId: sessionStorage.getItem('currentUser') || '',
            sessionDate: Math.floor(Date.now() / 1000)
        };
        var html = Layer8MForms.renderForm(formDef, preData, false);
        Layer8MPopup.show({
            title: 'Add Session Report', size: 'full', showFooter: true, saveButtonText: 'Save',
            content: html,
            onSave: function(popup) {
                var body = popup && popup.body ? popup.body : popup;
                var data = Layer8MForms.getFormData(body);
                data.clientId = client.clientId;
                data.therapistId = preData.therapistId;
                Layer8MAuth.post(_api() + '/50/SessRpt', data)
                .then(function() { Layer8MPopup.close(); Layer8MUtils.showSuccess('Report saved'); if (onSuccess) onSuccess(); })
                .catch(function(err) { Layer8MUtils.showError('Error: ' + (err.message || err)); });
            },
            onShow: function(popup) {
                var body = popup && popup.body ? popup.body : popup;
                if (typeof Layer8MForms.initFormFields === 'function') Layer8MForms.initFormFields(body);
            }
        });
    }

    // ── Statistics ─────────────────────────────────────────────────────
    window.MobilePhysioStatsTab = {
        render: function(container, client) {
            if (!container) return;
            container.innerHTML = '<div style="padding:12px;color:var(--layer8d-text-muted);">Loading statistics\u2026</div>';
            var query = encodeURIComponent(JSON.stringify({ text: 'select * from SessionReport where clientId=' + client.clientId + ' limit 200' }));
            _get(_api() + '/50/SessRpt?body=' + query)
            .then(function(data) {
                var reports = (data.list || []).sort(function(a, b) { return (a.sessionDate || 0) - (b.sessionDate || 0); });
                if (reports.length === 0) { container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--layer8d-text-muted);">No session reports yet.</div>'; return; }
                _renderStats(container, reports);
            })
            .catch(function(err) { container.innerHTML = '<div style="padding:16px;color:var(--layer8d-error);">' + Layer8DUtils.escapeHtml(err.message || 'Error') + '</div>'; });
        }
    };

    function _renderStats(container, reports) {
        var total = reports.length;
        var latest = reports[total - 1];
        var avgBefore = (reports.reduce(function(s, r) { return s + (r.painBefore || 0); }, 0) / total).toFixed(1);
        var avgAfter = (reports.reduce(function(s, r) { return s + (r.painAfter || 0); }, 0) / total).toFixed(1);
        var adjustments = reports.filter(function(r) { return r.adjustmentMade; }).length;
        var followups = reports.filter(function(r) { return r.followupRequired; }).length;

        var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">';
        html += _kpiCard('Sessions', total);
        html += _kpiCard('Status', STATUS_LABELS[latest.status] || '\u2014');
        html += _kpiCard('Avg Pain Before', avgBefore);
        html += _kpiCard('Avg Pain After', avgAfter);
        html += _kpiCard('Adjustments', adjustments);
        html += _kpiCard('Follow-ups', followups);
        html += '</div>';

        // Chart containers — DEFERRED: rendered after DOM is painted
        var painChartId = 'mstats-pain-' + Date.now();
        var statusChartId = 'mstats-status-' + Date.now();
        html += '<div style="margin-bottom:12px;font-weight:600;font-size:13px;">Pain Trend</div><div id="' + painChartId + '" style="height:200px;"></div>';
        html += '<div style="margin-top:16px;margin-bottom:12px;font-weight:600;font-size:13px;">Status Distribution</div><div id="' + statusChartId + '" style="height:200px;"></div>';
        container.innerHTML = html;

        // Defer chart rendering until container is visible (hidden tab rule)
        setTimeout(function() {
            _renderPainChart(painChartId, reports);
            _renderStatusChart(statusChartId, reports);
        }, 100);
    }

    function _kpiCard(label, value) {
        return '<div style="background:var(--layer8d-bg-white);border:1px solid var(--layer8d-border);border-radius:8px;padding:12px;text-align:center;">' +
            '<div style="font-size:20px;font-weight:700;color:var(--layer8d-text-dark);">' + Layer8DUtils.escapeHtml(String(value)) + '</div>' +
            '<div style="font-size:11px;color:var(--layer8d-text-muted);margin-top:4px;">' + Layer8DUtils.escapeHtml(label) + '</div></div>';
    }

    function _renderPainChart(containerId, reports) {
        var painData = reports.map(function(r) {
            return { label: Layer8DUtils.formatDate(r.sessionDate), value: r.painBefore || 0 };
        });
        try {
            var chart = new Layer8DChart({ containerId: containerId, columns: [], viewConfig: { chartType: 'line', title: '', categoryField: 'label', valueField: 'value' } });
            chart.init(); chart.setData(painData, painData.length);
        } catch (e) { console.warn('[mobile-stats] Pain chart error:', e); }
    }

    function _renderStatusChart(containerId, reports) {
        var green = Layer8DChart.readThemeColor('--layer8d-success', '#22c55e');
        var yellow = Layer8DChart.readThemeColor('--layer8d-warning', '#f59e0b');
        var red = Layer8DChart.readThemeColor('--layer8d-error', '#ef4444');
        var g = reports.filter(function(r) { return r.status === 1; }).length;
        var y = reports.filter(function(r) { return r.status === 2; }).length;
        var r = reports.filter(function(r) { return r.status === 3; }).length;
        var data = [];
        if (g > 0) data.push({ label: 'Green', value: g }); if (y > 0) data.push({ label: 'Yellow', value: y }); if (r > 0) data.push({ label: 'Red', value: r });
        if (data.length === 0) return;
        try {
            var chart = new Layer8DChart({ containerId: containerId, columns: [], viewConfig: { chartType: 'pie', title: '', categoryField: 'label', valueField: 'value', colors: [green, yellow, red] } });
            chart.init(); chart.setData(data, data.length);
        } catch (e) { console.warn('[mobile-stats] Status chart error:', e); }
    }

    // ── Home Feedback ─────────────────────────────────────────────────
    window.MobilePhysioFeedbackTab = {
        render: function(container, client) {
            if (!container) return;
            container.innerHTML = '<div style="padding:12px;color:var(--layer8d-text-muted);">Loading feedback\u2026</div>';
            var divId = 'mfeedback-tbl-' + Date.now();
            var col = window.Layer8ColumnFactory;
            var enums = PhysioManagement.enums;
            var render = PhysioManagement.render;
            var columns = [
                ...col.date('feedbackDate', 'Date'),
                ...col.status('difficulty', 'Training', enums.TRAINING_LEVEL_VALUES, render.trainingLevel),
                ...col.number('painDuring', 'Pain During'),
                ...col.number('painAfter', 'Pain After'),
                ...col.status('status', 'Status', enums.SESSION_STATUS_VALUES, render.sessionStatus)
            ];
            container.innerHTML = '<div style="margin-bottom:8px;"><button id="madd-feedback-btn" style="padding:8px 14px;border:none;border-radius:6px;background:var(--layer8d-primary);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">+ Add Feedback</button></div><div id="' + divId + '"></div>';

            var table = new Layer8MEditTable(divId, {
                endpoint: _api() + '/50/HomeFdbk',
                modelName: 'HomeFeedback',
                columns: columns,
                rowsPerPage: 10,
                getItemId: function(item) { return item.feedbackId; },
                baseWhereClause: 'clientId=' + client.clientId
            });

            container.querySelector('#madd-feedback-btn').addEventListener('click', function() {
                _openAddFeedback(client, function() { table.refresh ? table.refresh() : location.reload(); });
            });
        }
    };

    function _openAddFeedback(client, onSuccess) {
        var formDef = (MobilePhysioManagement.forms || {}).HomeFeedback;
        if (!formDef) { Layer8MUtils.showError('Form not found'); return; }
        var preData = {
            clientId: client.clientId,
            therapistId: sessionStorage.getItem('currentUser') || '',
            feedbackDate: Math.floor(Date.now() / 1000)
        };
        var html = Layer8MForms.renderForm(formDef, preData, false);
        Layer8MPopup.show({
            title: 'Add Home Feedback', size: 'full', showFooter: true, saveButtonText: 'Save',
            content: html,
            onSave: function(popup) {
                var body = popup && popup.body ? popup.body : popup;
                var data = Layer8MForms.getFormData(body);
                data.clientId = client.clientId;
                data.therapistId = preData.therapistId;
                // One-per-day check
                var today = Math.floor(Date.now() / 1000);
                var dayStart = today - (today % 86400);
                var checkQuery = encodeURIComponent(JSON.stringify({ text: 'select * from HomeFeedback where clientId=' + client.clientId }));
                _get(_api() + '/50/HomeFdbk?body=' + checkQuery)
                .then(function(resp) {
                    var existing = (resp.list || []).filter(function(fb) { return fb.feedbackDate >= dayStart && fb.feedbackDate < dayStart + 86400; });
                    if (existing.length > 0) { Layer8MUtils.showError('One feedback per day. Already submitted today.'); return; }
                    return Layer8MAuth.post(_api() + '/50/HomeFdbk', data);
                })
                .then(function(result) { if (result !== undefined) { Layer8MPopup.close(); Layer8MUtils.showSuccess('Feedback saved'); if (onSuccess) onSuccess(); } })
                .catch(function(err) { Layer8MUtils.showError('Error: ' + (err.message || err)); });
            },
            onShow: function(popup) {
                var body = popup && popup.body ? popup.body : popup;
                if (typeof Layer8MForms.initFormFields === 'function') Layer8MForms.initFormFields(body);
            }
        });
    }

    // ── Appointments ──────────────────────────────────────────────────
    window.MobilePhysioAppointmentsTab = {
        render: function(container, client) {
            if (!container) return;
            container.innerHTML = '<div style="padding:12px;color:var(--layer8d-text-muted);">Loading appointments\u2026</div>';
            if (!client.boostappId && !client.clientId) {
                container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--layer8d-text-muted);">No Boostapp ID set on this client.</div>';
                return;
            }
            var query = encodeURIComponent(JSON.stringify({ text: 'select * from BoostappCalendarEvent limit 500' }));
            _get(_api() + '/50/BstpCal?body=' + query)
            .then(function(data) {
                var all = data.list || [];
                var matched = all.filter(function(e) {
                    if (e.physioClientId && e.physioClientId === client.clientId) return true;
                    if (client.boostappId && Array.isArray(e.participants)) {
                        return e.participants.some(function(p) { return p.boostappClientId === client.boostappId; });
                    }
                    return false;
                });
                if (matched.length === 0) { container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--layer8d-text-muted);">No appointments found.</div>'; return; }
                matched.sort(function(a, b) { return (b.startTime || '').localeCompare(a.startTime || ''); });
                var html = '<div style="padding:4px 0;">';
                matched.forEach(function(e) {
                    html += '<div style="border:1px solid var(--layer8d-border);border-radius:8px;padding:10px 12px;margin-bottom:8px;background:var(--layer8d-bg-white);">' +
                        '<div style="font-weight:600;font-size:14px;margin-bottom:4px;">' + Layer8DUtils.escapeHtml(e.title || '') + '</div>' +
                        '<div style="font-size:12px;color:var(--layer8d-text-medium);">' + Layer8DUtils.escapeHtml(e.startTime || '') + ' \u2014 ' + Layer8DUtils.escapeHtml(e.endTime || '') + '</div>' +
                        '<div style="font-size:12px;color:var(--layer8d-text-muted);margin-top:4px;">' +
                        (e.coachName ? 'Coach: ' + Layer8DUtils.escapeHtml(e.coachName) + ' \u2022 ' : '') +
                        (TYPE_MAP[e.eventType] || '') +
                        (e.isCancelled ? ' \u2022 <span style="color:var(--layer8d-error);">Cancelled</span>' : '') +
                        '</div></div>';
                });
                html += '</div>';
                container.innerHTML = html;
            })
            .catch(function(err) { container.innerHTML = '<div style="padding:16px;color:var(--layer8d-error);">' + Layer8DUtils.escapeHtml(err.message || 'Error') + '</div>'; });
        }
    };
})();
