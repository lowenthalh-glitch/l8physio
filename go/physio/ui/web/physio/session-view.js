// Session View — multi-client workout plan popup for class events
// Rendering and event handlers are in session-view-rendering.js
(function() {
    'use strict';

    function _apiPrefix() { return Layer8DConfig.getApiPrefix(); }
    function _headers() { return getAuthHeaders(); }
    function _fetch(url) { return fetch(url, { method: 'GET', headers: _headers() }).then(function(r) { return r.json(); }); }

    function _getState(container) {
        if (!container._sessionState) {
            container._sessionState = { flatRows: [], plan: null, exercises: null, exMap: null };
        }
        return container._sessionState;
    }

    function _valueCellInner(row, rowIdx) {
        var lt = row.loadType;
        var field = lt === 5 ? 'weightKg' : ((lt === 8 || lt === 9) ? 'holdSeconds' : '');
        var suffix = lt === 5 ? 'kg' : ((lt === 8 || lt === 9) ? 's' : '');
        var val = field ? (row[field] || 0) : 0;
        var enabled = !!field;
        return '<span style="display:inline-flex;align-items:center;gap:2px;white-space:nowrap;">'
             + '<input type="number" min="0" class="session-edit-value" data-row="' + rowIdx + '" data-field="' + field + '" value="' + val + '" ' + (enabled ? '' : 'disabled') + ' style="width:48px;padding:4px 6px;border:1px solid var(--layer8d-border);border-radius:4px;font-size:13px;' + (enabled ? '' : 'background:var(--layer8d-bg-light);color:var(--layer8d-text-muted);') + '">'
             + '<span style="font-size:11px;color:var(--layer8d-text-muted);">' + suffix + '</span>'
             + '</span>';
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
        container.querySelectorAll('.session-edit-value').forEach(function(input) {
            var idx = parseInt(input.dataset.row, 10);
            var field = input.dataset.field;
            if (st.flatRows[idx] && field) st.flatRows[idx][field] = parseInt(input.value, 10) || 0;
        });
    }

    function _rerender(container) {
        var st = _getState(container);
        window.PhysioSessionRendering.renderPlanCircuits(container, st.plan, st.exercises, st.exMap);
    }

    function _logPlanChanges(st) {
        window.PhysioPlanActions.logChanges(st.plan, st.exercises, st.exMap, st.originals);
    }

    // Shared internals for session-view-rendering.js
    window.PhysioSessionViewInternal = {
        apiPrefix: _apiPrefix,
        headers: _headers,
        getState: _getState,
        valueCellInner: _valueCellInner,
        collectEdits: _collectEdits,
        rerender: _rerender,
        logPlanChanges: _logPlanChanges
    };

    // Render a single client's active plan into a container (reused by dashboard detail popup)
    window.PhysioSessionPlanRenderer = {
        render: function(container, clientId) {
            if (!container) return;
            container.innerHTML = '<div style="padding:12px;color:var(--layer8d-text-muted);">Loading workout plan…</div>';
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
            PhysioClientExercises.open(event.physioClientId);
            return;
        }

        if (participants.length === 0) {
            Layer8DNotification.info('No participants linked to this event.');
            return;
        }

        var clientIds = [];
        participants.forEach(function(p) {
            if (p.physioClientId && clientIds.indexOf(p.physioClientId) === -1) {
                clientIds.push(p.physioClientId);
            }
        });

        if (clientIds.length === 0) {
            var nameList = participants.map(function(p) { return p.name || 'Unknown'; }).join(', ');
            Layer8DNotification.warning('Participants not linked to clients: ' + nameList);
            return;
        }

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

        var exQuery = encodeURIComponent(JSON.stringify({ text: 'select * from PhysioExercise limit 500' }));
        _fetch(_apiPrefix() + '/50/PhyExercis?body=' + exQuery)
        .then(function(data) {
            var exMap = {};
            (data.list || []).forEach(function(ex) { exMap[ex.exerciseId] = ex; });
            var st = _getState(container);
            var seed = exercises.length > 0 ? exMap[exercises[0].exerciseId] : null;
            st.planJoints   = seed ? ((seed.joints   && seed.joints.length)   ? seed.joints   : (seed.joint   ? [seed.joint]   : null)) : null;
            st.planPostures = seed ? ((seed.postures && seed.postures.length) ? seed.postures : (seed.posture ? [seed.posture] : null)) : null;
            window.PhysioSessionRendering.renderPlanCircuits(container, plan, exercises, exMap);
        })
        .catch(function() {
            container.innerHTML = '<div style="padding:20px;color:var(--layer8d-error);">Failed to load exercises</div>';
        });
    }

})();
