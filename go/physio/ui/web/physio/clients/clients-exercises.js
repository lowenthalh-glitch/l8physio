(function() {
    'use strict';

    var CATEGORY_LABELS = { 1: 'Mobility', 2: 'Rehab', 3: 'Strength', 4: 'Functional' };
    var CIRCUIT_ORDER   = [1, 2, 3, 4];

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
                  '<div class="physio-exercises-loading">Loading workout plan\u2026</div>',
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

                    self._loadPlan(client, body.querySelector('#physio-exercises-pane'), body.querySelector('#physio-info-pane'));
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
                    // Fetch all exercises for this joint (filter posture client-side)
                    var q2 = encodeURIComponent(JSON.stringify({ text: 'select * from PhysioExercise where joint=' + joint + ' limit 500' }));
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

        // ── Build merged row data grouped by circuit category ──────────────────
        _buildCircuitRows: function(planExercises, exerciseMap) {
            var map = {};
            planExercises.forEach(function(pe) {
                var fullEx = exerciseMap[pe.exerciseId] || {};
                var cat = fullEx.category || 0;
                if (!map[cat]) map[cat] = [];
                map[cat].push({
                    planExerciseId: pe.planExerciseId,
                    exerciseId:     pe.exerciseId,
                    name:           fullEx.name || pe.exerciseId || '\u2014',
                    sets:           pe.sets  || fullEx.defaultSets  || '\u2014',
                    reps:           pe.reps  || fullEx.defaultRepsDisplay || String(fullEx.defaultReps || '') || '\u2014',
                    notes:          pe.notes || '',
                    exerciseType:   fullEx.exerciseType || 0,
                    _category:      fullEx.category || 0,
                    _orderIndex:    pe.orderIndex || 0
                });
            });

            // Sort within each category: Fixed (1) first, then Variable (2), then by orderIndex
            Object.keys(map).forEach(function(cat) {
                map[cat].sort(function(a, b) {
                    if (a.exerciseType !== b.exerciseType) return a.exerciseType - b.exerciseType;
                    return a._orderIndex - b._orderIndex;
                });
            });

            return map;
        },

        // ── Render four Layer8DTable instances (one per circuit) ───────────────
        _renderPlanTable: function(plan, planExercises, exerciseMap, container) {
            var self = this;

            // Plan header
            var statusLabels = { 1: 'Draft', 2: 'Active', 3: 'Completed', 4: 'Cancelled' };
            var statusCls    = { 1: 'physio-plan-status-draft', 2: 'physio-plan-status-active', 3: 'physio-plan-status-done', 4: 'physio-plan-status-done' };
            var st = plan.status || 0;
            var startStr = plan.startDate ? Layer8DUtils.formatDate(plan.startDate) : '';

            var headerHtml = '<div class="physio-plan-header">';
            headerHtml += '<div class="physio-plan-title">' + Layer8DUtils.escapeHtml(plan.title || 'Workout Plan') + '</div>';
            headerHtml += '<div class="physio-plan-meta">';
            if (st) headerHtml += '<span class="physio-plan-status ' + (statusCls[st] || '') + '">' + (statusLabels[st] || '') + '</span>';
            if (startStr) headerHtml += '<span class="physio-plan-date">Start: ' + startStr + '</span>';
            headerHtml += '</div></div>';

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
                         + ' data-id="' + Layer8DUtils.escapeHtml(item.planExerciseId) + '"'
                         + ' data-category="' + item._category + '">Change</button>';
                }, { sortKey: false })
            ];

            var circuitRowsMap = self._buildCircuitRows(planExercises, exerciseMap);

            CIRCUIT_ORDER.forEach(function(cat) {
                var rows = circuitRowsMap[cat];
                if (!rows || rows.length === 0) return;

                var label = CATEGORY_LABELS[cat];

                // Circuit header
                var header = document.createElement('div');
                header.className = 'physio-circuit-title';
                header.textContent = 'Circuit \u2014 ' + label;
                container.appendChild(header);

                // Table wrapper
                var wrap = document.createElement('div');
                wrap.id = 'physio-circuit-table-' + cat;
                wrap.className = 'physio-circuit-table-wrap';
                container.appendChild(wrap);

                var table = new Layer8DTable({
                    containerId:  'physio-circuit-table-' + cat,
                    columns:      planColumns,
                    primaryKey:   'planExerciseId',
                    pageSize:     50,
                    serverSide:   false,
                    sortable:     true,
                    filterable:   false,
                    showActions:  false,
                    emptyMessage: 'No exercises.',
                    onDataLoaded: (function(w) {
                        return function() {
                            w.querySelectorAll('.physio-change-btn').forEach(function(btn) {
                                btn.addEventListener('click', function(e) {
                                    e.stopPropagation();
                                    self._showSwapPopup(btn.dataset.id, parseInt(btn.dataset.category, 10));
                                });
                            });
                        };
                    })(wrap)
                });
                table.init();
                table.setData(rows);

                self._circuitTables[cat] = table;
            });
        },

        // ── Swap picker popup ──────────────────────────────────────────────────
        _showSwapPopup: function(planExerciseId, category) {
            var self = this;
            var pe = (self._currentPlan.exercises || []).filter(function(e) {
                return e.planExerciseId === planExerciseId;
            })[0];
            if (!pe) return;

            var pool = (self._allVariableExercises || []).filter(function(ex) {
                return ex.category === category && ex.exerciseId !== pe.exerciseId;
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

        // ── Swap a variable exercise and save the plan ─────────────────────────
        _swapExercise: function(planExIdx, newEx) {
            var self = this;
            var plan = self._currentPlan;
            if (!plan || !plan.exercises[planExIdx]) return;

            plan.exercises[planExIdx].exerciseId = newEx.exerciseId;
            plan.exercises[planExIdx].sets = newEx.defaultSets || plan.exercises[planExIdx].sets;
            plan.exercises[planExIdx].reps = newEx.defaultReps || plan.exercises[planExIdx].reps;
            plan.exercises[planExIdx].notes = newEx.loadNotes  || plan.exercises[planExIdx].notes;

            // Update exerciseMap with the new exercise data
            if (self._exerciseMap) {
                self._exerciseMap[newEx.exerciseId] = newEx;
            }

            var url = _apiPrefix() + '/50/PhyPlan';
            fetch(url, {
                method: 'PUT',
                headers: Object.assign({}, _headers(), { 'Content-Type': 'application/json' }),
                body: JSON.stringify(plan)
            })
            .then(function(r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                Layer8DNotification.success('Exercise updated.');

                // Rebuild circuit rows and refresh each table in place (no re-fetch)
                var circuitRowsMap = self._buildCircuitRows(self._currentPlan.exercises, self._exerciseMap || {});
                Object.keys(self._circuitTables).forEach(function(cat) {
                    var rows = circuitRowsMap[parseInt(cat, 10)] || [];
                    self._circuitTables[cat].setData(rows);
                });

                // Refresh info pane directly
                var infoPane = document.getElementById('physio-info-pane');
                if (infoPane && self._exerciseMap) {
                    self._renderExerciseInfo(
                        self._currentPlan, self._currentPlan.exercises, self._exerciseMap, infoPane
                    );
                }
            })
            .catch(function(e) { Layer8DNotification.error('Failed to save: ' + e.message); });
        },

        // ── Exercise Info & Videos tab ─────────────────────────────────────────
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
