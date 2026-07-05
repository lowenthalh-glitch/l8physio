(function() {
    'use strict';

    var CATEGORY_LABELS = { 1: 'Mobility', 2: 'Rehab', 3: 'Strength', 4: 'Functional' };

    function _apiPrefix() { return Layer8DConfig.getApiPrefix(); }
    function _headers() { return getAuthHeaders(); }
    function _fetch(url) { return fetch(url, { method: 'GET', headers: _headers() }).then(function(r) { return r.json(); }); }

    // The plan is read-only when the user lacks PUT (action 2) on TreatmentPlan —
    // e.g. a client viewing their own workout. Empty/absent Layer8DPermissions
    // means permissive (legacy admin), so default to editable in that case.
    function _canEditPlan() {
        var perms = window.Layer8DPermissions;
        if (!perms || Object.keys(perms).length === 0) return true;
        var actions = perms.TreatmentPlan || [];
        return actions.indexOf(2) !== -1;
    }

    // PhysioClientExercises — popup for viewing/editing a client's assigned treatment plan exercises
    window.PhysioClientExercises = {

        _currentPlan: null,
        _exerciseMap: null,          // cached full exercise data for info tab
        _planJoints: null,           // joints from the plan's first exercise
        _planPostures: null,         // postures from the plan's first exercise
        _circuitTables: {},          // map of category -> Layer8DTable instance

        open: function(clientId) {
            var self = this;
            self._currentPlan = null;
            self._exerciseMap = null;
            self._circuitTables = {};

            var query = encodeURIComponent(JSON.stringify({ text: 'select * from PhysioClient where clientId=' + clientId }));
            _fetch(_apiPrefix() + '/50/PhyClient?body=' + query)
            .then(function(data) {
                var client = (data.list || [])[0];
                if (!client) { Layer8DNotification.error('Client not found'); return; }
                self._showClientPopup(client);
            })
            .catch(function(err) { Layer8DNotification.error('Failed to load client: ' + err.message); });
        },

        _showClientPopup: function(client) {
            var self = this;
            var name = (client.firstName || '') + ' ' + (client.lastName || '');
            var canEdit = _canEditPlan();

            var content = [
                '<div class="physio-client-tabs">',
                  '<button class="physio-client-tab active" data-tab="exercises">Workout Plan</button>',
                  '<button class="physio-client-tab" data-tab="info">Exercise Info &amp; Videos</button>',
                  '<button class="physio-client-tab" data-tab="sessreports">Session Reports</button>',
                  '<button class="physio-client-tab" data-tab="stats">Statistics</button>',
                  '<button class="physio-client-tab" data-tab="homefeedback">Home Feedback</button>',
                  '<button class="physio-client-tab" data-tab="appointments">Appointments</button>',
                  '<button class="physio-client-tab" data-tab="details">Details</button>',
                '</div>',
                '<div class="physio-client-tab-pane active" id="physio-exercises-pane">',
                  (canEdit
                    ? '<div class="physio-wb-toolbar"><button class="layer8d-btn layer8d-btn-secondary layer8d-btn-small" id="physio-wb-open-btn">\uD83D\uDD28 Workout Builder</button></div>'
                    : ''),
                  '<div id="physio-exercises-pane-content">',
                    '<div class="physio-exercises-loading">Loading workout plan\u2026</div>',
                  '</div>',
                '</div>',
                '<div class="physio-client-tab-pane" id="physio-info-pane">',
                  '<div class="physio-exercises-loading">Loading exercise info\u2026</div>',
                '</div>',
                '<div class="physio-client-tab-pane" id="physio-sessreports-pane">',
                  '<div id="physio-sessreports-content"></div>',
                '</div>',
                '<div class="physio-client-tab-pane" id="physio-stats-pane">',
                  '<div id="physio-stats-content"></div>',
                '</div>',
                '<div class="physio-client-tab-pane" id="physio-homefeedback-pane">',
                  '<div id="physio-homefeedback-content"></div>',
                '</div>',
                '<div class="physio-client-tab-pane" id="physio-appointments-pane">',
                  '<div id="physio-appointments-content"></div>',
                '</div>',
                '<div class="physio-client-tab-pane" id="physio-details-pane">',
                  '<div class="physio-details-content"></div>',
                '</div>'
            ].join('');

            Layer8DPopup.show({
                title: name + ' \u2013 Workout Plan',
                content: content,
                size: 'xlarge',
                showFooter: false,
                onShow: function(body) {
                    var statsInitialized = false;
                    var feedbackInitialized = false;
                    var appointmentsInitialized = false;
                    body.querySelectorAll('.physio-client-tab').forEach(function(btn) {
                        btn.addEventListener('click', function() {
                            body.querySelectorAll('.physio-client-tab').forEach(function(b) { b.classList.remove('active'); });
                            body.querySelectorAll('.physio-client-tab-pane').forEach(function(p) { p.classList.remove('active'); });
                            btn.classList.add('active');
                            var target = body.querySelector('#physio-' + btn.dataset.tab + '-pane');
                            if (target) target.classList.add('active');
                            if (btn.dataset.tab === 'stats' && !statsInitialized && window.PhysioClientSessionStats) {
                                statsInitialized = true;
                                PhysioClientSessionStats.init(body.querySelector('#physio-stats-content'), client);
                            }
                            if (btn.dataset.tab === 'homefeedback' && !feedbackInitialized && window.PhysioClientHomeFeedback) {
                                feedbackInitialized = true;
                                PhysioClientHomeFeedback.init(body.querySelector('#physio-homefeedback-content'), client, self);
                            }
                            if (btn.dataset.tab === 'appointments' && !appointmentsInitialized && window.PhysioClientAppointments) {
                                appointmentsInitialized = true;
                                PhysioClientAppointments.init(body.querySelector('#physio-appointments-content'), client);
                            }
                        });
                    });

                    var exercisesPane  = body.querySelector('#physio-exercises-pane');
                    var contentPane    = body.querySelector('#physio-exercises-pane-content');
                    var infoPane       = body.querySelector('#physio-info-pane');

                    self._wireWbButton(exercisesPane, contentPane, client, infoPane);
                    self._loadPlan(client, contentPane, infoPane);
                    self._renderDetails(client, body.querySelector('#physio-details-pane .physio-details-content'));
                    if (window.PhysioClientSessionReports) {
                        PhysioClientSessionReports.init(
                            body.querySelector('#physio-sessreports-content'),
                            client, self
                        );
                    }
                }
            });
        },

        // ── Load active TreatmentPlan for this client ──────────────────────────
        _loadPlan: function(client, container, infoContainer) {
            var self = this;
            self._reloadPlan = function() {
                self._originals = null;
                self._loadPlan(client, container, infoContainer);
            };
            var query = encodeURIComponent(JSON.stringify({ text: 'select * from TreatmentPlan where clientId=' + client.clientId }));
            _fetch(_apiPrefix() + '/50/PhyPlan?body=' + query)
            .then(function(data) {
                var plans = (data.list || []).filter(function(p) { return p.status === 2; });
                var plan  = plans.length > 0 ? plans[0] : null;

                if (!plan) {
                    var canEditNoPlan = _canEditPlan();
                    var noPlanImport = canEditNoPlan
                        ? '<div style="margin-top:12px;"><button class="layer8d-btn layer8d-btn-primary layer8d-btn-small physio-noplan-import-btn">⬇ Create Plan from Template</button></div>'
                        : '';
                    var noplan = '<div class="physio-no-protocol">No active workout plan assigned to this client yet.'
                        + (canEditNoPlan ? '<br><span style="font-size:12px;color:var(--layer8d-text-muted)">Use the Workout Builder tab to create and assign a plan, or import a template below.</span>' : '')
                        + noPlanImport
                        + '</div>';
                    container.innerHTML = noplan;
                    if (infoContainer) infoContainer.innerHTML = '<div class="physio-no-protocol">No active workout plan assigned to this client yet.</div>';
                    if (canEditNoPlan) {
                        var btn = container.querySelector('.physio-noplan-import-btn');
                        if (btn) btn.addEventListener('click', function() { self._showCreateFromTemplateDialog(client); });
                    }
                    return;
                }
                self._currentPlan = plan;

                var exercises = plan.exercises || [];
                if (exercises.length === 0) {
                    var canEdit = _canEditPlan();
                    var importBtn = canEdit
                        ? '<button class="layer8d-btn layer8d-btn-primary layer8d-btn-small physio-plan-import-btn" style="margin-top:12px;">⬇ Import from Template</button>'
                        : '';
                    container.innerHTML =
                        '<div class="physio-no-protocol">' +
                          'Plan <strong>' + Layer8DUtils.escapeHtml(plan.title || '') + '</strong> has no exercises yet.' +
                          (importBtn ? '<div>' + importBtn + '</div>' : '') +
                        '</div>';
                    if (canEdit) {
                        var btn = container.querySelector('.physio-plan-import-btn');
                        if (btn) btn.addEventListener('click', function() { self._showImportDialog(plan); });
                    }
                    return;
                }

                // Fetch ALL exercises to build a complete map for display
                var q1 = encodeURIComponent(JSON.stringify({ text: 'select * from PhysioExercise limit 500' }));
                return _fetch(_apiPrefix() + '/50/PhyExercis?body=' + q1)
                .then(function(d) {
                    var allExercises = d.list || [];
                    var exerciseMap = {};
                    allExercises.forEach(function(ex) {
                        exerciseMap[ex.exerciseId] = ex;
                    });

                    // Detect plan's joints/postures from first exercise (for add-exercise filtering)
                    var seed = exerciseMap[exercises[0].exerciseId];
                    self._planJoints   = seed ? ((seed.joints   && seed.joints.length)   ? seed.joints   : (seed.joint   ? [seed.joint]   : null)) : null;
                    self._planPostures = seed ? ((seed.postures && seed.postures.length) ? seed.postures : (seed.posture ? [seed.posture] : null)) : null;
                    self._exerciseMap = exerciseMap;
                    self._renderPlanTable(plan, exercises, exerciseMap, container);
                    if (infoContainer) self._renderExerciseInfo(plan, exercises, exerciseMap, infoContainer);
                });
            })
            .catch(function(err) {
                container.innerHTML = '<div class="physio-no-protocol">Failed to load plan: ' + Layer8DUtils.escapeHtml(err.message) + '</div>';
            });
        },

        _showExportDialog: function(plan) {
            var defaultName = plan.title || '';
            Layer8DPopup.show({
                title:          'Save Plan as Protocol Template',
                content:        '<div class="pe-export-form">' +
                                  '<label class="pe-export-label" for="pe-export-name">Template Name</label>' +
                                  '<input type="text" id="pe-export-name" name="pe-export-name" class="pe-export-input"' +
                                    ' value="' + Layer8DUtils.escapeHtml(defaultName) + '">' +
                                '</div>',
                size:           'small',
                showFooter:     true,
                saveButtonText: 'Save Template',
                onShow: function(body) {
                    var input = body.querySelector('#pe-export-name');
                    if (input) input.focus();
                },
                onSave: async function() {
                    var body = Layer8DPopup.getBody();
                    var name = ((body && body.querySelector('#pe-export-name').value) || '').trim();
                    if (!name) { Layer8DNotification.warning('Template name is required.'); return; }
                    try {
                        await PhysioPlanProtocol.exportPlanAsProtocol(plan, name);
                        Layer8DNotification.success('Saved as protocol template: ' + name);
                        Layer8DPopup.close();
                    } catch(e) {
                        Layer8DNotification.error('Failed to save template: ' + e.message);
                    }
                }
            });
        },

        _showCreateFromTemplateDialog: async function(client) {
            var self = this;
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

            Layer8DPopup.show({
                title:          'Create Plan from Template',
                content:        '<div class="pe-import-form">' +
                                  '<label class="pe-import-label" for="pe-import-select">Template</label>' +
                                  '<select id="pe-import-select" name="pe-import-select" class="pe-import-input">' + options + '</select>' +
                                  '<div class="pe-import-warn">' +
                                    'A new Active workout plan will be created for this client, seeded from the selected template.' +
                                  '</div>' +
                                '</div>',
                size:           'small',
                showFooter:     true,
                saveButtonText: 'Create Plan',
                onSave: async function() {
                    var body       = Layer8DPopup.getBody();
                    var protocolId = (body && body.querySelector('#pe-import-select').value) || '';
                    if (!protocolId) return;
                    try {
                        await PhysioPlanProtocol.createPlanFromProtocol(client.clientId, protocolId);
                        Layer8DNotification.success('Plan created from template.');
                        Layer8DPopup.close();
                        if (self._reloadPlan) self._reloadPlan();
                    } catch(e) {
                        Layer8DNotification.error('Failed to create plan: ' + e.message);
                    }
                }
            });
        },

        _showImportDialog: async function(plan) {
            var self = this;
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
                title:          'Import Protocol Template',
                content:        '<div class="pe-import-form">' +
                                  '<label class="pe-import-label" for="pe-import-select">Template</label>' +
                                  '<select id="pe-import-select" name="pe-import-select" class="pe-import-input">' + options + '</select>' +
                                  '<div class="pe-import-warn">' +
                                    'This will replace the current ' + currentCount + ' exercises and overwrite Description + Goals.' +
                                  '</div>' +
                                '</div>',
                size:           'small',
                showFooter:     true,
                saveButtonText: 'Replace Exercises',
                onSave: async function() {
                    var body       = Layer8DPopup.getBody();
                    var protocolId = (body && body.querySelector('#pe-import-select').value) || '';
                    if (!protocolId) return;
                    try {
                        await PhysioPlanProtocol.importProtocolIntoPlan(plan.planId, protocolId);
                        Layer8DNotification.success('Plan exercises replaced from template.');
                        Layer8DPopup.close();
                        if (self._reloadPlan) self._reloadPlan();
                    } catch(e) {
                        Layer8DNotification.error('Failed to import template: ' + e.message);
                    }
                }
            });
        },

        _showNotesDialog: function(plan) {
            var self = this;
            Layer8DPopup.show({
                title:          'Edit Notes',
                content:        '<div class="pe-notes-form">' +
                                  '<label class="pe-notes-label" for="pe-notes-text">Treatment Notes</label>' +
                                  '<textarea id="pe-notes-text" class="pe-notes-input" rows="8">' +
                                    Layer8DUtils.escapeHtml(plan.notes || '') +
                                  '</textarea>' +
                                  '<div class="pe-notes-hint">Not visible to the client.</div>' +
                                '</div>',
                size:           'small',
                showFooter:     true,
                saveButtonText: 'Save',
                onSave: async function() {
                    var body = Layer8DPopup.getBody();
                    var text = ((body && body.querySelector('#pe-notes-text').value) || '');
                    try {
                        await PhysioPlanProtocol.replaceExercises(plan.planId, function(fullPlan) {
                            fullPlan.notes = text;
                            return fullPlan.exercises || [];
                        });
                        plan.notes = text;
                        Layer8DNotification.success('Notes saved.');
                        Layer8DPopup.close();
                        if (self._reloadPlan) self._reloadPlan();
                    } catch(e) {
                        Layer8DNotification.error('Failed to save notes: ' + e.message);
                    }
                }
            });
        },

        _buildCircuitRows: function(planExercises, exerciseMap) {
            var PA = window.PhysioPlanActions;
            var result = PA.groupAndSort(planExercises, exerciseMap);
            // Build display rows from sorted plan exercises
            var rows = {};
            Object.keys(result.circuits).forEach(function(k) {
                rows[k] = result.circuits[k].map(function(pe) {
                    return PA.displayRow(pe, exerciseMap);
                });
            });
            return { rows: rows, labels: result.labels };
        },

        _renderPlanTable: function(plan, planExercises, exerciseMap, container) {
            var self = this;
            var canEdit = _canEditPlan();

            if (!self._originals) {
                self._originals = {};
                (planExercises || []).forEach(function(pe) {
                    self._originals[pe.exerciseId] = {
                        sets:        parseInt(pe.sets, 10) || 0,
                        reps:        parseInt(pe.reps, 10) || 0,
                        notes:       pe.notes || '',
                        loadType:    parseInt(pe.loadType, 10) || 0,
                        holdSeconds: parseInt(pe.holdSeconds, 10) || 0,
                        weightKg:    parseInt(pe.weightKg, 10) || 0
                    };
                });
            }

            // Plan header
            var statusLabels = { 1: 'Draft', 2: 'Active', 3: 'Completed', 4: 'Cancelled' };
            var statusCls    = { 1: 'physio-plan-status-draft', 2: 'physio-plan-status-active', 3: 'physio-plan-status-done', 4: 'physio-plan-status-done' };
            var st = plan.status || 0;
            var startStr = plan.startDate ? Layer8DUtils.formatDate(plan.startDate) : '';

            var protoBtns = canEdit
                ? '<div class="physio-plan-protocol-actions">'
                    + '<button class="layer8d-btn layer8d-btn-secondary layer8d-btn-small physio-plan-export-btn">⬆ Save as Template</button>'
                    + '<button class="layer8d-btn layer8d-btn-secondary layer8d-btn-small physio-plan-import-btn">⬇ Import Template</button>'
                  + '</div>'
                : '';

            var headerHtml = '<div class="physio-plan-header"><div class="physio-plan-title">' + Layer8DUtils.escapeHtml(plan.title || 'Workout Plan') + '</div><div class="physio-plan-meta">'
                + (st ? '<span class="physio-plan-status ' + (statusCls[st] || '') + '">' + (statusLabels[st] || '') + '</span>' : '')
                + (startStr ? '<span class="physio-plan-date">Start: ' + startStr + '</span>' : '')
                + protoBtns
                + '</div></div>';

            // Notes block — staff only. canEdit implies PUT permission, which
            // clients don't have, so this doubles as the client-hide check.
            if (canEdit) {
                var notesText = plan.notes || '';
                headerHtml += '<div class="physio-plan-notes">'
                    + '<div class="physio-plan-notes-head">'
                      + '<span class="physio-plan-notes-label">Notes</span>'
                      + '<button class="layer8d-btn layer8d-btn-secondary layer8d-btn-small physio-plan-notes-btn">' + (notesText ? '✎ Edit' : '+ Add') + '</button>'
                    + '</div>'
                    + '<div class="physio-plan-notes-body' + (notesText ? '' : ' physio-plan-notes-empty') + '">'
                      + (notesText ? Layer8DUtils.escapeHtml(notesText) : 'No notes yet — visible to staff only.')
                    + '</div>'
                  + '</div>';
            }

            container.innerHTML = headerHtml;

            if (canEdit) {
                var exportBtn = container.querySelector('.physio-plan-export-btn');
                if (exportBtn) {
                    exportBtn.addEventListener('click', function() { self._showExportDialog(plan); });
                }
                var importBtn = container.querySelector('.physio-plan-import-btn');
                if (importBtn) {
                    importBtn.addEventListener('click', function() { self._showImportDialog(plan); });
                }
                var notesBtn = container.querySelector('.physio-plan-notes-btn');
                if (notesBtn) {
                    notesBtn.addEventListener('click', function() { self._showNotesDialog(plan); });
                }
            }

            // Reset stored tables for this render pass
            self._circuitTables = {};

            var col = window.Layer8ColumnFactory;
            var planColumns = [
                ...col.col('name',  'Exercise'),
                ...col.col('sets',  'Sets'),
                ...col.col('reps',  'Reps'),
                ...col.custom('loadType', 'Load', function(item) {
                    var extra = ' data-eid="' + Layer8DUtils.escapeHtml(item.exerciseId) + '"' + (canEdit ? '' : ' disabled');
                    return PhysioPlanActions.loadTypeSelect(item.loadType, 'physio-load-select', extra);
                }, { sortKey: false }),
                ...col.custom('_value', 'Value', function(item) {
                    var lt = item.loadType;
                    var field = lt === 5 ? 'weightKg' : ((lt === 8 || lt === 9) ? 'holdSeconds' : '');
                    var suffix = lt === 5 ? 'kg' : ((lt === 8 || lt === 9) ? 's' : '');
                    var val = field ? (item[field] || 0) : 0;
                    var enabled = !!field && canEdit;
                    var eid = Layer8DUtils.escapeHtml(item.exerciseId);
                    return '<span style="display:inline-flex;align-items:center;gap:2px;white-space:nowrap;">'
                         + '<input type="number" min="0" class="physio-value-input" data-eid="' + eid + '" data-field="' + field + '" value="' + val + '" ' + (enabled ? '' : 'disabled') + ' style="width:48px;padding:2px 4px;border:1px solid var(--layer8d-border);border-radius:3px;' + (enabled ? '' : 'background:var(--layer8d-bg-light);color:var(--layer8d-text-muted);') + '">'
                         + '<span style="font-size:11px;color:var(--layer8d-text-muted);">' + suffix + '</span>'
                         + '</span>';
                }, { sortKey: false }),
                ...col.col('notes', 'Notes'),
                ...col.custom('_progReg', '', function(item) {
                    if (!canEdit) return '';
                    var eid = Layer8DUtils.escapeHtml(item.exerciseId);
                    var fullEx = (self._exerciseMap || {})[item.exerciseId] || {};
                    var btns = '';
                    if (fullEx.regressionExerciseId) {
                        var regName = ((self._exerciseMap || {})[fullEx.regressionExerciseId] || {}).name || 'easier';
                        btns += '<button class="physio-regress-btn" data-eid="' + eid + '" title="Regress to: ' + Layer8DUtils.escapeHtml(regName) + '" style="cursor:pointer;background:none;border:none;font-size:16px;color:var(--layer8d-error);">\u2212</button>';
                    }
                    if (fullEx.progressionExerciseId) {
                        var progName = ((self._exerciseMap || {})[fullEx.progressionExerciseId] || {}).name || 'harder';
                        btns += '<button class="physio-progress-btn" data-eid="' + eid + '" title="Progress to: ' + Layer8DUtils.escapeHtml(progName) + '" style="cursor:pointer;background:none;border:none;font-size:16px;color:var(--layer8d-success);">+</button>';
                    }
                    if (fullEx.rotationGroupId) {
                        btns += '<button class="physio-rotate-btn" data-eid="' + eid + '" title="Rotate" style="cursor:pointer;background:none;border:none;font-size:14px;">↻</button>';
                    }
                    return btns || '';
                }, { sortKey: false }),
                ...col.custom('_order', '', function(item) {
                    if (!canEdit) return '';
                    var eid = Layer8DUtils.escapeHtml(item.exerciseId);
                    return '<button class="physio-move-up" data-eid="' + eid + '" title="Move up" style="cursor:pointer;background:none;border:none;font-size:14px;">\u25b2</button>'
                         + '<button class="physio-move-down" data-eid="' + eid + '" title="Move down" style="cursor:pointer;background:none;border:none;font-size:14px;">\u25bc</button>';
                }, { sortKey: false }),
                ...col.custom('_video', '', function(item) {
                    var eid = Layer8DUtils.escapeHtml(item.exerciseId);
                    return '<button class="physio-video-btn layer8d-btn layer8d-btn-small" data-eid="' + eid + '" title="Watch video">\u25b6</button>';
                }, { sortKey: false }),
                ...col.custom('_image', '', function(item) {
                    if (!item.imageStoragePath) return '';
                    var eid = Layer8DUtils.escapeHtml(item.exerciseId);
                    return '<img data-img-path="' + Layer8DUtils.escapeHtml(item.imageStoragePath) + '" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:4px;cursor:pointer;background:var(--layer8d-bg-light);" class="physio-exercise-thumb" data-eid="' + eid + '">';
                }, { sortKey: false })
            ];

            var result = self._buildCircuitRows(planExercises, exerciseMap);
            var circuitRowsMap = result.rows;
            var circuitLabels  = result.labels;
            var circuitKeys = Object.keys(circuitRowsMap).map(Number).sort(function(a, b) { return a - b; });

            circuitKeys.forEach(function(cNum) {
                var rows = circuitRowsMap[cNum];
                if (!rows || rows.length === 0) return;
                var label = circuitLabels[cNum] || (CATEGORY_LABELS[cNum] || ('Circuit ' + cNum));

                var header = document.createElement('div');
                header.className = 'physio-circuit-title';
                header.textContent = 'Circuit ' + cNum + ' \u2014 ' + label;
                container.appendChild(header);

                var wrap = document.createElement('div');
                wrap.id = 'physio-circuit-table-' + cNum;
                wrap.className = 'physio-circuit-table-wrap';
                container.appendChild(wrap);

                // Event delegation for move buttons — attached once, survives re-renders
                (function(w, cn) {
                    w.addEventListener('click', function(e) {
                        var prog = e.target.closest('.physio-progress-btn');
                        if (prog) { e.stopPropagation(); self._swapExercise(prog.dataset.eid, 'progression'); return; }
                        var reg = e.target.closest('.physio-regress-btn');
                        if (reg) { e.stopPropagation(); self._swapExercise(reg.dataset.eid, 'regression'); return; }
                        var rot = e.target.closest('.physio-rotate-btn');
                        if (rot) { e.stopPropagation(); self._openRotatePopup(rot.dataset.eid); return; }
                        var up = e.target.closest('.physio-move-up');
                        if (up) { e.stopPropagation(); self._moveExercise(cn, up.dataset.eid, -1); return; }
                        var down = e.target.closest('.physio-move-down');
                        if (down) { e.stopPropagation(); self._moveExercise(cn, down.dataset.eid, 1); return; }
                        var vid = e.target.closest('.physio-video-btn');
                        if (vid) { e.stopPropagation(); self._showVideoPopup(vid.dataset.eid); return; }
                        var thumb = e.target.closest('.physio-exercise-thumb');
                        if (thumb) { e.stopPropagation(); self._showImagePopup(thumb.dataset.eid); return; }
                    });
                    w.addEventListener('change', function(e) {
                        var sel = e.target.closest('.physio-load-select');
                        if (sel) {
                            var eid = sel.dataset.eid;
                            var pe = (self._currentPlan.exercises || []).filter(function(ex) { return ex.exerciseId === eid; })[0];
                            if (pe) { pe.loadType = parseInt(sel.value, 10) || 0; self._savePlan(); }
                            return;
                        }
                        var val = e.target.closest('.physio-value-input');
                        if (val) {
                            var veid = val.dataset.eid;
                            var field = val.dataset.field;
                            var vpe = (self._currentPlan.exercises || []).filter(function(ex) { return ex.exerciseId === veid; })[0];
                            if (vpe && field) { vpe[field] = parseInt(val.value, 10) || 0; self._savePlan(); }
                        }
                    });
                })(wrap, cNum);

                var table = new Layer8DTable({
                    containerId:  'physio-circuit-table-' + cNum,
                    columns:      planColumns,
                    primaryKey:   'exerciseId',
                    pageSize:     50,
                    serverSide:   false,
                    sortable:     false,
                    filterable:   false,
                    showActions:  canEdit,
                    onAdd:        canEdit ? (function(cn) { return function() { self._addExerciseToCircuit(cn); }; })(cNum) : null,
                    addButtonText: canEdit ? '+ Add Exercise' : undefined,
                    onEdit:       canEdit ? function(id) { self._editExercise(id); } : null,
                    onDelete:     canEdit ? function(id) { self._deleteExercise(id); } : null,
                    emptyMessage: 'No exercises.'
                });
                table.init();
                table.setData(rows);
                self._circuitTables[cNum] = table;
                PhysioClientExerciseInfo.loadAuthImages(wrap);
            });
        },

        _savePlan: function() {
            var self = this;
            if (self._originals && self._currentPlan && self._exerciseMap) {
                PhysioPlanActions.logChanges(self._currentPlan, self._currentPlan.exercises || [], self._exerciseMap, self._originals);
            }
            PhysioPlanActions.save(self._currentPlan, function() {
                var result = self._buildCircuitRows(self._currentPlan.exercises, self._exerciseMap || {});
                Object.keys(self._circuitTables).forEach(function(key) {
                    self._circuitTables[key].setData(result.rows[parseInt(key, 10)] || []);
                });
                var info = document.getElementById('physio-info-pane');
                if (info && self._exerciseMap) {
                    self._renderExerciseInfo(self._currentPlan, self._currentPlan.exercises, self._exerciseMap, info);
                }
            });
        },

        _editExercise: function(exerciseId) {
            var self = this;
            var pe = ((self._currentPlan && self._currentPlan.exercises) || []).filter(function(e) { return e.exerciseId === exerciseId; })[0];
            if (!pe) return;
            var exName = ((self._exerciseMap || {})[pe.exerciseId] || {}).name || pe.exerciseId;
            var r = function(l, h) { return '<div class="wb-af-row"><label class="wb-af-label">' + l + '</label>' + h + '</div>'; };
            var loadSelect = PhysioPlanActions.loadTypeSelect(pe.loadType || ((self._exerciseMap || {})[pe.exerciseId] || {}).loadType || 0, '', ' id="pe-edit-load"');
            var html = '<div class="wb-assign-form">'
                + r('Exercise', '<div class="wb-af-static">' + Layer8DUtils.escapeHtml(exName) + '</div>')
                + r('Sets', '<input type="number" id="pe-edit-sets" class="wb-af-input" min="1" max="20" value="' + (pe.sets || '') + '">')
                + r('Reps', '<input type="number" id="pe-edit-reps" class="wb-af-input" min="1" max="100" value="' + (pe.reps || '') + '">')
                + r('Load', loadSelect)
                + r('Notes', '<input type="text" id="pe-edit-notes" class="wb-af-input" value="' + Layer8DUtils.escapeHtml(pe.notes || '') + '">') + '</div>';
            Layer8DPopup.show({
                title: 'Edit Exercise', content: html, size: 'small', showFooter: true, saveButtonText: 'Save',
                onSave: function() {
                    var b = Layer8DPopup.getBody();
                    var q = function(id) { return b ? b.querySelector('#' + id) : document.getElementById(id); };
                    pe.sets = parseInt(q('pe-edit-sets').value, 10) || 0;
                    pe.reps = parseInt(q('pe-edit-reps').value, 10) || 0;
                    pe.loadType = parseInt(q('pe-edit-load').value, 10) || 0;
                    pe.notes = q('pe-edit-notes').value.trim();
                    Layer8DPopup.close();
                    self._savePlan();
                }
            });
        },

        _deleteExercise: function(exerciseId) {
            var self = this;
            if (!self._currentPlan) return;
            var pe = self._currentPlan.exercises.filter(function(e) { return e.exerciseId === exerciseId; })[0];
            if (pe) PhysioPlanActions.remove(self._currentPlan.exercises, pe);
            self._savePlan();
        },

        _moveExercise: function(circuitNumber, exerciseId, dir) {
            var self = this;
            if (!self._currentPlan) return;
            var pe = self._currentPlan.exercises.filter(function(e) {
                return e.exerciseId === exerciseId && e.circuitNumber === circuitNumber;
            })[0];
            if (pe && PhysioPlanActions.move(self._currentPlan.exercises, self._exerciseMap || {}, pe, dir)) {
                self._savePlan();
            }
        },

        _swapExercise: function(exerciseId, direction) {
            var self = this;
            if (!self._currentPlan || !self._exerciseMap) return;
            var pe = (self._currentPlan.exercises || []).filter(function(e) { return e.exerciseId === exerciseId; })[0];
            if (!pe) return;
            var result = PhysioPlanActions.swap(self._exerciseMap, pe, direction, self._currentPlan.planId, self._currentPlan.clientId);
            if (result) self._savePlan();
        },

        _openRotatePopup: function(exerciseId) {
            var self = this;
            if (!self._currentPlan || !self._exerciseMap) return;
            var pe = (self._currentPlan.exercises || []).filter(function(e) { return e.exerciseId === exerciseId; })[0];
            if (!pe) return;
            PhysioPlanActions.openRotatePopup(self._exerciseMap, pe, self._planJoints, self._currentPlan.planId, self._currentPlan.clientId, function() { self._savePlan(); });
        },

        _showVideoPopup: function(exerciseId) {
            PhysioClientExerciseInfo.showVideoPopup(exerciseId, this._exerciseMap);
        },

        _showImagePopup: function(exerciseId) {
            PhysioClientExerciseInfo.showImagePopup(exerciseId, this._exerciseMap);
        },

        // _addExerciseToCircuit, _wireWbButton, _renderDetails defined in clients-exercises-actions.js

        _renderExerciseInfo: function(plan, planExercises, exerciseMap, container) {
            PhysioClientExerciseInfo.render(plan, planExercises, exerciseMap, container);
        }
    };

})();
