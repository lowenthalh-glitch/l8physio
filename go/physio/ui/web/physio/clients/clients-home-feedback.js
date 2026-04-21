(function() {
    'use strict';

    var ENDPOINT = '/50/HomeFdbk';
    var MODEL    = 'HomeFeedback';
    var PK       = 'feedbackId';

    function hasPerm(action) {
        var perms = window.Layer8DPermissions;
        if (!perms) return true; // permissive mode
        var actions = perms[MODEL];
        if (!actions) return false;
        return actions.indexOf(action) !== -1;
    }

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
            var canEdit   = hasPerm(2);
            var canDelete = hasPerm(3);

            var columns = [
                ...col.date('feedbackDate',      'Date'),
                ...col.status('difficulty',      'Training Level', enums.TRAINING_LEVEL_VALUES, render.trainingLevel),
                ...col.number('painDuring',      'Pain During'),
                ...col.number('painAfter',       'Pain After'),
                ...col.number('painBefore',      'Sleep'),
                ...col.number('compliance',      'Nutrition'),
                ...col.number('mood',            'Stress'),
                ...col.status('status',          'Status', enums.SESSION_STATUS_VALUES, render.sessionStatus)
            ];

            var svcConfig = {
                endpoint:   Layer8DConfig.resolveEndpoint(ENDPOINT),
                primaryKey: PK,
                modelName:  MODEL
            };

            var table = new Layer8DTable({
                containerId: 'physio-homefeedback-table',
                endpoint:    svcConfig.endpoint,
                modelName:   MODEL,
                columns:     columns,
                primaryKey:  PK,
                pageSize:    10,
                serverSide:  true,
                baseWhereClause: 'clientId=' + self._client.clientId,
                showActions: canEdit || canDelete,
                onEdit: canEdit ? function(id) { self._openEditFeedback(id, svcConfig); } : null,
                onDelete: canDelete ? function(id) { self._deleteFeedback(id, svcConfig); } : null
            });
            table.init();
            self._table = table;
        },

        _getSvcConfig: function() {
            return {
                endpoint:   Layer8DConfig.resolveEndpoint(ENDPOINT),
                primaryKey: PK,
                modelName:  MODEL
            };
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

            var svcConfig = self._getSvcConfig();

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
                    // Ensure reference fields are correct strings
                    data.clientId = preData.clientId;
                    data.therapistId = preData.therapistId || '';
                    data.planId = preData.planId || '';
                    data.status = self._calculateColor(data);

                    // Check if feedback already exists for the selected date
                    var isDuplicate = await self._checkDuplicateDate(client.clientId, data.feedbackDate, svcConfig.endpoint);
                    if (isDuplicate) {
                        Layer8DNotification.warning('Feedback already exists for this date. Only one feedback per day is allowed.');
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
                        self._applyFormLayout(body);
                    }, 50);
                }
            });
        },

        _openEditFeedback: function(id, svcConfig) {
            var self = this;
            var formDef = (PhysioManagement.forms || {}).HomeFeedback;
            if (!formDef) return;

            Layer8DForms.fetchRecord(svcConfig.endpoint, PK, id, MODEL).then(function(data) {
                if (!data) { Layer8DNotification.error('Record not found'); return; }

                Layer8DPopup.show({
                    title: 'Edit Home Feedback',
                    content: Layer8DForms.generateFormHtml(formDef, data),
                    size: 'large',
                    showFooter: true,
                    saveButtonText: 'Update Feedback',
                    onSave: async function() {
                        var updated = Layer8DForms.collectFormData(formDef);
                        var errors = Layer8DForms.validateFormData(formDef, updated);
                        if (errors.length > 0) {
                            Layer8DNotification.error('Validation failed', errors.map(function(e) { return e.message; }));
                            return;
                        }
                        updated[PK] = id;
                        updated.status = self._calculateColor(updated);
                        try {
                            await Layer8DForms.saveRecord(svcConfig.endpoint, updated, true);
                            Layer8DPopup.close();
                            Layer8DNotification.success('Feedback updated');
                            self._loadTable();
                        } catch (err) {
                            Layer8DNotification.error('Error updating feedback', [err.message]);
                        }
                    },
                    onShow: function(body) {
                        Layer8DForms.setFormContext(formDef, svcConfig);
                        setTimeout(function() {
                            Layer8DForms.attachDatePickers(body);
                            self._applyFormLayout(body);
                            self._preselectRadios(body, data);
                        }, 50);
                    }
                });
            });
        },

        _deleteFeedback: function(id, svcConfig) {
            var self = this;
            Layer8DForms.deleteRecord(svcConfig.endpoint, id, PK, MODEL).then(function() {
                Layer8DNotification.success('Feedback deleted');
                self._loadTable();
            }).catch(function(err) {
                Layer8DNotification.error('Error deleting feedback', [err.message]);
            });
        },

        _checkDuplicateDate: async function(clientId, feedbackDate, endpoint) {
            try {
                var ts = parseInt(feedbackDate) || 0;
                if (ts === 0) return false;
                var d = new Date(ts * 1000);
                d.setHours(0, 0, 0, 0);
                var dayStart = Math.floor(d.getTime() / 1000);
                var dayEnd = dayStart + 86399;
                var q = 'select * from HomeFeedback where clientId=' + clientId +
                    ' and feedbackDate>=' + dayStart + ' and feedbackDate<=' + dayEnd;
                var body = encodeURIComponent(JSON.stringify({ text: q }));
                var resp = await fetch(endpoint + '?body=' + body, { method: 'GET', headers: getAuthHeaders() });
                var data = await resp.json();
                return (data.list || []).length > 0;
            } catch (e) {
                return false;
            }
        },

        _applyFormLayout: function(body) {
            var self = this;
            body.querySelectorAll('.detail-grid, .form-row, .probler-popup-form-grid, .probler-popup-section-grid').forEach(function(grid) {
                grid.style.setProperty('grid-template-columns', '1fr', 'important');
            });
            self._replaceWithRadio(body, 'painDuring', 0, 5, 'No pain', 'Very painful');
            self._replaceWithRadio(body, 'painAfter',  0, 5, 'No pain', 'Very painful');
            self._replaceWithRadio(body, 'painBefore', 1, 5, 'Bad', 'Good');
            self._replaceWithRadio(body, 'compliance', 1, 5, 'Bad', 'Good');
            self._replaceWithRadio(body, 'mood',       1, 5, 'Bad', 'Good');
        },

        _preselectRadios: function(body, data) {
            var fields = ['painDuring', 'painAfter', 'painBefore', 'compliance', 'mood'];
            fields.forEach(function(f) {
                var val = data[f];
                if (val === undefined || val === null) return;
                var radio = body.querySelector('input[name="' + f + '_radio"][value="' + val + '"]');
                if (radio) radio.checked = true;
            });
        },

        // RED=3: difficulty 1 or 4, painDuring 3-5, painAfter 3-5
        // YELLOW=2: difficulty 2, painDuring 1-2, painAfter 1-2
        // GREEN=1: difficulty 3 and painDuring 0 and painAfter 0
        _calculateColor: function(data) {
            var d = parseInt(data.difficulty) || 0;
            var pd = parseInt(data.painDuring) || 0;
            var pa = parseInt(data.painAfter) || 0;

            if (d === 1 || d === 4 || pd >= 3 || pa >= 3) return 3;
            if (d === 2 || (pd >= 1 && pd <= 2) || (pa >= 1 && pa <= 2)) return 2;
            return 1;
        },

        _replaceWithRadio: function(body, fieldName, min, max, minLabel, maxLabel) {
            var select = body.querySelector('select[name="' + fieldName + '"]');
            if (!select) return;

            var wrapper = select.closest('.form-group') || select.parentElement;
            select.style.display = 'none';

            var radioDiv = document.createElement('div');
            radioDiv.style.cssText = 'display:flex; gap:16px; margin-top:6px; align-items:center;';

            if (minLabel) {
                var minSpan = document.createElement('span');
                minSpan.textContent = minLabel;
                minSpan.style.cssText = 'font-size:12px; color:var(--layer8d-text-muted);';
                radioDiv.appendChild(minSpan);
            }

            for (var i = min; i <= max; i++) {
                var label = document.createElement('label');
                label.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:2px; cursor:pointer;';

                var radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = fieldName + '_radio';
                radio.value = String(i);
                radio.style.cssText = 'cursor:pointer; width:18px; height:18px;';

                radio.addEventListener('change', (function(sel, val) {
                    return function() { sel.value = val; };
                })(select, String(i)));

                var numSpan = document.createElement('span');
                numSpan.textContent = String(i);
                numSpan.style.cssText = 'font-size:13px;';

                label.appendChild(radio);
                label.appendChild(numSpan);
                radioDiv.appendChild(label);
            }

            if (maxLabel) {
                var maxSpan = document.createElement('span');
                maxSpan.textContent = maxLabel;
                maxSpan.style.cssText = 'font-size:12px; color:var(--layer8d-text-muted);';
                radioDiv.appendChild(maxSpan);
            }

            wrapper.appendChild(radioDiv);
        }
    };
})();
