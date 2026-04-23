// Session View — multi-client workout plan popup for class events
// Triggered when a therapist clicks a BoostappCalendarEvent with participants
(function() {
    'use strict';

    function _apiPrefix() { return Layer8DConfig.getApiPrefix(); }
    function _headers() { return getAuthHeaders(); }
    function _fetch(url) { return fetch(url, { method: 'GET', headers: _headers() }).then(function(r) { return r.json(); }); }

    // Render a single client's active plan into a container (reused by dashboard detail popup)
    window.PhysioSessionPlanRenderer = {
        render: function(container, clientId) {
            if (!container) return;
            container.innerHTML = '<div style="padding:12px;color:var(--layer8d-text-muted);">Loading workout plan\u2026</div>';
            var clientQuery = encodeURIComponent(JSON.stringify({ text: 'select * from PhysioClient where clientId=' + clientId }));
            var planQuery = encodeURIComponent(JSON.stringify({ text: 'select * from TreatmentPlan where clientId=' + clientId }));
            Promise.all([
                _fetch(_apiPrefix() + '/50/PhyClient?body=' + clientQuery),
                _fetch(_apiPrefix() + '/50/PhyPlan?body=' + planQuery)
            ]).then(function(responses) {
                var client = (responses[0].list || [])[0];
                if (!client) { container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--layer8d-text-muted);">Client not found</div>'; return; }
                var plans = (responses[1].list || []).filter(function(p) { return p.status === 2; });
                var plan = plans.length > 0 ? plans[0] : null;
                _renderClientPlan(container, client, plan);
            })
            .catch(function(err) {
                container.innerHTML = '<div style="padding:20px;color:var(--layer8d-error);">Failed to load: ' + Layer8DUtils.escapeHtml(err.message) + '</div>';
            });
        }
    };

    window._showSessionView = function(event) {
        if (!event) return;

        var participants = event.participants || [];
        var title = event.title || 'Session';
        var time = (event.startTime || '') + ' — ' + (event.endTime || '');

        if (participants.length === 0 && event.physioClientId) {
            // 1-on-1 meeting — open client workout directly
            PhysioClientExercises.open(event.physioClientId);
            return;
        }

        if (participants.length === 0) {
            Layer8DNotification.info('No participants linked to this event.');
            return;
        }

        // Resolve participant physioClientIds to client records
        var clientIds = [];
        participants.forEach(function(p) {
            if (p.physioClientId && clientIds.indexOf(p.physioClientId) === -1) {
                clientIds.push(p.physioClientId);
            }
        });

        if (clientIds.length === 0) {
            // Participants exist but none linked to PhysioClients
            var nameList = participants.map(function(p) { return p.name || 'Unknown'; }).join(', ');
            Layer8DNotification.warning('Participants not linked to clients: ' + nameList);
            return;
        }

        // Fetch all linked clients and their plans in parallel
        _loadClientsAndPlans(clientIds, function(clientPlans) {
            _renderSessionPopup(title, time, participants, clientPlans);
        });
    };

    function _loadClientsAndPlans(clientIds, callback) {
        var results = [];
        var pending = clientIds.length;

        clientIds.forEach(function(clientId) {
            var clientQuery = encodeURIComponent(JSON.stringify({ text: 'select * from PhysioClient where clientId=' + clientId }));
            var planQuery = encodeURIComponent(JSON.stringify({ text: 'select * from TreatmentPlan where clientId=' + clientId }));

            Promise.all([
                _fetch(_apiPrefix() + '/50/PhyClient?body=' + clientQuery),
                _fetch(_apiPrefix() + '/50/PhyPlan?body=' + planQuery)
            ]).then(function(responses) {
                var client = (responses[0].list || [])[0];
                var plans = (responses[1].list || []).filter(function(p) { return p.status === 2; });
                var plan = plans.length > 0 ? plans[0] : null;
                if (client) {
                    results.push({ client: client, plan: plan });
                }
                pending--;
                if (pending === 0) callback(results);
            }).catch(function() {
                pending--;
                if (pending === 0) callback(results);
            });
        });
    }

    function _renderSessionPopup(title, time, participants, clientPlans) {
        if (clientPlans.length === 0) {
            Layer8DNotification.warning('No linked clients found for this session.');
            return;
        }

        // Build tabs — one per client
        var tabsHtml = '<div class="physio-session-tabs" style="display:flex;gap:0;border-bottom:2px solid var(--layer8d-border);margin-bottom:16px;flex-wrap:wrap;">';
        var panesHtml = '';

        clientPlans.forEach(function(cp, idx) {
            var name = (cp.client.firstName || '') + ' ' + (cp.client.lastName || '');
            var isActive = idx === 0;
            tabsHtml += '<button class="physio-session-tab" data-stab="client-' + idx + '" style="padding:8px 16px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:' +
                (isActive ? '600' : '500') + ';border-bottom:2px solid ' + (isActive ? 'var(--layer8d-primary)' : 'transparent') +
                ';margin-bottom:-2px;color:' + (isActive ? 'var(--layer8d-primary)' : 'var(--layer8d-text-medium)') + ';">' +
                Layer8DUtils.escapeHtml(name) + '</button>';

            panesHtml += '<div class="physio-session-pane" data-spane="client-' + idx + '" style="' + (isActive ? '' : 'display:none;') + '">' +
                '<div id="session-plan-' + idx + '" style="min-height:200px;"></div></div>';
        });

        tabsHtml += '</div>';

        var headerHtml = '<div style="margin-bottom:12px;color:var(--layer8d-text-medium);font-size:13px;">' +
            Layer8DUtils.escapeHtml(time) + ' — ' + clientPlans.length + ' client(s)</div>';

        Layer8DPopup.show({
            title: title,
            content: headerHtml + tabsHtml + panesHtml,
            size: 'xlarge',
            showFooter: false,
            onShow: function(body) {
                // Tab switching
                body.querySelectorAll('.physio-session-tab').forEach(function(tab) {
                    tab.addEventListener('click', function() {
                        var target = tab.getAttribute('data-stab');
                        body.querySelectorAll('.physio-session-tab').forEach(function(t) {
                            t.style.borderBottomColor = 'transparent';
                            t.style.color = 'var(--layer8d-text-medium)';
                            t.style.fontWeight = '500';
                        });
                        tab.style.borderBottomColor = 'var(--layer8d-primary)';
                        tab.style.color = 'var(--layer8d-primary)';
                        tab.style.fontWeight = '600';
                        body.querySelectorAll('.physio-session-pane').forEach(function(p) {
                            p.style.display = p.getAttribute('data-spane') === target ? '' : 'none';
                        });
                    });
                });

                // Render each client's plan
                clientPlans.forEach(function(cp, idx) {
                    _renderClientPlan(body.querySelector('#session-plan-' + idx), cp.client, cp.plan);
                });
            }
        });
    }

    function _renderClientPlan(container, client, plan) {
        if (!container) return;
        var name = (client.firstName || '') + ' ' + (client.lastName || '');

        if (!plan) {
            container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--layer8d-text-muted);">' +
                Layer8DUtils.escapeHtml(name) + ' — No active workout plan</div>';
            return;
        }

        var exercises = plan.exercises || [];
        if (exercises.length === 0) {
            container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--layer8d-text-muted);">' +
                Layer8DUtils.escapeHtml(name) + ' — Plan "' + Layer8DUtils.escapeHtml(plan.title || '') + '" has no exercises</div>';
            return;
        }

        // Fetch exercise details for names
        var exQuery = encodeURIComponent(JSON.stringify({ text: 'select * from PhysioExercise limit 500' }));
        _fetch(_apiPrefix() + '/50/PhyExercis?body=' + exQuery)
        .then(function(data) {
            var exMap = {};
            (data.list || []).forEach(function(ex) { exMap[ex.exerciseId] = ex; });
            // Detect plan's joint/posture from first exercise (for add-exercise filtering)
            var st = _getState(container);
            var seed = exercises.length > 0 ? exMap[exercises[0].exerciseId] : null;
            st.planJoint = seed ? seed.joint : null;
            st.planPosture = seed ? seed.posture : null;
            _renderPlanCircuits(container, plan, exercises, exMap);
        })
        .catch(function() {
            container.innerHTML = '<div style="padding:20px;color:var(--layer8d-error);">Failed to load exercises</div>';
        });
    }

    // State stored per-container so multiple client tabs don't conflict
    function _getState(container) {
        if (!container._sessionState) {
            container._sessionState = { flatRows: [], plan: null, exercises: null, exMap: null };
        }
        return container._sessionState;
    }

    function _renderPlanCircuits(container, plan, exercises, exMap) {
        var PA = window.PhysioPlanActions;
        var CATEGORY_LABELS = PA.CATEGORY_LABELS;
        var inputStyle = 'width:60px;padding:4px 6px;border:1px solid var(--layer8d-border);border-radius:4px;font-size:13px;';
        var notesStyle = 'width:100%;padding:4px 6px;border:1px solid var(--layer8d-border);border-radius:4px;font-size:13px;';
        var needsInit = !container._sessionHandlerAttached;

        // Use shared grouping/sorting logic
        var result = PA.groupAndSort(exercises, exMap);
        var sortedCircuits = result.circuits;

        // Build display rows
        var displayCircuits = {};
        Object.keys(sortedCircuits).forEach(function(k) {
            displayCircuits[k] = sortedCircuits[k].map(function(pe) {
                return PA.displayRow(pe, exMap);
            });
        });

        var html = '<div style="padding:8px 0;">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
            '<span style="font-weight:600;">' + Layer8DUtils.escapeHtml(plan.title || 'Workout Plan') + '</span>' +
            '<button class="session-save-btn layer8d-btn layer8d-btn-primary layer8d-btn-small">Save Changes</button></div>';

        var btnStyle = 'cursor:pointer;background:none;border:none;font-size:14px;padding:2px 4px;';

        var rowIdx = 0;
        Object.keys(displayCircuits).sort().forEach(function(cNum) {
            var label = CATEGORY_LABELS[parseInt(cNum)] || ('Circuit ' + cNum);
            html += '<div style="background:var(--layer8d-primary);color:#fff;font-size:12px;font-weight:600;padding:6px 12px;margin-top:12px;display:flex;justify-content:space-between;align-items:center;">' +
                '<span>Circuit ' + cNum + ' \u2014 ' + label + '</span>' +
                '<button class="session-add-btn layer8d-btn layer8d-btn-small" data-circuit="' + cNum + '" style="font-size:11px;padding:2px 8px;background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.4);">+ Add</button></div>';
            html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
            html += '<thead><tr style="background:var(--layer8d-bg-light);">' +
                '<th style="padding:6px 10px;text-align:left;">Exercise</th>' +
                '<th style="padding:6px 10px;text-align:left;width:70px;">Type</th>' +
                '<th style="padding:6px 10px;text-align:left;width:90px;">Load</th>' +
                '<th style="padding:6px 10px;text-align:left;width:70px;">Sets</th>' +
                '<th style="padding:6px 10px;text-align:left;width:70px;">Reps</th>' +
                '<th style="padding:6px 10px;text-align:left;">Notes</th>' +
                '<th style="padding:6px 4px;width:120px;"></th>' +
                '</tr></thead><tbody>';
            displayCircuits[cNum].forEach(function(row) {
                var fullEx = exMap[row.pe.exerciseId] || {};
                var eid = Layer8DUtils.escapeHtml(row.pe.exerciseId);
                // +/- progression/regression
                var progRegBtns = '';
                if (fullEx.regressionExerciseId) {
                    var regName = (exMap[fullEx.regressionExerciseId] || {}).name || 'easier';
                    progRegBtns += '<button class="session-regress-btn" data-row="' + rowIdx + '" title="Regress to: ' + Layer8DUtils.escapeHtml(regName) + '" style="' + btnStyle + 'font-size:16px;color:var(--layer8d-error);">\u2212</button>';
                }
                if (fullEx.progressionExerciseId) {
                    var progName = (exMap[fullEx.progressionExerciseId] || {}).name || 'harder';
                    progRegBtns += '<button class="session-progress-btn" data-row="' + rowIdx + '" title="Progress to: ' + Layer8DUtils.escapeHtml(progName) + '" style="' + btnStyle + 'font-size:16px;color:var(--layer8d-success);">+</button>';
                }
                // Action buttons: move, video, image, delete
                var actionBtns = '<button class="session-move-up" data-row="' + rowIdx + '" title="Move up" style="' + btnStyle + '">\u25b2</button>' +
                    '<button class="session-move-down" data-row="' + rowIdx + '" title="Move down" style="' + btnStyle + '">\u25bc</button>' +
                    '<button class="session-video-btn" data-eid="' + eid + '" title="Watch video" style="' + btnStyle + '">\u25b6</button>';
                if (fullEx.imageStoragePath) {
                    actionBtns += '<img class="session-img-thumb" data-eid="' + eid + '" data-img-path="' + Layer8DUtils.escapeHtml(fullEx.imageStoragePath) + '" alt="" style="width:28px;height:28px;object-fit:cover;border-radius:3px;cursor:pointer;vertical-align:middle;background:var(--layer8d-bg-light);">';
                }
                actionBtns += '<button class="session-delete-btn" data-row="' + rowIdx + '" title="Remove exercise" style="' + btnStyle + 'color:var(--layer8d-error);">\u2716</button>';

                var typeBadge = (fullEx.exerciseType === 1)
                    ? '<span class="physio-type-badge physio-type-fixed">Fixed</span>'
                    : '<span class="physio-type-badge physio-type-variable">Variable</span>';

                var loadDropdown = PhysioPlanActions.loadTypeSelect(row.loadType, 'session-edit-load', ' data-row="' + rowIdx + '"');

                html += '<tr style="border-bottom:1px solid var(--layer8d-border);">' +
                    '<td style="padding:6px 10px;">' + Layer8DUtils.escapeHtml(row.name) + ' ' + progRegBtns + '</td>' +
                    '<td style="padding:6px 10px;">' + typeBadge + '</td>' +
                    '<td style="padding:6px 10px;">' + loadDropdown + '</td>' +
                    '<td style="padding:6px 10px;"><input type="number" class="session-edit-sets" data-row="' + rowIdx + '" value="' + Layer8DUtils.escapeHtml(String(row.sets)) + '" style="' + inputStyle + '"></td>' +
                    '<td style="padding:6px 10px;"><input type="text" class="session-edit-reps" data-row="' + rowIdx + '" value="' + Layer8DUtils.escapeHtml(String(row.reps)) + '" style="' + inputStyle + '"></td>' +
                    '<td style="padding:6px 10px;"><input type="text" class="session-edit-notes" data-row="' + rowIdx + '" value="' + Layer8DUtils.escapeHtml(row.notes) + '" style="' + notesStyle + '"></td>' +
                    '<td style="padding:6px 4px;white-space:nowrap;">' + actionBtns + '</td></tr>';
                rowIdx++;
            });
            html += '</tbody></table>';
        });

        html += '</div>';
        container.innerHTML = html;

        // Update per-container state so the handler always sees this container's data
        var st = _getState(container);
        st.flatRows = [];
        Object.keys(displayCircuits).sort().forEach(function(cNum) {
            displayCircuits[cNum].forEach(function(row) { st.flatRows.push(row.pe); });
        });
        st.plan = plan;
        st.exercises = exercises;
        st.exMap = exMap;
        // Capture original values on first render (for change tracking)
        if (!st.originals) {
            st.originals = {};
            // Read ACTUAL input DOM values after render — guarantees match with _collectEdits
            container.querySelectorAll('.session-edit-sets').forEach(function(input) {
                var idx = parseInt(input.dataset.row, 10);
                var pe = st.flatRows[idx];
                if (pe) {
                    if (!st.originals[pe.exerciseId]) st.originals[pe.exerciseId] = {};
                    st.originals[pe.exerciseId].sets = parseInt(input.value, 10) || 0;
                }
            });
            container.querySelectorAll('.session-edit-reps').forEach(function(input) {
                var idx = parseInt(input.dataset.row, 10);
                var pe = st.flatRows[idx];
                if (pe) {
                    if (!st.originals[pe.exerciseId]) st.originals[pe.exerciseId] = {};
                    st.originals[pe.exerciseId].reps = parseInt(input.value, 10) || 0;
                }
            });
            container.querySelectorAll('.session-edit-notes').forEach(function(input) {
                var idx = parseInt(input.dataset.row, 10);
                var pe = st.flatRows[idx];
                if (pe) {
                    if (!st.originals[pe.exerciseId]) st.originals[pe.exerciseId] = {};
                    st.originals[pe.exerciseId].notes = input.value.trim();
                }
            });
            container.querySelectorAll('.session-edit-load').forEach(function(sel) {
                var idx = parseInt(sel.dataset.row, 10);
                var pe = st.flatRows[idx];
                if (pe) {
                    if (!st.originals[pe.exerciseId]) st.originals[pe.exerciseId] = {};
                    st.originals[pe.exerciseId].loadType = parseInt(sel.value, 10) || 0;
                }
            });
        }

        // Load authenticated images
        if (window.PhysioClientExerciseInfo) {
            PhysioClientExerciseInfo.loadAuthImages(container);
        }

        // Attach event handler ONCE (survives re-renders via _state reference)
        if (needsInit) {
            container._sessionHandlerAttached = true;
            container.addEventListener('click', _handleContainerClick);
        }
    }

    function _collectEdits(container) {
        var st = _getState(container);
        container.querySelectorAll('.session-edit-sets').forEach(function(input) {
            var idx = parseInt(input.dataset.row, 10);
            if (st.flatRows[idx]) st.flatRows[idx].sets = parseInt(input.value, 10) || 0;
        });
        container.querySelectorAll('.session-edit-reps').forEach(function(input) {
            var idx = parseInt(input.dataset.row, 10);
            if (st.flatRows[idx]) st.flatRows[idx].reps = parseInt(input.value, 10) || 0;
        });
        container.querySelectorAll('.session-edit-notes').forEach(function(input) {
            var idx = parseInt(input.dataset.row, 10);
            if (st.flatRows[idx]) st.flatRows[idx].notes = input.value.trim();
        });
        container.querySelectorAll('.session-edit-load').forEach(function(sel) {
            var idx = parseInt(sel.dataset.row, 10);
            if (st.flatRows[idx]) st.flatRows[idx].loadType = parseInt(sel.value, 10) || 0;
        });
    }

    function _rerender(container) {
        var st = _getState(container);
        _renderPlanCircuits(container, st.plan, st.exercises, st.exMap);
    }

    function _logPlanChanges(st) {
        window.PhysioPlanActions.logChanges(st.plan, st.exercises, st.exMap, st.originals);
    }

    function _handleContainerClick(e) {
        var t = e.target;
        var container = e.currentTarget;
        var st = _getState(container);
        var PA = window.PhysioPlanActions;

        // Save — detect changes and log them
        var save = t.closest('.session-save-btn');
        if (save) {
            e.stopPropagation();
            _collectEdits(container);
            _logPlanChanges(st);
            PA.save(st.plan);
            return;
        }

        // Progression/regression
        var prog = t.closest('.session-progress-btn');
        if (prog) { e.stopPropagation(); _collectEdits(container); var pi = parseInt(prog.dataset.row, 10); var ppe = st.flatRows[pi]; if (ppe) { PA.swap(st.exMap, ppe, 'progression', st.plan.planId, st.plan.clientId); _rerender(container); } return; }
        var reg = t.closest('.session-regress-btn');
        if (reg) { e.stopPropagation(); _collectEdits(container); var ri = parseInt(reg.dataset.row, 10); var rpe = st.flatRows[ri]; if (rpe) { PA.swap(st.exMap, rpe, 'regression', st.plan.planId, st.plan.clientId); _rerender(container); } return; }

        // Delete
        var del = t.closest('.session-delete-btn');
        if (del) {
            e.stopPropagation(); _collectEdits(container);
            var di = parseInt(del.dataset.row, 10); var dpe = st.flatRows[di];
            if (dpe) {
                var delName = (st.exMap[dpe.exerciseId] || {}).name || dpe.exerciseId;
                var delLabel = PA.CATEGORY_LABELS[dpe.circuitNumber] || ('Circuit ' + (dpe.circuitNumber || '?'));
                PA.remove(st.exercises, dpe); st.plan.exercises = st.exercises;
                fetch(_apiPrefix() + '/50/ExSwapLog', {
                    method: 'POST',
                    headers: Object.assign({}, _headers(), { 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                        clientId: st.plan.clientId, planId: st.plan.planId,
                        oldExerciseId: dpe.exerciseId, newExerciseId: '',
                        direction: 0, swapDate: Math.floor(Date.now() / 1000),
                        therapistId: sessionStorage.getItem('currentUser') || '',
                        description: '[' + delLabel + '] Removed: ' + delName
                    })
                }).catch(function(err) { console.warn('Failed to log delete:', err); });
                _rerender(container);
            }
            return;
        }

        // Move
        var up = t.closest('.session-move-up');
        var down = t.closest('.session-move-down');
        if (up || down) {
            e.stopPropagation(); _collectEdits(container);
            var mi = parseInt((up || down).dataset.row, 10);
            var mpe = st.flatRows[mi];
            if (mpe && PA.move(st.exercises, st.exMap, mpe, up ? -1 : 1)) {
                var moveName = (st.exMap[mpe.exerciseId] || {}).name || mpe.exerciseId;
                var moveLabel = PA.CATEGORY_LABELS[mpe.circuitNumber] || ('Circuit ' + (mpe.circuitNumber || '?'));
                var moveDir = up ? 'up' : 'down';
                fetch(_apiPrefix() + '/50/ExSwapLog', {
                    method: 'POST',
                    headers: Object.assign({}, _headers(), { 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                        clientId: st.plan.clientId, planId: st.plan.planId,
                        oldExerciseId: mpe.exerciseId, newExerciseId: mpe.exerciseId,
                        direction: 0, swapDate: Math.floor(Date.now() / 1000),
                        therapistId: sessionStorage.getItem('currentUser') || '',
                        description: '[' + moveLabel + '] Moved ' + moveDir + ': ' + moveName
                    })
                }).catch(function(err) { console.warn('Failed to log move:', err); });
                _rerender(container);
            }
            return;
        }

        // Add
        var add = t.closest('.session-add-btn');
        if (add) {
            e.stopPropagation(); _collectEdits(container);
            var aCNum = parseInt(add.dataset.circuit, 10);
            var available = PA.availableForCircuit(st.exercises, st.exMap, aCNum, st.planJoint, st.planPosture);
            var opts = available.length === 0
                ? '<option value="">No exercises available</option>'
                : '<option value="">-- Select --</option>' + available.map(function(ex) {
                    return '<option value="' + Layer8DUtils.escapeHtml(ex.exerciseId) + '">' + Layer8DUtils.escapeHtml(ex.name || ex.exerciseId) + '</option>';
                }).join('');
            Layer8DPopup.show({
                title: 'Add Exercise', size: 'small', showFooter: true, saveButtonText: 'Add',
                content: '<div style="padding:12px;"><select id="session-add-ex" style="width:100%;padding:8px;border:1px solid var(--layer8d-border);border-radius:4px;">' + opts + '</select></div>',
                onSave: function() {
                    var b = Layer8DPopup.getBody();
                    var sel = b ? b.querySelector('#session-add-ex') : null;
                    var exId = sel ? sel.value : '';
                    if (!exId) { Layer8DNotification.error('Please select an exercise'); return; }
                    PA.addToPlan(st.exercises, exId, aCNum, st.exMap);
                    st.plan.exercises = st.exercises;
                    // Log the addition
                    var addedName = (st.exMap[exId] || {}).name || exId;
                    var addLabel = PA.CATEGORY_LABELS[aCNum] || ('Circuit ' + aCNum);
                    fetch(_apiPrefix() + '/50/ExSwapLog', {
                        method: 'POST',
                        headers: Object.assign({}, _headers(), { 'Content-Type': 'application/json' }),
                        body: JSON.stringify({
                            clientId: st.plan.clientId, planId: st.plan.planId,
                            oldExerciseId: '', newExerciseId: exId,
                            direction: 0, swapDate: Math.floor(Date.now() / 1000),
                            therapistId: sessionStorage.getItem('currentUser') || '',
                            description: '[' + addLabel + '] Added: ' + addedName
                        })
                    }).catch(function(err) { console.warn('Failed to log add:', err); });
                    Layer8DPopup.close();
                    _rerender(container);
                }
            });
            return;
        }

        // Video / Image
        var vid = t.closest('.session-video-btn');
        if (vid) { e.stopPropagation(); PhysioClientExerciseInfo.showVideoPopup(vid.dataset.eid, st.exMap); return; }
        var img = t.closest('.session-img-thumb');
        if (img) { e.stopPropagation(); PhysioClientExerciseInfo.showImagePopup(img.dataset.eid, st.exMap); return; }
    }

})();
