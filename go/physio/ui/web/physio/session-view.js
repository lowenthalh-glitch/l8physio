// Session View — multi-client workout plan popup for class events
// Triggered when a therapist clicks a BoostappCalendarEvent with participants
(function() {
    'use strict';

    function _apiPrefix() { return Layer8DConfig.getApiPrefix(); }
    function _headers() { return getAuthHeaders(); }
    function _fetch(url) { return fetch(url, { method: 'GET', headers: _headers() }).then(function(r) { return r.json(); }); }

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
            _renderPlanCircuits(container, plan, exercises, exMap);
        })
        .catch(function() {
            container.innerHTML = '<div style="padding:20px;color:var(--layer8d-error);">Failed to load exercises</div>';
        });
    }

    function _renderPlanCircuits(container, plan, exercises, exMap) {
        var CATEGORY_LABELS = { 1: 'Mobility', 2: 'Rehab', 3: 'Strength', 4: 'Functional' };
        var inputStyle = 'width:60px;padding:4px 6px;border:1px solid var(--layer8d-border);border-radius:4px;font-size:13px;';
        var notesStyle = 'width:100%;padding:4px 6px;border:1px solid var(--layer8d-border);border-radius:4px;font-size:13px;';

        // Group by circuit, keep reference to plan exercise for editing
        var circuits = {};
        exercises.forEach(function(pe) {
            var c = pe.circuitNumber || 0;
            if (!circuits[c]) circuits[c] = [];
            var ex = exMap[pe.exerciseId] || {};
            circuits[c].push({
                pe: pe,
                name: ex.name || pe.exerciseId || '—',
                sets: pe.sets || ex.defaultSets || '',
                reps: pe.reps || ex.defaultRepsDisplay || String(ex.defaultReps || '') || '',
                notes: pe.notes || ''
            });
        });

        var html = '<div style="padding:8px 0;">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
            '<span style="font-weight:600;">' + Layer8DUtils.escapeHtml(plan.title || 'Workout Plan') + '</span>' +
            '<button class="session-save-btn layer8d-btn layer8d-btn-primary layer8d-btn-small">Save Changes</button></div>';

        var rowIdx = 0;
        Object.keys(circuits).sort().forEach(function(cNum) {
            var label = CATEGORY_LABELS[parseInt(cNum)] || ('Circuit ' + cNum);
            html += '<div style="background:var(--layer8d-primary);color:#fff;font-size:12px;font-weight:600;padding:6px 12px;margin-top:12px;">' +
                'Circuit ' + cNum + ' \u2014 ' + label + '</div>';
            html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
            html += '<thead><tr style="background:var(--layer8d-bg-light);">' +
                '<th style="padding:6px 10px;text-align:left;">Exercise</th>' +
                '<th style="padding:6px 10px;text-align:left;width:80px;">Sets</th>' +
                '<th style="padding:6px 10px;text-align:left;width:80px;">Reps</th>' +
                '<th style="padding:6px 10px;text-align:left;">Notes</th></tr></thead><tbody>';
            circuits[cNum].forEach(function(row) {
                var fullEx = exMap[row.pe.exerciseId] || {};
                var progRegBtns = '';
                if (fullEx.regressionExerciseId) {
                    var regName = (exMap[fullEx.regressionExerciseId] || {}).name || 'easier';
                    progRegBtns += '<button class="session-regress-btn" data-row="' + rowIdx + '" title="Regress to: ' + Layer8DUtils.escapeHtml(regName) + '" style="cursor:pointer;background:none;border:none;font-size:16px;color:var(--layer8d-error);">\u2212</button>';
                }
                if (fullEx.progressionExerciseId) {
                    var progName = (exMap[fullEx.progressionExerciseId] || {}).name || 'harder';
                    progRegBtns += '<button class="session-progress-btn" data-row="' + rowIdx + '" title="Progress to: ' + Layer8DUtils.escapeHtml(progName) + '" style="cursor:pointer;background:none;border:none;font-size:16px;color:var(--layer8d-success);">+</button>';
                }
                html += '<tr style="border-bottom:1px solid var(--layer8d-border);">' +
                    '<td style="padding:6px 10px;">' + Layer8DUtils.escapeHtml(row.name) + ' ' + progRegBtns + '</td>' +
                    '<td style="padding:6px 10px;"><input type="number" class="session-edit-sets" data-row="' + rowIdx + '" value="' + Layer8DUtils.escapeHtml(String(row.sets)) + '" style="' + inputStyle + '"></td>' +
                    '<td style="padding:6px 10px;"><input type="text" class="session-edit-reps" data-row="' + rowIdx + '" value="' + Layer8DUtils.escapeHtml(String(row.reps)) + '" style="' + inputStyle + '"></td>' +
                    '<td style="padding:6px 10px;"><input type="text" class="session-edit-notes" data-row="' + rowIdx + '" value="' + Layer8DUtils.escapeHtml(row.notes) + '" style="' + notesStyle + '"></td></tr>';
                rowIdx++;
            });
            html += '</tbody></table>';
        });

        html += '</div>';
        container.innerHTML = html;

        // Build flat row index → plan exercise mapping
        var flatRows = [];
        Object.keys(circuits).sort().forEach(function(cNum) {
            circuits[cNum].forEach(function(row) { flatRows.push(row.pe); });
        });

        // Save button handler
        var saveBtn = container.querySelector('.session-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                // Collect edited values back into plan exercises
                container.querySelectorAll('.session-edit-sets').forEach(function(input) {
                    var idx = parseInt(input.dataset.row, 10);
                    if (flatRows[idx]) flatRows[idx].sets = parseInt(input.value, 10) || 0;
                });
                container.querySelectorAll('.session-edit-reps').forEach(function(input) {
                    var idx = parseInt(input.dataset.row, 10);
                    if (flatRows[idx]) flatRows[idx].reps = parseInt(input.value, 10) || 0;
                });
                container.querySelectorAll('.session-edit-notes').forEach(function(input) {
                    var idx = parseInt(input.dataset.row, 10);
                    if (flatRows[idx]) flatRows[idx].notes = input.value.trim();
                });

                // PUT the updated plan
                fetch(_apiPrefix() + '/50/PhyPlan', {
                    method: 'PUT',
                    headers: Object.assign({}, _headers(), { 'Content-Type': 'application/json' }),
                    body: JSON.stringify(plan)
                })
                .then(function(r) {
                    if (r.ok) Layer8DNotification.success('Plan saved');
                    else Layer8DNotification.error('Failed to save plan');
                })
                .catch(function(err) { Layer8DNotification.error('Error: ' + err.message); });
            });
        }

        // Progression/regression swap handlers
        function _handleSwap(btn, direction) {
            var idx = parseInt(btn.dataset.row, 10);
            var pe = flatRows[idx];
            if (!pe) return;
            var fullEx = exMap[pe.exerciseId] || {};
            var newId = direction === 'progression' ? fullEx.progressionExerciseId : fullEx.regressionExerciseId;
            if (!newId) return;

            var oldName = fullEx.name || pe.exerciseId;
            var newEx = exMap[newId] || {};
            var newName = newEx.name || newId;

            pe.exerciseId = newId;
            if (newEx.defaultSets) pe.sets = newEx.defaultSets;
            if (newEx.defaultReps) pe.reps = newEx.defaultReps;

            // Log the swap
            fetch(_apiPrefix() + '/50/ExSwapLog', {
                method: 'POST',
                headers: Object.assign({}, _headers(), { 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    clientId: plan.clientId,
                    planId: plan.planId,
                    oldExerciseId: fullEx.exerciseId,
                    newExerciseId: newId,
                    direction: direction === 'progression' ? 1 : 2,
                    swapDate: Math.floor(Date.now() / 1000)
                })
            }).catch(function(err) { console.warn('Failed to log swap:', err); });

            Layer8DNotification.info(oldName + ' \u2192 ' + newName);
            // Re-render with updated plan
            _renderPlanCircuits(container, plan, exercises, exMap);
        }

        container.addEventListener('click', function(e) {
            var prog = e.target.closest('.session-progress-btn');
            if (prog) { e.stopPropagation(); _handleSwap(prog, 'progression'); return; }
            var reg = e.target.closest('.session-regress-btn');
            if (reg) { e.stopPropagation(); _handleSwap(reg, 'regression'); return; }
        });
    }

})();
