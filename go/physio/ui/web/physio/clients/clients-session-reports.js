(function() {
    'use strict';

    function _apiPrefix() { return Layer8DConfig.getApiPrefix(); }
    function _headers() { return getAuthHeaders(); }

    window.PhysioClientSessionReports = {

        init: function(container, client, parentCtx) {
            if (!container) return;
            var self = this;
            self._client = client;
            self._parentCtx = parentCtx;
            self._container = container;

            var toolbar = '<div style="margin-bottom:8px;">' +
                '<button id="physio-add-report-btn" class="layer8d-btn layer8d-btn-primary layer8d-btn-small">+ Add Session Report</button>' +
                '</div>';
            var tableDiv = '<div id="physio-sessreports-table"></div>';
            container.innerHTML = toolbar + tableDiv;

            container.querySelector('#physio-add-report-btn').addEventListener('click', function() {
                self._openAddReport();
            });

            self._loadTable();
        },

        _loadTable: function() {
            var self = this;
            var col    = window.Layer8ColumnFactory;
            var enums  = PhysioManagement.enums;
            var render = PhysioManagement.render;

            var columns = [
                ...col.date('sessionDate',       'Date'),
                ...col.status('status',          'Status', enums.SESSION_STATUS_VALUES, render.sessionStatus),
                ...col.number('painBefore',      'Pain Before'),
                ...col.number('painDuring',      'Pain During'),
                ...col.number('painAfter',       'Pain After'),
                ...col.enum('adjustmentLevel',   'Adjustment', enums.ADJUSTMENT_LEVEL_VALUES, render.adjustmentLevel),
                ...col.boolean('followupRequired','Follow-up'),
                ...col.col('notes',              'Notes')
            ];

            var table = new Layer8DTable({
                containerId: 'physio-sessreports-table',
                endpoint:    Layer8DConfig.resolveEndpoint('/50/SessRpt'),
                modelName:   'SessionReport',
                columns:     columns,
                primaryKey:  'reportId',
                pageSize:    10,
                serverSide:  true,
                baseWhereClause: 'clientId=' + self._client.clientId,
                showActions: false
            });
            table.init();
        },

        _openAddReport: function() {
            var self = this;
            var client = self._client;
            var plan   = self._parentCtx ? self._parentCtx._currentPlan : null;

            // Pre-populate from active plan context
            var preData = {
                clientId:    client.clientId,
                therapistId: plan ? plan.therapistId : '',
                protocolId:  plan ? plan.protocolId  : '',
                sessionDate: Math.floor(Date.now() / 1000)
            };
            // Fallback: therapist from session user
            if (!preData.therapistId) {
                preData.therapistId = sessionStorage.getItem('currentUser') || '';
            }

            var formDef = (PhysioManagement.forms || {}).SessionReport;
            if (!formDef) { Layer8DNotification.error('SessionReport form not found'); return; }

            var svcConfig = {
                endpoint:   Layer8DConfig.resolveEndpoint('/50/SessRpt'),
                primaryKey: 'reportId',
                modelName:  'SessionReport'
            };

            Layer8DPopup.show({
                title: 'Add Session Report',
                content: Layer8DForms.generateFormHtml(formDef, preData),
                size: 'large',
                showFooter: true,
                saveButtonText: 'Save Report',
                onSave: async function() {
                    var data = Layer8DForms.collectFormData(formDef);
                    var errors = Layer8DForms.validateFormData(formDef, data);
                    if (errors.length > 0) {
                        Layer8DNotification.error('Validation failed', errors.map(function(e) { return e.message; }));
                        return;
                    }
                    try {
                        await Layer8DForms.saveRecord(svcConfig.endpoint, data, false);
                        Layer8DPopup.close();
                        Layer8DNotification.success('Session report saved');
                        self._loadTable();
                    } catch (err) {
                        Layer8DNotification.error('Error saving report', [err.message]);
                    }
                },
                onShow: function(body) {
                    Layer8DForms.setFormContext(formDef, svcConfig);
                    setTimeout(function() {
                        Layer8DForms.attachDatePickers(body);
                        self._replaceDifficultyField(body, plan);
                    }, 50);
                }
            });
        },

        _replaceDifficultyField: function(body, plan) {
            var self = this;
            var input = body.querySelector('input[name="difficultyExerciseId"]');
            if (!input) return;
            var wrapper = input.closest('.layer8d-form-group') || input.parentElement;
            var exerciseMap = self._parentCtx ? self._parentCtx._exerciseMap : {};
            var checkboxHtml = PhysioClientExerciseInfo.buildExerciseCheckboxes(plan, exerciseMap);

            // Replace the text input with checkboxes
            input.style.display = 'none';
            var container = document.createElement('div');
            container.innerHTML = checkboxHtml;
            input.parentElement.appendChild(container);

            // On form collect, join selected IDs into the hidden input
            container.addEventListener('change', function() {
                var selected = [];
                container.querySelectorAll('.physio-diff-ex-cb:checked').forEach(function(cb) {
                    selected.push(cb.value);
                });
                input.value = selected.join(',');
            });
        }
    };
})();
