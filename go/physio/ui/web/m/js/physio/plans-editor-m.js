// Mobile Plan Editor — opens when clicking a TreatmentPlan row
// Shows plan details header + MobilePlanRenderer for exercise CRUD
(function() {
    'use strict';

    function _api() { return Layer8DConfig.getApiPrefix(); }
    function _get(url) { return Layer8MAuth.get(url); }

    window.MobilePlanEditor = {
        open: function(item, onRefresh) {
            var planId = item && item.planId;
            if (!planId) return;

            // Fetch full plan
            var q = encodeURIComponent(JSON.stringify({ text: 'select * from TreatmentPlan where planId=' + planId + ' limit 1' }));
            _get(_api() + '/50/PhyPlan?body=' + q)
            .then(function(data) {
                var plan = (data.list || [])[0] || item;
                _showEditor(plan, onRefresh);
            })
            .catch(function(err) { Layer8MUtils.showError('Failed to load plan: ' + (err.message || err)); });
        }
    };

    function _showEditor(plan, onRefresh) {
        var enums = (window.PhysioManagement || {}).enums || {};
        var statusLabel = (enums.PLAN_STATUS || {})[plan.status] || '\u2014';
        var startDate = plan.startDate ? Layer8DUtils.formatDate(plan.startDate) : '\u2014';
        var endDate = plan.endDate ? Layer8DUtils.formatDate(plan.endDate) : '\u2014';

        var protoLabel = plan.protocolId || '\u2014';

        // Notes are staff-only; belt-and-braces on top of the API deny rule.
        var isStaff = sessionStorage.getItem('userPortal') !== 'client-app.html';
        var notesHtml = (isStaff && plan.notes)
            ? '<div style="padding:8px 10px;margin-top:6px;background:var(--layer8d-bg-light);border-left:3px solid var(--layer8d-primary);border-radius:4px;white-space:pre-wrap;font-size:13px;color:var(--layer8d-text-dark);">' +
                '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--layer8d-text-medium);margin-bottom:4px;">Notes</div>' +
                Layer8DUtils.escapeHtml(plan.notes) +
              '</div>'
            : '';

        var headerHtml = '<div style="padding:8px 0;margin-bottom:8px;border-bottom:1px solid var(--layer8d-border);">' +
            _field('Status', statusLabel) +
            _field('Dates', startDate + ' \u2014 ' + endDate) +
            (plan.goals ? _field('Goals', plan.goals) : '') +
            notesHtml +
            '</div>';

        var planContainerId = 'mpe-plan-' + Date.now();
        var content = headerHtml + '<div id="' + planContainerId + '" style="min-height:150px;"></div>';

        Layer8MPopup.show({
            title: Layer8DUtils.escapeHtml(plan.title || plan.planId),
            content: content,
            size: 'full',
            showFooter: false,
            onShow: function(popup) {
                var body = popup && popup.body ? popup.body : popup;
                if (!body || !window.MobilePlanRenderer) return;
                MobilePlanRenderer.render(body.querySelector('#' + planContainerId), plan.clientId);
            }
        });
    }

    function _field(label, value) {
        return '<div style="font-size:13px;margin-bottom:6px;"><span style="color:var(--layer8d-text-muted);">' +
            Layer8DUtils.escapeHtml(label) + ':</span> <span style="color:var(--layer8d-text-dark);">' +
            Layer8DUtils.escapeHtml(value || '') + '</span></div>';
    }
})();
