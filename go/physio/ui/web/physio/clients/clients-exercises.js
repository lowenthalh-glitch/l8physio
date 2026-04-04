(function() {
    'use strict';

    var CATEGORY_LABELS = { 1: 'Mobility', 2: 'Rehab', 3: 'Strength', 4: 'Functional' };

    function _apiPrefix() {
        return Layer8DConfig.getApiPrefix();
    }

    function _headers() {
        return getAuthHeaders();
    }

    function _fetch(url) {
        return fetch(url, { method: 'GET', headers: _headers() }).then(function(r) { return r.json(); });
    }

    // ── Video helpers ──────────────────────────────────────────────────────────

    function _extractYoutubeId(url) {
        var m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        return m ? m[1] : null;
    }

    function _renderVideoHtml(videoPath) {
        if (!videoPath) {
            return '<div class="physio-no-video">No video available</div>';
        }

        var ytId = _extractYoutubeId(videoPath);
        if (ytId) {
            return '<div class="physio-video-wrapper">' +
                '<iframe src="https://www.youtube.com/embed/' + ytId + '" ' +
                'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
                'allowfullscreen></iframe></div>';
        }

        var vimeoMatch = videoPath.match(/vimeo\.com\/(\d+)/);
        if (vimeoMatch) {
            return '<div class="physio-video-wrapper">' +
                '<iframe src="https://player.vimeo.com/video/' + vimeoMatch[1] + '" allowfullscreen></iframe></div>';
        }

        if (/^https?:\/\//i.test(videoPath)) {
            return '<div class="physio-video-wrapper">' +
                '<video controls style="position:absolute;top:0;left:0;width:100%;height:100%">' +
                '<source src="' + Layer8DUtils.escapeHtml(videoPath) + '">' +
                '</video></div>';
        }

        // Local storage path — offer a download link via API
        return '<div class="physio-no-video">' +
            '<a href="' + Layer8DConfig.getApiPrefix() + '/0/FileStore?path=' + encodeURIComponent(videoPath) + '" ' +
            'target="_blank" class="physio-video-link">\u25b6 View Video</a></div>';
    }

    // PhysioClientExercises — popup for viewing/editing a client's assigned treatment plan exercises
    window.PhysioClientExercises = {

        _currentPlan: null,
        _allVariableExercises: null, // cached alternative exercises for swapping
        _exerciseMap: null,          // cached full exercise data for info tab
        _circuitTables: {},          // map of category -> Layer8DTable instance

        open: function(clientId) {
            var self = this;
            self._currentPlan = null;
            self._allVariableExercises = null;
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
                    body.querySelectorAll('.physio-client-tab').forEach(function(btn) {
                        btn.addEventListener('click', function() {
                            body.querySelectorAll('.physio-client-tab').forEach(function(b) { b.classList.remove('active'); });
                            body.querySelectorAll('.physio-client-tab-pane').forEach(function(p) { p.classList.remove('active'); });
                            btn.classList.add('active');
                            var target = body.querySelector('#physio-' + btn.dataset.tab + '-pane');
                            if (target) target.classList.add('active');
                        });
                    });

                    var exercisesPane  = body.querySelector('#physio-exercises-pane');
                    var contentPane    = body.querySelector('#physio-exercises-pane-content');
                    var infoPane       = body.querySelector('#physio-info-pane');

                    self._wireWbButton(exercisesPane, contentPane, client, infoPane);
                    self._loadPlan(client, contentPane, infoPane);
                    self._renderDetails(client, body.querySelector('#physio-details-pane .physio-details-content'));
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

                // Bootstrap: fetch first exercise to get joint/posture
                var firstId = exercises[0].exerciseId;
                var q1 = encodeURIComponent(JSON.stringify({ text: 'select * from PhysioExercise where exerciseId=' + firstId }));
                return _fetch(_apiPrefix() + '/50/PhyExercis?body=' + q1)
                .then(function(d) {
                    var seed = (d.list || [])[0];
                    if (!seed) {
                        self._renderPlanTable(plan, exercises, {}, container);
                        if (infoContainer) self._renderExerciseInfo(plan, exercises, {}, infoContainer);
                        return;
                    }
                    var joint = seed.joint;
                    var posture = seed.posture;
                    // Fetch exercises — filter by joint if available, otherwise fetch all
                    var queryText = joint
                        ? 'select * from PhysioExercise where joint=' + joint + ' limit 500'
                        : 'select * from PhysioExercise limit 500';
                    var q2 = encodeURIComponent(JSON.stringify({ text: queryText }));
                    return _fetch(_apiPrefix() + '/50/PhyExercis?body=' + q2)
                    .then(function(d2) {
                        var exerciseMap = {};
                        var variablePool = [];
                        (d2.list || []).forEach(function(ex) {
                            if (ex.posture === posture) {
                                exerciseMap[ex.exerciseId] = ex;
                                if (ex.exerciseType === 2) variablePool.push(ex);
                            }
                        });
                        self._allVariableExercises = variablePool;
                        self._exerciseMap = exerciseMap;
                        self._renderPlanTable(plan, exercises, exerciseMap, container);
                        if (infoContainer) self._renderExerciseInfo(plan, exercises, exerciseMap, infoContainer);
                    });
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
                    _circuitNumber: cNum,
                    _orderIndex:    pe.orderIndex || 0
                });
            });
            Object.keys(map).forEach(function(k) {
                map[k].sort(function(a, b) {
                    if (a.exerciseType !== b.exerciseType) return a.exerciseType - b.exerciseType;
                    return a._orderIndex - b._orderIndex;
                });
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
                ...col.custom('_change', '', function(item) {
                    if (item.exerciseType !== 2) return '';
                    return '<button class="physio-change-btn layer8d-btn layer8d-btn-secondary layer8d-btn-small"'
                         + ' data-id="' + Layer8DUtils.escapeHtml(item.planExerciseId) + '">Change</button>';
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

                var table = new Layer8DTable({
                    containerId:  'physio-circuit-table-' + cNum,
                    columns:      planColumns,
                    primaryKey:   'planExerciseId',
                    pageSize:     50,
                    serverSide:   false,
                    sortable:     true,
                    filterable:   false,
                    showActions:  true,
                    onEdit:       function(id) { self._editExercise(id); },
                    onDelete:     function(id) { self._deleteExercise(id); },
                    emptyMessage: 'No exercises.',
                    onDataLoaded: (function(w) {
                        return function() {
                            w.querySelectorAll('.physio-change-btn').forEach(function(btn) {
                                btn.addEventListener('click', function(e) {
                                    e.stopPropagation();
                                    self._showSwapPopup(btn.dataset.id);
                                });
                            });
                        };
                    })(wrap)
                });
                table.init();
                table.setData(rows);
                self._circuitTables[cNum] = table;
            });
        },

        _showSwapPopup: function(planExerciseId) {
            var self = this;
            var pe = (self._currentPlan.exercises || []).filter(function(e) {
                return e.planExerciseId === planExerciseId;
            })[0];
            if (!pe) return;

            var pool = (self._allVariableExercises || []).filter(function(ex) {
                return ex.exerciseId !== pe.exerciseId;
            });

            var listHtml = pool.length === 0
                ? '<p class="physio-picker-empty">No alternatives available.</p>'
                : pool.map(function(ex) {
                      return '<div class="physio-picker-item" data-ex-id="' + Layer8DUtils.escapeHtml(ex.exerciseId) + '">'
                           + Layer8DUtils.escapeHtml(ex.name || ex.exerciseId) + '</div>';
                  }).join('');

            Layer8DPopup.show({
                title:      'Swap Exercise',
                content:    '<div class="physio-picker-list">' + listHtml + '</div>',
                size:       'small',
                showFooter: false,
                onShow: function(body) {
                    body.querySelectorAll('.physio-picker-item').forEach(function(item) {
                        item.addEventListener('click', function() {
                            Layer8DPopup.close();
                            var newEx = pool.filter(function(ex) { return ex.exerciseId === item.dataset.exId; })[0];
                            if (newEx) {
                                var idx = self._currentPlan.exercises.indexOf(pe);
                                self._swapExercise(idx, newEx);
                            }
                        });
                    });
                }
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

        _swapExercise: function(planExIdx, newEx) {
            var self = this;
            var plan = self._currentPlan;
            if (!plan || !plan.exercises[planExIdx]) return;
            var pe = plan.exercises[planExIdx];
            pe.exerciseId = newEx.exerciseId;
            pe.sets  = newEx.defaultSets || pe.sets;
            pe.reps  = newEx.defaultReps || pe.reps;
            pe.notes = newEx.loadNotes   || pe.notes;
            if (self._exerciseMap) self._exerciseMap[newEx.exerciseId] = newEx;
            self._savePlan();
        },

        _editExercise: function(planExerciseId) {
            var self = this;
            var pe = ((self._currentPlan && self._currentPlan.exercises) || []).filter(function(e) { return e.planExerciseId === planExerciseId; })[0];
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

        _deleteExercise: function(planExerciseId) {
            var self = this;
            if (!self._currentPlan) return;
            self._currentPlan.exercises = self._currentPlan.exercises.filter(function(e) {
                return e.planExerciseId !== planExerciseId;
            });
            self._savePlan();
        },

        _renderExerciseInfo: function(plan, planExercises, exerciseMap, container) {
            var ordered = planExercises.slice().sort(function(a, b) {
                return (a.orderIndex || 0) - (b.orderIndex || 0);
            });

            if (ordered.length === 0) {
                container.innerHTML = '<div class="physio-no-protocol">No exercises in this plan.</div>';
                return;
            }

            var html = '<div class="physio-exercise-grid">';
            ordered.forEach(function(pe) {
                var ex   = exerciseMap[pe.exerciseId] || {};
                var name = ex.name || pe.exerciseId || '\u2014';
                var sets = pe.sets || ex.defaultSets || '';
                var reps = pe.reps || ex.defaultRepsDisplay || (ex.defaultReps ? String(ex.defaultReps) : '') || '';

                html += '<div class="physio-exercise-card">';

                // Video / placeholder area
                html += _renderVideoHtml(ex.videoStoragePath || '');

                // Info section
                html += '<div class="physio-exercise-info">';
                html += '<div class="physio-exercise-name">' + Layer8DUtils.escapeHtml(name) + '</div>';

                // Prescription badges
                if (sets || reps) {
                    html += '<div class="physio-exercise-prescription">';
                    if (sets) html += '<span class="physio-rx-badge">' + Layer8DUtils.escapeHtml(String(sets)) + ' sets</span>';
                    if (reps) html += '<span class="physio-rx-badge">' + Layer8DUtils.escapeHtml(String(reps)) + ' reps</span>';
                    html += '</div>';
                }

                if (ex.description)       html += '<div class="physio-exercise-desc">'         + Layer8DUtils.escapeHtml(ex.description) + '</div>';
                if (ex.instructions)      html += '<div class="physio-exercise-instructions"><strong>Instructions:</strong> ' + Layer8DUtils.escapeHtml(ex.instructions) + '</div>';
                if (ex.muscleGroup)       html += '<div class="physio-exercise-meta"><strong>Muscle Group:</strong> ' + Layer8DUtils.escapeHtml(ex.muscleGroup) + '</div>';
                if (ex.equipment)         html += '<div class="physio-exercise-meta"><strong>Equipment:</strong> '    + Layer8DUtils.escapeHtml(ex.equipment) + '</div>';
                if (ex.effort)            html += '<div class="physio-exercise-meta"><strong>Effort:</strong> '       + Layer8DUtils.escapeHtml(String(ex.effort)) + '</div>';
                if (ex.contraindications) html += '<div class="physio-exercise-meta physio-exercise-meta-warn"><strong>Contraindications:</strong> ' + Layer8DUtils.escapeHtml(ex.contraindications) + '</div>';
                if (ex.loadNotes)         html += '<div class="physio-exercise-notes">'         + Layer8DUtils.escapeHtml(ex.loadNotes) + '</div>';
                if (pe.notes)             html += '<div class="physio-exercise-notes"><strong>Plan note:</strong> '  + Layer8DUtils.escapeHtml(pe.notes) + '</div>';

                html += '</div>'; // physio-exercise-info
                html += '</div>'; // physio-exercise-card
            });
            html += '</div>'; // physio-exercise-grid

            container.innerHTML = html;
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

        // ── Client details form (read-only) ────────────────────────────────────
        _renderDetails: function(client, container) {
            var formDef = (PhysioManagement.forms || {}).PhysioClient;
            if (!formDef) { container.innerHTML = '<p>Form definition not available.</p>'; return; }
            var html = Layer8DForms.generateFormHtml(formDef, client);
            container.innerHTML = html;
            container.querySelectorAll('input, select, textarea').forEach(function(el) { el.disabled = true; });
            Layer8DForms.attachDatePickers(container);
            Layer8DForms.attachReferencePickers(container);
        }
    };

})();
