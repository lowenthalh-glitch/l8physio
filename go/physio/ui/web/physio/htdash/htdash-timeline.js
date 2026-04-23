// PhysioDashTimeline — renders chronological timeline of feedback, session reports, and overrides
(function() {
    'use strict';

    function _apiPrefix() { return Layer8DConfig.getApiPrefix(); }
    function _headers() {
        if (typeof getAuthHeaders === 'function') return getAuthHeaders();
        var token = (typeof Layer8MAuth !== 'undefined') ? Layer8MAuth.getBearerToken()
                  : sessionStorage.getItem('bearerToken');
        return { 'Authorization': token ? 'Bearer ' + token : '', 'Content-Type': 'application/json' };
    }
    function _query(endpoint, queryText) {
        var body = encodeURIComponent(JSON.stringify({ text: queryText }));
        return fetch(_apiPrefix() + endpoint + '?body=' + body, { method: 'GET', headers: _headers() }).then(function(r) { return r.json(); });
    }

    var STATUS_LABELS = { 0: 'Unspecified', 1: 'Green', 2: 'Yellow', 3: 'Red' };
    var STATUS_COLORS = { 1: 'var(--layer8d-success, #22c55e)', 2: 'var(--layer8d-warning, #f59e0b)', 3: 'var(--layer8d-error, #ef4444)' };

    // Build timeline entries from raw data arrays (platform-agnostic, no DOM).
    // Returns [{date, type, label, status, user, details}, ...] sorted newest first, deduplicated.
    function _buildEntries(feedbacks, reports, overrides, swaps, exercises) {
        var entries = [];
        var exMap = {};
        (exercises || []).forEach(function(ex) { exMap[ex.exerciseId] = ex.name || ex.exerciseId; });

        (feedbacks || []).forEach(function(fb) {
            var details = [];
            var TRAINING = { 1: 'Easy, needs adjustment', 2: 'Okay, needs adjustment', 3: 'Perfect', 4: 'Too difficult' };
            if (fb.difficulty) details.push('Training: ' + (TRAINING[fb.difficulty] || fb.difficulty));
            if (fb.painDuring > 0) details.push('Pain during: ' + fb.painDuring + '/5');
            if (fb.painAfter > 0) details.push('Pain after: ' + fb.painAfter + '/5');
            if (fb.painBefore > 0) details.push('Sleep: ' + fb.painBefore + '/5');
            if (fb.compliance > 0) details.push('Nutrition: ' + fb.compliance + '/5');
            if (fb.mood > 0) details.push('Stress: ' + fb.mood + '/5');
            entries.push({ date: fb.feedbackDate || 0, type: 'feedback', label: 'Client Feedback', status: fb.status || 0, user: '', details: details.join(' \u2022 ') });
        });

        (reports || []).forEach(function(rpt) {
            var details = [];
            if (rpt.painBefore > 0) details.push('Pain before: ' + rpt.painBefore + '/10');
            if (rpt.painDuring > 0) details.push('Pain during: ' + rpt.painDuring + '/10');
            if (rpt.painAfter > 0) details.push('Pain after: ' + rpt.painAfter + '/10');
            if (rpt.adjustmentMade) details.push('Adjustment: ' + (rpt.adjustmentDetails || 'yes'));
            if (rpt.hadDifficulty) details.push('Difficulty reported');
            if (rpt.followupRequired) details.push('Follow-up required');
            if (rpt.notes) details.push(rpt.notes);
            entries.push({ date: rpt.sessionDate || 0, type: 'session', label: 'Therapist Report', status: rpt.status || 0, user: rpt.therapistId || '', details: details.join(' \u2022 ') });
        });

        (overrides || []).forEach(function(ovrd) {
            var from = STATUS_LABELS[ovrd.fromStatus] || 'Unknown';
            var to = STATUS_LABELS[ovrd.toStatus] || 'Unknown';
            entries.push({ date: ovrd.changeDate || 0, type: 'override', label: 'Override', status: ovrd.toStatus || 0, user: ovrd.changedBy || '', details: from + ' \u2192 ' + to + (ovrd.reason ? ' \u2014 ' + ovrd.reason : '') });
        });

        (swaps || []).forEach(function(swap) {
            var DIR = { 1: 'Progression', 2: 'Regression' };
            var dir = DIR[swap.direction] || 'Plan Edit';
            var details = swap.description || ((exMap[swap.oldExerciseId] || swap.oldExerciseId || '') + ' \u2192 ' + (exMap[swap.newExerciseId] || swap.newExerciseId || ''));
            entries.push({ date: swap.swapDate || 0, type: 'swap', label: 'Exercise ' + dir, status: 2, user: swap.therapistId || '', details: details });
        });

        entries.sort(function(a, b) { return b.date - a.date; });
        var seen = {};
        return entries.filter(function(e) {
            var key = e.type + '|' + e.date + '|' + e.details;
            if (seen[key]) return false;
            seen[key] = true;
            return true;
        });
    }

    window.PhysioDashTimeline = {
        // Public: build entries from raw data (no DOM, shareable by mobile)
        buildEntries: _buildEntries,

        // Public: fetch data for a client and return entries via callback
        fetchEntries: function(clientId, callback) {
            Promise.all([
                _query('/50/HomeFdbk', 'select * from HomeFeedback where clientId=' + clientId),
                _query('/50/SessRpt', 'select * from SessionReport where clientId=' + clientId),
                _query('/50/OvrdLog', 'select * from StatusOverrideLog where clientId=' + clientId),
                _query('/50/ExSwapLog', 'select * from ExerciseSwapLog where clientId=' + clientId),
                _query('/50/PhyExercis', 'select * from PhysioExercise limit 500')
            ]).then(function(results) {
                var entries = _buildEntries(
                    results[0].list, results[1].list, results[2].list, results[3].list, results[4].list
                );
                callback(null, entries);
            }).catch(function(err) { callback(err, []); });
        },

        // Desktop render: fetch + render into container
        render: function(container, clientId) {
            if (!container) return;
            container.innerHTML = '<div style="padding:12px;color:var(--layer8d-text-muted);">Loading timeline\u2026</div>';
            this.fetchEntries(clientId, function(err, entries) {
                if (err) {
                    container.innerHTML = '<div style="padding:12px;color:var(--layer8d-error);">Failed to load timeline: ' + Layer8DUtils.escapeHtml(err.message) + '</div>';
                    return;
                }
                _renderEntries(container, entries);
            });
        }
    };

    function _renderEntries(container, entries) {
        if (entries.length === 0) {
            container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--layer8d-text-muted);">No history found.</div>';
            return;
        }

        var html = '<div style="padding:4px 0;">';
        entries.forEach(function(entry) {
            var color = STATUS_COLORS[entry.status] || 'var(--layer8d-text-muted)';
            var dateStr = entry.date ? Layer8DUtils.formatDateTime(entry.date) : '\u2014';
            var typeIcon = entry.type === 'feedback' ? '\uD83D\uDCDD' : entry.type === 'session' ? '\uD83E\uDE7A' : '\u2699\uFE0F';

            var userTag = entry.user ? ' <span style="font-size:11px;color:var(--layer8d-text-muted);font-weight:400;">by ' + Layer8DUtils.escapeHtml(entry.user) + '</span>' : '';

            html += '<div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--layer8d-border);">' +
                '<div style="width:4px;border-radius:2px;background:' + color + ';flex-shrink:0;"></div>' +
                '<div style="flex:1;min-width:0;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
                '<span style="font-weight:600;font-size:13px;">' + typeIcon + ' ' + Layer8DUtils.escapeHtml(entry.label) + userTag + '</span>' +
                '<span style="font-size:12px;color:var(--layer8d-text-muted);">' + dateStr + '</span>' +
                '</div>' +
                (entry.details ? '<div style="font-size:12px;color:var(--layer8d-text-medium);line-height:1.5;">' + Layer8DUtils.escapeHtml(entry.details) + '</div>' : '') +
                '</div></div>';
        });
        html += '</div>';
        container.innerHTML = html;
    }
})();
