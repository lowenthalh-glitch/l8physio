(function() {
    'use strict';

    window.PhysioClientHomeFeedback = {

        init: function(container, client, parentCtx) {
            if (!container) return;
            var self = this;
            self._client = client;
            self._parentCtx = parentCtx;
            self._container = container;

            var toolbar = '<div style="margin-bottom:8px;">' +
                '<button id="physio-add-feedback-btn" class="layer8d-btn layer8d-btn-primary layer8d-btn-small">+ Add Feedback</button>' +
                '</div>';
            var tableDiv = '<div id="physio-homefeedback-table"></div>';
            container.innerHTML = toolbar + tableDiv;

            container.querySelector('#physio-add-feedback-btn').addEventListener('click', function() {
                self._openAddFeedback();
            });

            self._loadTable();
        },

        _loadTable: function() {
            var self = this;
            var col    = window.Layer8ColumnFactory;
            var enums  = PhysioManagement.enums;
            var render = PhysioManagement.render;

            var columns = [
                ...col.date('feedbackDate',      'Date'),
                ...col.status('compliance',      'Compliance',  enums.COMPLIANCE_VALUES, render.compliance),
                ...col.number('painBefore',      'Pain Before'),
                ...col.number('painAfter',       'Pain After'),
                ...col.status('difficulty',      'Difficulty',   enums.DIFFICULTY_VALUES, render.difficulty),
                ...col.enum('mood',             'Mood',         null, render.mood),
                ...col.status('status',          'Status',       enums.SESSION_STATUS_VALUES, render.sessionStatus),
                ...col.col('notes',              'Notes')
            ];

            var table = new Layer8DTable({
                containerId: 'physio-homefeedback-table',
                endpoint:    Layer8DConfig.resolveEndpoint('/50/HomeFdbk'),
                modelName:   'HomeFeedback',
                columns:     columns,
                primaryKey:  'feedbackId',
                pageSize:    10,
                serverSide:  true,
                baseWhereClause: 'clientId=' + self._client.clientId,
                showActions: false
            });
            table.init();
        },

        _openAddFeedback: function() {
            var self = this;
            var client = self._client;
            var plan   = self._parentCtx ? self._parentCtx._currentPlan : null;

            var preData = {
                clientId:     client.clientId,
                therapistId:  plan ? plan.therapistId : (sessionStorage.getItem('currentUser') || ''),
                planId:       plan ? plan.planId : '',
                feedbackDate: Math.floor(Date.now() / 1000)
            };

            var formDef = (PhysioManagement.forms || {}).HomeFeedback;
            if (!formDef) { Layer8DNotification.error('HomeFeedback form not found'); return; }

            var svcConfig = {
                endpoint:   Layer8DConfig.resolveEndpoint('/50/HomeFdbk'),
                primaryKey: 'feedbackId',
                modelName:  'HomeFeedback'
            };

            Layer8DPopup.show({
                title: 'Add Home Feedback',
                content: Layer8DForms.generateFormHtml(formDef, preData),
                size: 'large',
                showFooter: true,
                saveButtonText: 'Save Feedback',
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
                        Layer8DNotification.success('Feedback saved');
                        self._loadTable();
                    } catch (err) {
                        Layer8DNotification.error('Error saving feedback', [err.message]);
                    }
                },
                onShow: function(body) {
                    Layer8DForms.setFormContext(formDef, svcConfig);
                    setTimeout(function() {
                        Layer8DForms.attachDatePickers(body);
                        self._replaceExercisesField(body, plan);
                    }, 50);
                }
            });
        },

        _replaceExercisesField: function(body, plan) {
            var self = this;
            var input = body.querySelector('input[name="exercisesDone"]');
            if (!input) return;
            var exerciseMap = self._parentCtx ? self._parentCtx._exerciseMap : {};
            var checkboxHtml = PhysioClientExerciseInfo.buildExerciseCheckboxes(plan, exerciseMap);

            input.style.display = 'none';
            var container = document.createElement('div');
            container.innerHTML = checkboxHtml;
            input.parentElement.appendChild(container);

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
