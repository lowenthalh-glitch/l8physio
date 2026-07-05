(function() {
    'use strict';

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

    function _isStaffPortal() {
        return sessionStorage.getItem('userPortal') !== 'client-app.html';
    }

    function _renderDetail(plan, protocolLabel) {
        var lookup     = window.PhysioManagement && window.PhysioManagement.lookups;
        var clientName = lookup && lookup.clientName ? lookup.clientName(plan.clientId) : (plan.clientId || '\u2014');
        var isStaff    = _isStaffPortal();
        var staffBtns  = isStaff
            ? '<button id="pe-notes-btn" class="layer8d-btn layer8d-btn-secondary layer8d-btn-small">\u270e Edit Notes</button>' +
              '<button id="pe-export-btn" class="layer8d-btn layer8d-btn-secondary layer8d-btn-small">\u2b06 Save as Protocol Template</button>' +
              '<button id="pe-import-btn" class="layer8d-btn layer8d-btn-secondary layer8d-btn-small">\u2b07 Import from Protocol Template</button>'
            : '';

        // Notes are staff-only. In the client portal the row is hidden entirely
        // (belt-and-braces on top of the API-side deny rule).
        var notesRow = isStaff
            ? _fieldRow('Notes', Layer8DUtils.escapeHtml(plan.notes || '\u2014'))
            : '';

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
                notesRow,
              '</div>',
              '<div class="pe-exercises-header">Exercises</div>',
              '<div id="pe-exercises-table" style="max-height:220px;overflow-y:auto;"></div>',
              '<div class="pe-actions">',
                '<button id="pe-edit-btn" class="layer8d-btn layer8d-btn-secondary layer8d-btn-small">&#9998; Edit Workout</button>',
                staffBtns,
              '</div>',
            '</div>'
        ].join('');
    }

    function _showNotesDialog(plan, onRefresh) {
        Layer8DPopup.show({
            title:   'Edit Notes',
            content: '<div class="pe-notes-form">' +
                       '<label class="pe-notes-label" for="pe-notes-text">Treatment Notes</label>' +
                       '<textarea id="pe-notes-text" class="pe-notes-input" rows="8">' +
                         Layer8DUtils.escapeHtml(plan.notes || '') +
                       '</textarea>' +
                       '<div class="pe-notes-hint">Not visible to the client.</div>' +
                     '</div>',
            size:    'small',
            showFooter: true,
            saveButtonText: 'Save',
            onSave: async function() {
                var body = Layer8DPopup.getBody();
                var text = ((body && body.querySelector('#pe-notes-text').value) || '');
                try {
                    var prefix  = _apiPrefix();
                    var getResp = await fetch(prefix + '/50/PhyPlan' + _q('select * from TreatmentPlan where planId=' + plan.planId + ' limit 1'),
                        { headers: _authHeaders() });
                    if (!getResp.ok) throw new Error('Fetch plan HTTP ' + getResp.status);
                    var data     = await getResp.json();
                    var fullPlan = (data.list || [])[0];
                    if (!fullPlan) throw new Error('Plan not found');
                    fullPlan.notes = text;
                    var putResp = await fetch(prefix + '/50/PhyPlan', {
                        method: 'PUT',
                        headers: _authHeaders(),
                        body:    JSON.stringify(fullPlan)
                    });
                    if (!putResp.ok) throw new Error('Update plan HTTP ' + putResp.status);
                    plan.notes = text;
                    Layer8DNotification.success('Notes saved.');
                    Layer8DPopup.close();
                    if (onRefresh) onRefresh();
                } catch(e) {
                    Layer8DNotification.error('Failed to save notes: ' + e.message);
                }
            }
        });
    }

    function _showExportDialog(plan) {
        var defaultName = plan.title || '';
        Layer8DPopup.show({
            title:    'Save Plan as Protocol Template',
            content:  '<div class="pe-export-form">' +
                        '<label class="pe-export-label" for="pe-export-name">Template Name</label>' +
                        '<input type="text" id="pe-export-name" name="pe-export-name" class="pe-export-input"' +
                          ' value="' + Layer8DUtils.escapeHtml(defaultName) + '">' +
                      '</div>',
            size:     'small',
            showFooter: true,
            saveButtonText: 'Save Template',
            onShow: function(body) {
                var input = body.querySelector('#pe-export-name');
                if (input) input.focus();
            },
            onSave: async function() {
                var body  = Layer8DPopup.getBody();
                var name  = ((body && body.querySelector('#pe-export-name').value) || '').trim();
                if (!name) {
                    Layer8DNotification.warning('Template name is required.');
                    return;
                }
                try {
                    await PhysioPlanProtocol.exportPlanAsProtocol(plan, name);
                    Layer8DNotification.success('Saved as protocol template: ' + name);
                    Layer8DPopup.close();
                } catch(e) {
                    Layer8DNotification.error('Failed to save template: ' + e.message);
                }
            }
        });
    }

    async function _showImportDialog(plan, onRefresh) {
        var protocols;
        try {
            protocols = await PhysioPlanProtocol.listActiveProtocols();
        } catch(e) {
            Layer8DNotification.error('Failed to load templates: ' + e.message);
            return;
        }
        if (!protocols.length) {
            Layer8DNotification.warning('No active protocol templates to import.');
            return;
        }

        var options = protocols.map(function(p) {
            return '<option value="' + Layer8DUtils.escapeHtml(p.protocolId) + '">' +
                   Layer8DUtils.escapeHtml(p.name || p.protocolId) + '</option>';
        }).join('');
        var currentCount = (plan.exercises || []).length;

        Layer8DPopup.show({
            title:   'Import Protocol Template',
            content: '<div class="pe-import-form">' +
                       '<label class="pe-import-label" for="pe-import-select">Template</label>' +
                       '<select id="pe-import-select" name="pe-import-select" class="pe-import-input">' + options + '</select>' +
                       '<div class="pe-import-warn">' +
                         'This will replace the current ' + currentCount + ' exercises and overwrite Description + Goals.' +
                       '</div>' +
                     '</div>',
            size:    'small',
            showFooter: true,
            saveButtonText: 'Replace Exercises',
            onSave: async function() {
                var body       = Layer8DPopup.getBody();
                var protocolId = (body && body.querySelector('#pe-import-select').value) || '';
                if (!protocolId) return;
                try {
                    await PhysioPlanProtocol.importProtocolIntoPlan(plan.planId, protocolId);
                    Layer8DNotification.success('Plan exercises replaced from template.');
                    Layer8DPopup.close();
                    if (onRefresh) onRefresh();
                } catch(e) {
                    Layer8DNotification.error('Failed to import template: ' + e.message);
                }
            }
        });
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

    function _openEditorPopup(plan, onRefresh) {
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
                        onRefresh: onRefresh
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
            var protocolLabel = plan.protocolId || '\u2014';
            if (plan.protocolId) {
                try {
                    var protoResp = await fetch(
                        prefix + '/50/PhyProto' + _q('select * from PhysioProtocol where protocolId=' + plan.protocolId + ' limit 1'),
                        { headers: _authHeaders() }
                    );
                    if (protoResp.ok) {
                        var protoData = await protoResp.json();
                        var protocol  = (protoData.list || [])[0];
                        if (protocol && protocol.name) protocolLabel = protocol.name;
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
                        _openEditorPopup(plan, onRefresh);
                    });
                    var exportBtn = body.querySelector('#pe-export-btn');
                    if (exportBtn) {
                        exportBtn.addEventListener('click', function() {
                            _showExportDialog(plan);
                        });
                    }
                    var importBtn = body.querySelector('#pe-import-btn');
                    if (importBtn) {
                        importBtn.addEventListener('click', function() {
                            _showImportDialog(plan, onRefresh);
                        });
                    }
                    var notesBtn = body.querySelector('#pe-notes-btn');
                    if (notesBtn) {
                        notesBtn.addEventListener('click', function() {
                            _showNotesDialog(plan, onRefresh);
                        });
                    }
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
