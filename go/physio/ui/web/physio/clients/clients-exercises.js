(function() {
    'use strict';

    var CATEGORY_LABELS = { 1: 'Mobility', 2: 'Rehab', 3: 'Strength', 4: 'Functional' };

    function _apiPrefix() { return Layer8DConfig.getApiPrefix(); }
    function _headers() { return getAuthHeaders(); }
    function _fetch(url) { return fetch(url, { method: 'GET', headers: _headers() }).then(function(r) { return r.json(); }); }

    // PhysioClientExercises — popup for viewing/editing a client's assigned treatment plan exercises
    window.PhysioClientExercises = {

        _currentPlan: null,
        _exerciseMap: null,          // cached full exercise data for info tab
        _planJoint: null,            // joint from the plan's first exercise
        _planPosture: null,          // posture from the plan's first exercise
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
                  '<div class="physio-wb-toolbar">',
                    '<button class="layer8d-btn layer8d-btn-secondary layer8d-btn-small" id="physio-wb-open-btn">\uD83D\uDD28 Workout Builder</button>',
                  '</div>',
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
            var query = encodeURIComponent(JSON.stringify({ text: 'select * from TreatmentPlan where clientId=' + client.clientId }));
            _fetch(_apiPrefix() + '/50/PhyPlan?body=' + query)
            .then(function(data) {
                var plans = (data.list || []).filter(function(p) { return p.status === 2; });
                var plan  = plans.length > 0 ? plans[0] : null;

                if (!plan) {
                    var noplan = '<div class="physio-no-protocol">No active workout plan assigned to this client yet.<br><span style="font-size:12px;color:var(--layer8d-text-muted)">Use the Workout Builder tab to create and assign a plan.</span></div>';
                    container.innerHTML = noplan;
                    if (infoContainer) infoContainer.innerHTML = noplan;
                    return;
                }
                self._currentPlan = plan;

                var exercises = plan.exercises || [];
                if (exercises.length === 0) {
                    container.innerHTML = '<div class="physio-no-protocol">Plan <strong>' + Layer8DUtils.escapeHtml(plan.title || '') + '</strong> has no exercises yet.</div>';
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

                    // Detect plan's joint/posture from first exercise (for add-exercise filtering)
                    var seed = exerciseMap[exercises[0].exerciseId];
                    self._planJoint = null;
                    self._planPosture = null;
                    if (seed) {
                        self._planJoint = seed.joint;
                        self._planPosture = seed.posture;
                    }
                    self._exerciseMap = exerciseMap;
                    self._renderPlanTable(plan, exercises, exerciseMap, container);
                    if (infoContainer) self._renderExerciseInfo(plan, exercises, exerciseMap, infoContainer);
                });
            })
            .catch(function(err) {
                container.innerHTML = '<div class="physio-no-protocol">Failed to load plan: ' + Layer8DUtils.escapeHtml(err.message) + '</div>';
            });
        },

        _buildCircuitRows: function(planExercises, exerciseMap) {
            var map = {};
            var labels = {};
            planExercises.forEach(function(pe) {
                var fullEx = exerciseMap[pe.exerciseId] || {};
                var cNum = pe.circuitNumber || 0;
                if (!map[cNum]) map[cNum] = [];
                if (pe.circuitLabel) labels[cNum] = pe.circuitLabel;
                map[cNum].push({
                    planExerciseId: pe.planExerciseId,
                    exerciseId:     pe.exerciseId,
                    name:           fullEx.name || pe.exerciseId || '\u2014',
                    sets:           pe.sets  || fullEx.defaultSets  || '\u2014',
                    reps:           pe.reps  || fullEx.defaultRepsDisplay || String(fullEx.defaultReps || '') || '\u2014',
                    notes:          pe.notes || '',
                    exerciseType:   fullEx.exerciseType || 0,
                    imageStoragePath: fullEx.imageStoragePath || '',
                    _circuitNumber: cNum,
                    _orderIndex:    pe.orderIndex || 0
                });
            });
            Object.keys(map).forEach(function(k) {
                map[k].sort(function(a, b) {
                    if (a.exerciseType !== b.exerciseType) return a.exerciseType - b.exerciseType;
                    return a._orderIndex - b._orderIndex;
                });
                // Normalize orderIndex to match display order
                for (var ri = 0; ri < map[k].length; ri++) {
                    map[k][ri]._orderIndex = ri + 1;
                    // Sync back to plan exercises
                    var pe = planExercises.filter(function(p) { return p.exerciseId === map[k][ri].exerciseId && (p.circuitNumber || 0) === parseInt(k, 10); })[0];
                    if (pe) pe.orderIndex = ri + 1;
                }
            });
            return { rows: map, labels: labels };
        },

        _renderPlanTable: function(plan, planExercises, exerciseMap, container) {
            var self = this;

            // Plan header
            var statusLabels = { 1: 'Draft', 2: 'Active', 3: 'Completed', 4: 'Cancelled' };
            var statusCls    = { 1: 'physio-plan-status-draft', 2: 'physio-plan-status-active', 3: 'physio-plan-status-done', 4: 'physio-plan-status-done' };
            var st = plan.status || 0;
            var startStr = plan.startDate ? Layer8DUtils.formatDate(plan.startDate) : '';

            var headerHtml = '<div class="physio-plan-header"><div class="physio-plan-title">' + Layer8DUtils.escapeHtml(plan.title || 'Workout Plan') + '</div><div class="physio-plan-meta">'
                + (st ? '<span class="physio-plan-status ' + (statusCls[st] || '') + '">' + (statusLabels[st] || '') + '</span>' : '')
                + (startStr ? '<span class="physio-plan-date">Start: ' + startStr + '</span>' : '') + '</div></div>';

            container.innerHTML = headerHtml;

            // Reset stored tables for this render pass
            self._circuitTables = {};

            var col = window.Layer8ColumnFactory;
            var planColumns = [
                ...col.col('name',  'Exercise'),
                ...col.col('sets',  'Sets'),
                ...col.col('reps',  'Reps'),
                ...col.custom('exerciseType', 'Type', function(item) {
                    return item.exerciseType === 1
                        ? '<span class="physio-type-badge physio-type-fixed">Fixed</span>'
                        : '<span class="physio-type-badge physio-type-variable">Variable</span>';
                }, { sortKey: false }),
                ...col.col('notes', 'Notes'),
                ...col.custom('_order', '', function(item) {
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
                        var up = e.target.closest('.physio-move-up');
                        if (up) { e.stopPropagation(); self._moveExercise(cn, up.dataset.eid, -1); return; }
                        var down = e.target.closest('.physio-move-down');
                        if (down) { e.stopPropagation(); self._moveExercise(cn, down.dataset.eid, 1); return; }
                        var vid = e.target.closest('.physio-video-btn');
                        if (vid) { e.stopPropagation(); self._showVideoPopup(vid.dataset.eid); return; }
                        var thumb = e.target.closest('.physio-exercise-thumb');
                        if (thumb) { e.stopPropagation(); self._showImagePopup(thumb.dataset.eid); return; }
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
                    showActions:  true,
                    onAdd:        (function(cn) { return function() { self._addExerciseToCircuit(cn); }; })(cNum),
                    addButtonText: '+ Add Exercise',
                    onEdit:       function(id) { self._editExercise(id); },
                    onDelete:     function(id) { self._deleteExercise(id); },
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
            fetch(_apiPrefix() + '/50/PhyPlan', {
                method: 'PUT',
                headers: Object.assign({}, _headers(), { 'Content-Type': 'application/json' }),
                body: JSON.stringify(self._currentPlan)
            })
            .then(function(r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                Layer8DNotification.success('Plan saved.');
                var result = self._buildCircuitRows(self._currentPlan.exercises, self._exerciseMap || {});
                Object.keys(self._circuitTables).forEach(function(key) {
                    self._circuitTables[key].setData(result.rows[parseInt(key, 10)] || []);
                });
                var info = document.getElementById('physio-info-pane');
                if (info && self._exerciseMap) {
                    self._renderExerciseInfo(self._currentPlan, self._currentPlan.exercises, self._exerciseMap, info);
                }
            })
            .catch(function(e) { Layer8DNotification.error('Failed to save: ' + e.message); });
        },

        _editExercise: function(exerciseId) {
            var self = this;
            var pe = ((self._currentPlan && self._currentPlan.exercises) || []).filter(function(e) { return e.exerciseId === exerciseId; })[0];
            if (!pe) return;
            var exName = ((self._exerciseMap || {})[pe.exerciseId] || {}).name || pe.exerciseId;
            var r = function(l, h) { return '<div class="wb-af-row"><label class="wb-af-label">' + l + '</label>' + h + '</div>'; };
            var html = '<div class="wb-assign-form">'
                + r('Exercise', '<div class="wb-af-static">' + Layer8DUtils.escapeHtml(exName) + '</div>')
                + r('Sets', '<input type="number" id="pe-edit-sets" class="wb-af-input" min="1" max="20" value="' + (pe.sets || '') + '">')
                + r('Reps', '<input type="number" id="pe-edit-reps" class="wb-af-input" min="1" max="100" value="' + (pe.reps || '') + '">')
                + r('Notes', '<input type="text" id="pe-edit-notes" class="wb-af-input" value="' + Layer8DUtils.escapeHtml(pe.notes || '') + '">') + '</div>';
            Layer8DPopup.show({
                title: 'Edit Exercise', content: html, size: 'small', showFooter: true, saveButtonText: 'Save',
                onSave: function() {
                    var b = Layer8DPopup.getBody();
                    var q = function(id) { return b ? b.querySelector('#' + id) : document.getElementById(id); };
                    pe.sets = parseInt(q('pe-edit-sets').value, 10) || 0;
                    pe.reps = parseInt(q('pe-edit-reps').value, 10) || 0;
                    pe.notes = q('pe-edit-notes').value.trim();
                    Layer8DPopup.close();
                    self._savePlan();
                }
            });
        },

        _deleteExercise: function(exerciseId) {
            var self = this;
            if (!self._currentPlan) return;
            self._currentPlan.exercises = self._currentPlan.exercises.filter(function(e) {
                return e.exerciseId !== exerciseId;
            });
            self._savePlan();
        },

        _moveExercise: function(circuitNumber, exerciseId, dir) {
            var self = this;
            if (!self._currentPlan) return;
            var exMap = self._exerciseMap || {};
            // Get exercises in this circuit sorted by orderIndex
            var circuitExs = (self._currentPlan.exercises || []).filter(function(pe) {
                return pe.circuitNumber === circuitNumber;
            }).sort(function(a, b) { return (a.orderIndex || 0) - (b.orderIndex || 0); });

            var idx = -1;
            for (var i = 0; i < circuitExs.length; i++) {
                if (circuitExs[i].exerciseId === exerciseId) { idx = i; break; }
            }
            if (idx === -1) return;
            var targetIdx = idx + dir;
            if (targetIdx < 0 || targetIdx >= circuitExs.length) return;

            var cur = circuitExs[idx];
            var tgt = circuitExs[targetIdx];
            var curType = (exMap[cur.exerciseId] || {}).exerciseType || 0;
            var tgtType = (exMap[tgt.exerciseId] || {}).exerciseType || 0;

            // Fixed must stay above Variable
            if (dir === -1 && curType === 2 && tgtType === 1) {
                Layer8DNotification.warning('Variable exercises cannot be placed above Fixed exercises.');
                return;
            }
            if (dir === 1 && curType === 1 && tgtType === 2) {
                Layer8DNotification.warning('Fixed exercises cannot be placed below Variable exercises.');
                return;
            }

            var tmpOrder = cur.orderIndex;
            cur.orderIndex = tgt.orderIndex;
            tgt.orderIndex = tmpOrder;
            self._savePlan();
        },

        _showVideoPopup: function(exerciseId) {
            PhysioClientExerciseInfo.showVideoPopup(exerciseId, this._exerciseMap);
        },

        _showImagePopup: function(exerciseId) {
            PhysioClientExerciseInfo.showImagePopup(exerciseId, this._exerciseMap);
        },

        _addExerciseToCircuit: function(circuitNumber) {
            var self = this;
            var exMap = self._exerciseMap || {};
            // Exclude exercises already in THIS circuit (prevent duplicates in same table)
            var existing = (self._currentPlan.exercises || []).filter(function(pe) {
                return (pe.circuitNumber || 0) === circuitNumber;
            }).map(function(pe) { return pe.exerciseId; });
            // Filter by category + joint + posture matching this circuit, exclude already-added
            var pJoint = self._planJoint;
            var pPosture = self._planPosture;
            var available = Object.values(exMap).filter(function(ex) {
                if (ex.category !== circuitNumber) return false;
                if (pJoint != null && ex.joint !== pJoint) return false;
                if (pPosture != null && ex.posture !== pPosture) return false;
                return existing.indexOf(ex.exerciseId) === -1;
            });
            var options = available.length === 0
                ? '<option value="">No exercises available</option>'
                : '<option value="">-- Select --</option>' + available.map(function(ex) {
                    return '<option value="' + Layer8DUtils.escapeHtml(ex.exerciseId) + '">'
                        + Layer8DUtils.escapeHtml(ex.name || ex.exerciseId) + '</option>';
                }).join('');
            var r = function(l, h) { return '<div class="wb-af-row"><label class="wb-af-label">' + l + '</label>' + h + '</div>'; };
            var html = '<div class="wb-assign-form">'
                + r('Exercise', '<select id="pe-add-ex-select" class="wb-af-input">' + options + '</select>')
                + r('Sets', '<input type="number" id="pe-add-sets" class="wb-af-input" min="1" max="20" value="3">')
                + r('Reps', '<input type="number" id="pe-add-reps" class="wb-af-input" min="1" max="100" value="12">')
                + r('Notes', '<input type="text" id="pe-add-notes" class="wb-af-input" value="">') + '</div>';
            Layer8DPopup.show({
                title: 'Add Exercise', content: html, size: 'small', showFooter: true, saveButtonText: 'Add',
                onSave: function() {
                    var b = Layer8DPopup.getBody();
                    var q = function(id) { return b ? b.querySelector('#' + id) : document.getElementById(id); };
                    var exerciseId = q('pe-add-ex-select').value;
                    if (!exerciseId) { Layer8DNotification.error('Please select an exercise'); return; }
                    var alreadyInCircuit = (self._currentPlan.exercises || []).some(function(pe) {
                        return pe.exerciseId === exerciseId && (pe.circuitNumber || 0) === circuitNumber;
                    });
                    if (alreadyInCircuit) { Layer8DNotification.warning('This exercise is already in this circuit'); return; }
                    var circuitLabel = (CATEGORY_LABELS[circuitNumber] || ('Circuit ' + circuitNumber));
                    var maxOrder = (self._currentPlan.exercises || []).reduce(function(mx, pe) {
                        return pe.circuitNumber === circuitNumber && pe.orderIndex > mx ? pe.orderIndex : mx;
                    }, 0);
                    self._currentPlan.exercises = self._currentPlan.exercises || [];
                    self._currentPlan.exercises.push({
                        planExerciseId: 'pe-' + Date.now(),
                        exerciseId:     exerciseId,
                        sets:           parseInt(q('pe-add-sets').value, 10) || 3,
                        reps:           parseInt(q('pe-add-reps').value, 10) || 12,
                        notes:          q('pe-add-notes').value.trim(),
                        orderIndex:     maxOrder + 1,
                        circuitNumber:  circuitNumber,
                        circuitLabel:   circuitLabel
                    });
                    Layer8DPopup.close();
                    self._savePlan();
                }
            });
        },

        _renderExerciseInfo: function(plan, planExercises, exerciseMap, container) {
            PhysioClientExerciseInfo.render(plan, planExercises, exerciseMap, container);
        },

        _wireWbButton: function(exercisesPane, contentPane, client, infoPane) {
            var self = this;
            var wbBtn = exercisesPane.querySelector('#physio-wb-open-btn');
            if (!wbBtn || !contentPane || !window.PhysioWorkoutBuilder) return;
            wbBtn.addEventListener('click', function() {
                var savedHtml = contentPane.innerHTML;
                contentPane.innerHTML = '<div id="physio-wb-container"></div>';
                PhysioWorkoutBuilder.setupInContainer(contentPane.querySelector('#physio-wb-container'), {
                    mode:      self._currentPlan ? 'edit' : 'new',
                    planId:    self._currentPlan ? self._currentPlan.planId : null,
                    clientId:  client.clientId,
                    onRefresh: function() { self._loadPlan(client, contentPane, infoPane); },
                    onCancel:  function() { contentPane.innerHTML = savedHtml; }
                });
            });
        },

        _renderDetails: function(client, container) {
            var formDef = (PhysioManagement.forms || {}).PhysioClient;
            if (!formDef) { container.innerHTML = '<p>Form definition not available.</p>'; return; }
            container.innerHTML = Layer8DForms.generateFormHtml(formDef, client);
            container.querySelectorAll('input, select, textarea').forEach(function(el) { el.disabled = true; });
            Layer8DForms.attachDatePickers(container);
            Layer8DForms.attachReferencePickers(container);
        }
    };

})();
