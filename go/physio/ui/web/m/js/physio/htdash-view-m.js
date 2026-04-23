// Mobile Head Therapist Dashboard — card-based view with detail popup
// Uses shared PhysioDashTimeline.fetchEntries/buildEntries for timeline data
(function() {
    'use strict';

    var STATUS_LABELS = { 0: '\u2014', 1: 'Green', 2: 'Yellow', 3: 'Red' };
    var STATUS_COLORS = { 1: 'var(--layer8d-success, #22c55e)', 2: 'var(--layer8d-warning, #f59e0b)', 3: 'var(--layer8d-error, #ef4444)' };
    var STATUS_OPTS = { 0: '\u2014 Clear \u2014', 1: 'Green', 2: 'Yellow', 3: 'Red' };

    function _apiPrefix() { return Layer8DConfig.getApiPrefix(); }

    function _authFetch(url, opts) {
        var headers = (typeof Layer8MAuth !== 'undefined') ?
            Layer8MAuth.getAuthHeaders() :
            (typeof getAuthHeaders === 'function' ? getAuthHeaders() : {});
        opts = opts || {};
        opts.headers = Object.assign({}, headers, opts.headers || {});
        return fetch(url, opts);
    }

    // ── Detail popup ──────────────────────────────────────────────────
    function _showDetail(item, onRefresh) {
        if (!item) return;
        var clientId = item.clientId;
        var render = (window.PhysioManagement || {}).render || {};
        var currentOverride = item.overrideStatus || 0;

        // Overview tab
        var overrideHtml = '<select id="htdash-m-override-sel" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--layer8d-border);font-size:14px;">';
        Object.keys(STATUS_OPTS).forEach(function(k) {
            overrideHtml += '<option value="' + k + '"' + (parseInt(k) === currentOverride ? ' selected' : '') + '>' + STATUS_OPTS[k] + '</option>';
        });
        overrideHtml += '</select>';

        var fb = render.sessionStatus ? render.sessionStatus(item.lastFeedbackStatus) : (STATUS_LABELS[item.lastFeedbackStatus] || '');
        var sess = render.sessionStatus ? render.sessionStatus(item.lastSessionStatus) : (STATUS_LABELS[item.lastSessionStatus] || '');

        var overviewHtml = '<div style="padding:4px 0;">' +
            _field('Client', item.clientName) +
            _field('Therapist', item.therapistName) +
            _fieldHtml('Last Feedback', (item.lastFeedbackDate ? Layer8DUtils.formatDate(item.lastFeedbackDate) : '\u2014') + ' ' + fb) +
            _fieldHtml('Last Session', (item.lastSessionDate ? Layer8DUtils.formatDate(item.lastSessionDate) : '\u2014') + ' ' + sess) +
            _field('Reason', item.statusReason || 'None') +
            _field('Swaps', String(item.swapCount || 0)) +
            '<div style="border-top:1px solid var(--layer8d-border);margin-top:12px;padding-top:12px;">' +
            '<div style="margin-bottom:8px;font-weight:600;font-size:13px;">Override Status</div>' +
            '<input type="text" id="htdash-m-override-reason" placeholder="Reason (required)" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--layer8d-border);font-size:14px;margin-bottom:8px;">' +
            overrideHtml +
            '<button id="htdash-m-save-override" style="margin-top:10px;width:100%;padding:10px;border:none;border-radius:6px;background:var(--layer8d-primary);color:#fff;font-size:14px;font-weight:600;cursor:pointer;">Save Override</button>' +
            '</div></div>';

        var timelineId = 'htdash-m-timeline';
        var planId = 'htdash-m-plan';
        var swapId = 'htdash-m-swaps';

        Layer8MPopup.show({
            title: item.clientName || 'Client Dashboard',
            size: 'full',
            showFooter: false,
            tabs: [
                { id: 'overview', label: 'Overview', content: overviewHtml },
                { id: 'plan', label: 'Workout Plan', content: '<div id="' + planId + '" style="min-height:150px;"></div>' },
                { id: 'timeline', label: 'Timeline', content: '<div id="' + timelineId + '" style="min-height:150px;"></div>' },
                { id: 'swaps', label: 'Exercise Changes', content: '<div id="' + swapId + '" style="min-height:150px;"></div>' }
            ],
            onShow: function(popup) {
                var body = popup && popup.body ? popup.body : popup;
                if (!body) return;

                // Override save
                var saveBtn = body.querySelector('#htdash-m-save-override');
                if (saveBtn) {
                    saveBtn.addEventListener('click', function() {
                        var sel = body.querySelector('#htdash-m-override-sel');
                        var reasonInput = body.querySelector('#htdash-m-override-reason');
                        var newStatus = sel ? parseInt(sel.value, 10) : 0;
                        var reason = reasonInput ? reasonInput.value.trim() : '';
                        if (!reason) {
                            if (typeof Layer8MUtils !== 'undefined') Layer8MUtils.showError('Please enter a reason');
                            if (reasonInput) reasonInput.focus();
                            return;
                        }
                        _saveOverride(clientId, currentOverride, newStatus, reason, function() {
                            currentOverride = newStatus;
                            if (reasonInput) reasonInput.value = '';
                            if (onRefresh) onRefresh();
                        });
                    });
                }
            },
            onTabChange: function(tabId, popup) {
                var body = popup && popup.body ? popup.body : popup;
                if (!body) return;
                if (tabId === 'plan' && window.MobilePlanRenderer) {
                    var pc = body.querySelector('#' + planId);
                    if (pc && !pc._loaded) { pc._loaded = true; MobilePlanRenderer.render(pc, clientId); }
                }
                if (tabId === 'timeline') {
                    _loadTimeline(body.querySelector('#' + timelineId), clientId);
                }
                if (tabId === 'swaps') {
                    var sc = body.querySelector('#' + swapId);
                    if (sc && !sc._loaded) { sc._loaded = true; _loadSwapTable(sc, clientId); }
                }
            }
        });
    }

    function _field(label, value) {
        return '<div style="margin-bottom:10px;font-size:14px;"><strong>' + Layer8DUtils.escapeHtml(label) + ':</strong> ' + Layer8DUtils.escapeHtml(value || '') + '</div>';
    }
    function _fieldHtml(label, html) {
        return '<div style="margin-bottom:10px;font-size:14px;"><strong>' + Layer8DUtils.escapeHtml(label) + ':</strong> ' + html + '</div>';
    }

    // ── Timeline rendering (reuses shared buildEntries) ───────────────
    function _loadTimeline(container, clientId) {
        if (!container) return;
        container.innerHTML = '<div style="padding:12px;color:var(--layer8d-text-muted);">Loading timeline\u2026</div>';
        if (!window.PhysioDashTimeline || !PhysioDashTimeline.fetchEntries) return;
        PhysioDashTimeline.fetchEntries(clientId, function(err, entries) {
            if (err) {
                container.innerHTML = '<div style="padding:12px;color:var(--layer8d-error);">' + Layer8DUtils.escapeHtml(err.message) + '</div>';
                return;
            }
            if (entries.length === 0) {
                container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--layer8d-text-muted);">No history found.</div>';
                return;
            }
            var html = '<div style="padding:4px 0;">';
            entries.forEach(function(entry) {
                var color = STATUS_COLORS[entry.status] || 'var(--layer8d-text-muted)';
                var dateStr = entry.date ? Layer8DUtils.formatDateTime(entry.date) : '\u2014';
                var icon = entry.type === 'feedback' ? '\uD83D\uDCDD' : entry.type === 'session' ? '\uD83E\uDE7A' : '\u2699\uFE0F';
                var userTag = entry.user ? ' <span style="font-size:11px;color:var(--layer8d-text-muted);">by ' + Layer8DUtils.escapeHtml(entry.user) + '</span>' : '';
                html += '<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--layer8d-border);">' +
                    '<div style="width:4px;border-radius:2px;background:' + color + ';flex-shrink:0;"></div>' +
                    '<div style="flex:1;min-width:0;">' +
                    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">' +
                    '<span style="font-weight:600;font-size:13px;">' + icon + ' ' + Layer8DUtils.escapeHtml(entry.label) + userTag + '</span>' +
                    '<span style="font-size:11px;color:var(--layer8d-text-muted);">' + dateStr + '</span>' +
                    '</div>' +
                    (entry.details ? '<div style="font-size:12px;color:var(--layer8d-text-medium);line-height:1.4;">' + Layer8DUtils.escapeHtml(entry.details) + '</div>' : '') +
                    '</div></div>';
            });
            html += '</div>';
            container.innerHTML = html;
        });
    }

    // ── Swap log table ────────────────────────────────────────────────
    function _loadSwapTable(container, clientId) {
        if (!container || typeof Layer8MEditTable === 'undefined') return;
        container.innerHTML = '';
        var cols = (PhysioManagement.columns || {}).ExerciseSwapLog || [];
        var divId = 'htdash-m-swap-tbl-' + Date.now();
        container.innerHTML = '<div id="' + divId + '"></div>';
        var table = new Layer8MEditTable(divId, {
            endpoint: Layer8DConfig.resolveEndpoint('/50/ExSwapLog'),
            modelName: 'ExerciseSwapLog',
            columns: cols,
            rowsPerPage: 15,
            getItemId: function(item) { return item.swapId; },
            baseWhereClause: 'clientId=' + clientId
        });
    }

    // ── Override save ─────────────────────────────────────────────────
    function _saveOverride(clientId, fromStatus, toStatus, reason, onSuccess) {
        var prefix = _apiPrefix();
        _authFetch(prefix + '/50/OvrdLog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientId: clientId,
                changedBy: sessionStorage.getItem('currentUser') || '',
                fromStatus: fromStatus,
                toStatus: toStatus,
                changeDate: Math.floor(Date.now() / 1000),
                reason: reason
            })
        }).catch(function(err) { console.warn('Failed to log override:', err); });

        var query = encodeURIComponent(JSON.stringify({ text: 'select * from PhysioClient where clientId=' + clientId }));
        _authFetch(prefix + '/50/PhyClient?body=' + query, { method: 'GET' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var client = (data.list || [])[0];
            if (!client) return;
            client.overrideStatus = toStatus;
            return _authFetch(prefix + '/50/PhyClient', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(client)
            });
        })
        .then(function(r) {
            if (r && r.ok) {
                if (typeof Layer8MUtils !== 'undefined') Layer8MUtils.showSuccess('Override updated');
                if (onSuccess) onSuccess();
            }
        })
        .catch(function(err) {
            if (typeof Layer8MUtils !== 'undefined') Layer8MUtils.showError('Error: ' + err.message);
        });
    }

    // ── Public API (called from nav config onRowClick) ────────────────
    window.MobilePhysioDashboard = {
        showDetail: _showDetail
    };
})();
