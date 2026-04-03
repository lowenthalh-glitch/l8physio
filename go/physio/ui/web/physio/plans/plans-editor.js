(function() {
    'use strict';

    var POSTURE_CODES = { 1:'KYPH', 2:'LORD', 3:'UFLAT', 4:'LFLAT', 5:'VALG', 6:'PRON', 7:'GEN' };
    var JOINT_CODES   = { 1:'SHO',  2:'KNE',  3:'ANK',  4:'LBP',  5:'ELB',  6:'GEN', 7:'HIP', 8:'CORE', 9:'SIJ' };

    function _authHeaders() {
        var t = sessionStorage.getItem('bearerToken');
        var h = { 'Content-Type': 'application/json' };
        if (t) h['Authorization'] = 'Bearer ' + t;
        return h;
    }

    function _apiPrefix() {
        return (typeof Layer8DConfig !== 'undefined' && Layer8DConfig.getApiPrefix)
            ? Layer8DConfig.getApiPrefix() : '/physio';
    }

    function _protocolCode(posture, joint) {
        return (POSTURE_CODES[posture] || '?') + '-' + (JOINT_CODES[joint] || '?');
    }

    function _q(text) {
        return '?body=' + encodeURIComponent(JSON.stringify({ text: text }));
    }

    function _fieldRow(label, value) {
        return '<div class="pe-field-row">' +
            '<span class="pe-field-label">' + Layer8DUtils.escapeHtml(label) + '</span>' +
            '<span class="pe-field-value">' + (value || '\u2014') + '</span>' +
            '</div>';
    }

    function _planStatusLabel(status) {
        var enums = window.PhysioManagement && window.PhysioManagement.enums;
        if (!enums || !enums.PLAN_STATUS) return String(status || '\u2014');
        return enums.PLAN_STATUS[status] || '\u2014';
    }

    function _formatDate(ts) {
        if (!ts) return '\u2014';
        return Layer8DUtils.formatDate(ts);
    }

    function _renderDetail(plan, protocolLabel) {
        var lookup     = window.PhysioManagement && window.PhysioManagement.lookups;
        var clientName = lookup && lookup.clientName ? lookup.clientName(plan.clientId) : (plan.clientId || '\u2014');

        return [
            '<div class="pe-detail">',
              '<div class="pe-fields">',
                _fieldRow('Title',      Layer8DUtils.escapeHtml(plan.title || '\u2014')),
                _fieldRow('Client',     Layer8DUtils.escapeHtml(clientName)),
                _fieldRow('Protocol',   Layer8DUtils.escapeHtml(protocolLabel || plan.protocolId || '\u2014')),
                _fieldRow('Status',     Layer8DUtils.escapeHtml(_planStatusLabel(plan.status))),
                _fieldRow('Start Date', _formatDate(plan.startDate)),
                _fieldRow('End Date',   _formatDate(plan.endDate)),
                _fieldRow('Goals',      Layer8DUtils.escapeHtml(plan.goals || '\u2014')),
              '</div>',
              '<div class="pe-exercises-header">Exercises</div>',
              '<div id="pe-exercises-table" style="max-height:220px;overflow-y:auto;"></div>',
              '<div class="pe-actions">',
                '<button id="pe-edit-btn" class="layer8d-btn layer8d-btn-secondary layer8d-btn-small">&#9998; Edit Workout</button>',
              '</div>',
            '</div>'
        ].join('');
    }

    function _buildExerciseTable(exercises) {
        var lookup = window.PhysioManagement && window.PhysioManagement.lookups;
        var rows = (exercises || []).map(function(pe, i) {
            var exName = lookup && lookup.exerciseName ? lookup.exerciseName(pe.exerciseId) : (pe.exerciseId || '\u2014');
            return {
                _idx:  i + 1,
                name:  exName,
                sets:  pe.sets  || '\u2014',
                reps:  pe.reps  || '\u2014',
                notes: pe.notes || ''
            };
        });

        var table = new Layer8DTable({
            containerId: 'pe-exercises-table',
            columns: [
                { key: '_idx',  label: '#' },
                { key: 'name',  label: 'Exercise' },
                { key: 'sets',  label: 'Sets' },
                { key: 'reps',  label: 'Reps' },
                { key: 'notes', label: 'Notes' }
            ],
            pageSize: 50,
            serverSide: false,
            showActions: false
        });
        table.init();
        table.setData(rows);
    }

    function _openEditorPopup(plan, protocol, onRefresh) {
        var preset = {
            posture: protocol ? protocol.posture : 0,
            joint:   protocol ? protocol.joint   : 0,
            phase:   1,
            volume:  plan.volume || 3
        };

        Layer8DPopup.show({
            title:      'Edit Workout \u2014 ' + Layer8DUtils.escapeHtml(plan.title || plan.planId),
            content:    '<div id="pe-builder-container" style="min-height:420px;overflow-y:auto;"></div>',
            size:       'xlarge',
            showFooter: false,
            onShow: function(body) {
                var container = body.querySelector('#pe-builder-container');
                if (container && window.PhysioWorkoutBuilder) {
                    PhysioWorkoutBuilder.setupInContainer(container, {
                        mode:      'edit',
                        planId:    plan.planId,
                        onRefresh: onRefresh,
                        preset:    preset
                    });
                }
            }
        });
    }

    async function _open(item, onRefresh) {
        var planId = item && item.planId;
        console.log('[plans-editor] _open called, planId:', planId, 'item:', item);
        if (!planId) return;

        var prefix = _apiPrefix();
        try {
            // Fetch full plan
            var planResp = await fetch(
                prefix + '/50/PhyPlan' + _q('select * from TreatmentPlan where planId=' + planId + ' limit 1'),
                { headers: _authHeaders() }
            );
            if (!planResp.ok) throw new Error('HTTP ' + planResp.status);
            var planData = await planResp.json();
            var plan     = (planData.list || [])[0] || item;

            // Fetch protocol to get human-readable label
            var protocol      = null;
            var protocolLabel = plan.protocolId || '\u2014';
            if (plan.protocolId) {
                try {
                    var protoResp = await fetch(
                        prefix + '/50/PhyProtocol' + _q('select * from PhysioProtocol where protocolId=' + plan.protocolId + ' limit 1'),
                        { headers: _authHeaders() }
                    );
                    if (protoResp.ok) {
                        var protoData = await protoResp.json();
                        protocol = (protoData.list || [])[0];
                        if (protocol) protocolLabel = _protocolCode(protocol.posture, protocol.joint);
                    }
                } catch(pe) {}
            }

            var content = _renderDetail(plan, protocolLabel);
            Layer8DPopup.show({
                title:      Layer8DUtils.escapeHtml(plan.title || planId),
                content:    content,
                size:       'large',
                showFooter: false,
                onShow: function(body) {
                    _buildExerciseTable(plan.exercises);
                    body.querySelector('#pe-edit-btn').addEventListener('click', function() {
                        _openEditorPopup(plan, protocol, onRefresh);
                    });
                }
            });
        } catch(e) {
            Layer8DNotification.error('Failed to load plan: ' + e.message);
        }
    }

    window.PhysioPlanEditor = {
        open: function(item, onRefresh) {
            _open(item, onRefresh);
        }
    };
})();
