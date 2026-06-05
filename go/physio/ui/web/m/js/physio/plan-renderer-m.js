// MobilePlanRenderer — shared mobile workout plan CRUD renderer
// Called from: client popup, dashboard detail, session view, plan editor
// Uses PhysioPlanActions for all behavioral logic (groupAndSort, move, swap, save, logChanges)
(function() {
    'use strict';

    function _api() { return Layer8DConfig.getApiPrefix(); }
    function _get(url) { return Layer8MAuth.get(url); }

    // The plan is read-only when the user lacks PUT (action 2) on TreatmentPlan —
    // e.g. a client viewing their own workout. The framework populates
    // window.Layer8DPermissions; an empty/absent map means permissive (legacy admin).
    function _canEditPlan() {
        var perms = window.Layer8DPermissions;
        if (!perms || Object.keys(perms).length === 0) return true;
        var actions = perms.TreatmentPlan || [];
        return actions.indexOf(2) !== -1;
    }

    function _getState(container) {
        if (!container._planState) container._planState = { flatRows: [], plan: null, exercises: null, exMap: null };
        return container._planState;
    }

    // ── Public API ────────────────────────────────────────────────────
    window.MobilePlanRenderer = {
        render: function(container, clientId) {
            if (!container) return;
            container.innerHTML = '<div style="padding:12px;color:var(--layer8d-text-muted);">Loading workout plan\u2026</div>';
            var cQuery = encodeURIComponent(JSON.stringify({ text: 'select * from PhysioClient where clientId=' + clientId }));
            var pQuery = encodeURIComponent(JSON.stringify({ text: 'select * from TreatmentPlan where clientId=' + clientId }));
            Promise.all([_get(_api() + '/50/PhyClient?body=' + cQuery), _get(_api() + '/50/PhyPlan?body=' + pQuery)])
            .then(function(res) {
                var client = (res[0].list || [])[0];
                if (!client) { container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--layer8d-text-muted);">Client not found</div>'; return; }
                var plans = (res[1].list || []).filter(function(p) { return p.status === 2; });
                var plan = plans.length > 0 ? plans[0] : null;
                _loadPlan(container, client, plan);
            })
            .catch(function(err) { container.innerHTML = '<div style="padding:16px;color:var(--layer8d-error);">Failed to load: ' + Layer8DUtils.escapeHtml(err.message) + '</div>'; });
        }
    };

    function _loadPlan(container, client, plan) {
        var name = (client.firstName || '') + ' ' + (client.lastName || '');
        if (!plan) { container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--layer8d-text-muted);">' + Layer8DUtils.escapeHtml(name) + ' \u2014 No active workout plan</div>'; return; }
        var exercises = plan.exercises || [];
        if (exercises.length === 0) { container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--layer8d-text-muted);">' + Layer8DUtils.escapeHtml(name) + ' \u2014 Plan has no exercises</div>'; return; }

        var exQuery = encodeURIComponent(JSON.stringify({ text: 'select * from PhysioExercise limit 500' }));
        _get(_api() + '/50/PhyExercis?body=' + exQuery)
        .then(function(data) {
            var exMap = {};
            (data.list || []).forEach(function(ex) { exMap[ex.exerciseId] = ex; });
            var st = _getState(container);
            var seed = exercises.length > 0 ? exMap[exercises[0].exerciseId] : null;
            st.planJoint = seed ? seed.joint : null;
            st.planPosture = seed ? seed.posture : null;
            _renderCircuits(container, plan, exercises, exMap);
        })
        .catch(function() { container.innerHTML = '<div style="padding:16px;color:var(--layer8d-error);">Failed to load exercises</div>'; });
    }

    var MPR_INPUT_STYLE = 'width:100%;padding:4px 6px;border:1px solid var(--layer8d-border);border-radius:4px;font-size:13px;box-sizing:border-box;';

    function _valueDivHTML(row, rowIdx, canEdit) {
        var lt = row.loadType;
        var field = lt === 5 ? 'weightKg' : ((lt === 8 || lt === 9) ? 'holdSeconds' : '');
        var label = lt === 5 ? 'Value (kg)' : ((lt === 8 || lt === 9) ? 'Value (s)' : 'Value');
        var val = field ? (row[field] || 0) : 0;
        var enabled = !!field && canEdit;
        return '<div><label style="font-size:11px;color:var(--layer8d-text-muted);">' + label + '</label><input type="number" min="0" class="mpr-value" data-row="' + rowIdx + '" data-field="' + field + '" value="' + val + '" ' + (enabled ? '' : 'disabled') + ' style="' + MPR_INPUT_STYLE + (enabled ? '' : 'background:var(--layer8d-bg-light);color:var(--layer8d-text-primary);-webkit-text-fill-color:var(--layer8d-text-primary);opacity:1;font-weight:600;') + '"></div>';
    }

    // ── Render circuits as mobile cards ───────────────────────────────
    function _renderCircuits(container, plan, exercises, exMap) {
        var PA = window.PhysioPlanActions;
        var CATS = PA.CATEGORY_LABELS;
        var needsInit = !container._planHandlerAttached;
        var canEdit = _canEditPlan();
        var roDis = canEdit ? '' : ' disabled';
        var roStyle = canEdit ? '' : 'background:var(--layer8d-bg-light);color:var(--layer8d-text-primary);-webkit-text-fill-color:var(--layer8d-text-primary);opacity:1;font-weight:600;';

        var result = PA.groupAndSort(exercises, exMap);
        var circuits = result.circuits;
        var displayCircuits = {};
        Object.keys(circuits).forEach(function(k) {
            displayCircuits[k] = circuits[k].map(function(pe) { return PA.displayRow(pe, exMap); });
        });

        var html = '<div style="padding:4px 0;">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
            '<span style="font-weight:600;font-size:15px;">' + Layer8DUtils.escapeHtml(plan.title || 'Workout Plan') + '</span>' +
            (canEdit ? '<button class="mpr-save-btn" style="padding:8px 16px;border:none;border-radius:6px;background:var(--layer8d-primary);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Save</button>' : '') +
            '</div>';

        var rowIdx = 0;
        Object.keys(displayCircuits).sort().forEach(function(cNum) {
            var label = CATS[parseInt(cNum)] || ('Circuit ' + cNum);
            html += '<div style="background:var(--layer8d-primary);color:#fff;font-size:12px;font-weight:600;padding:8px 12px;margin-top:12px;border-radius:6px 6px 0 0;display:flex;justify-content:space-between;align-items:center;">' +
                '<span>' + label + '</span>' +
                (canEdit ? '<button class="mpr-add-btn" data-circuit="' + cNum + '" style="font-size:11px;padding:3px 10px;background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.4);border-radius:4px;cursor:pointer;">+ Add</button>' : '') +
                '</div>';

            displayCircuits[cNum].forEach(function(row) {
                var fullEx = exMap[row.pe.exerciseId] || {};
                var eid = Layer8DUtils.escapeHtml(row.pe.exerciseId);

                // Action buttons — video is always shown; all editors require canEdit.
                var actions = '';
                if (canEdit && fullEx.regressionExerciseId) {
                    var regName = (exMap[fullEx.regressionExerciseId] || {}).name || 'easier';
                    actions += '<button class="mpr-regress" data-row="' + rowIdx + '" title="' + Layer8DUtils.escapeHtml(regName) + '" style="padding:4px 8px;border:1px solid var(--layer8d-error);border-radius:4px;background:none;color:var(--layer8d-error);font-size:14px;cursor:pointer;">\u2212</button>';
                }
                if (canEdit && fullEx.progressionExerciseId) {
                    var progName = (exMap[fullEx.progressionExerciseId] || {}).name || 'harder';
                    actions += '<button class="mpr-progress" data-row="' + rowIdx + '" title="' + Layer8DUtils.escapeHtml(progName) + '" style="padding:4px 8px;border:1px solid var(--layer8d-success);border-radius:4px;background:none;color:var(--layer8d-success);font-size:14px;cursor:pointer;">+</button>';
                }
                if (canEdit && fullEx.rotationGroupId) {
                    actions += '<button class="mpr-rotate" data-row="' + rowIdx + '" title="Rotate" style="padding:4px 8px;border:1px solid var(--layer8d-border);border-radius:4px;background:none;font-size:14px;cursor:pointer;">↻</button>';
                }
                if (canEdit) {
                    actions += '<button class="mpr-up" data-row="' + rowIdx + '" style="padding:4px 6px;border:1px solid var(--layer8d-border);border-radius:4px;background:none;cursor:pointer;">\u25b2</button>';
                    actions += '<button class="mpr-down" data-row="' + rowIdx + '" style="padding:4px 6px;border:1px solid var(--layer8d-border);border-radius:4px;background:none;cursor:pointer;">\u25bc</button>';
                }
                actions += '<button class="mpr-video" data-eid="' + eid + '" style="padding:4px 6px;border:1px solid var(--layer8d-border);border-radius:4px;background:none;cursor:pointer;">\u25b6</button>';
                if (canEdit) {
                    actions += '<button class="mpr-delete" data-row="' + rowIdx + '" style="padding:4px 6px;border:1px solid var(--layer8d-error);border-radius:4px;background:none;color:var(--layer8d-error);cursor:pointer;">\u2716</button>';
                }

                var loadSelect = PA.loadTypeSelect(row.loadType, 'mpr-load', ' data-row="' + rowIdx + '"' + roDis)
                    .replace('style="padding:4px 6px;', 'style="width:100%;box-sizing:border-box;padding:4px 6px;');
                if (!canEdit) {
                    loadSelect = loadSelect.replace('font-size:13px;', 'font-size:13px;' + roStyle);
                }
                var iStyle = 'width:100%;padding:4px 6px;border:1px solid var(--layer8d-border);border-radius:4px;font-size:13px;box-sizing:border-box;';
                // Thumbnail (only when the exercise has an image) — loaded by
                // PhysioClientExerciseInfo.loadAuthImages() at the end of _renderCircuits,
                // mirroring the desktop _image column wiring.
                var thumbHtml = fullEx.imageStoragePath
                    ? '<img data-img-path="' + Layer8DUtils.escapeHtml(fullEx.imageStoragePath) + '" data-eid="' + eid + '" class="mpr-thumb" alt="" style="width:200px;height:200px;object-fit:cover;border-radius:6px;cursor:pointer;background:var(--layer8d-bg-light);flex:0 0 auto;">'
                    : '';

                html += '<div style="border:1px solid var(--layer8d-border);border-top:none;padding:10px 12px;background:var(--layer8d-bg-white);">' +
                    '<div style="display:flex;gap:10px;margin-bottom:6px;align-items:flex-start;">' +
                    '<div style="flex:1;min-width:0;">' +
                    '<div style="font-weight:600;font-size:14px;margin-bottom:4px;">' + (canEdit ? '' : (rowIdx + 1) + '. ') + Layer8DUtils.escapeHtml(row.name) + '</div>' +
                    '<div style="display:grid;grid-template-columns:1fr 1fr;column-gap:6px;row-gap:4px;">' +
                    '<div><label style="font-size:11px;color:var(--layer8d-text-muted);">Load</label>' + loadSelect + '</div>' +
                    _valueDivHTML(row, rowIdx, canEdit) +
                    '<div><label style="font-size:11px;color:var(--layer8d-text-muted);">Sets</label><input type="number" class="mpr-sets" data-row="' + rowIdx + '" value="' + Layer8DUtils.escapeHtml(String(row.sets)) + '"' + roDis + ' style="' + iStyle + roStyle + '"></div>' +
                    '<div><label style="font-size:11px;color:var(--layer8d-text-muted);">Reps</label><input type="text" class="mpr-reps" data-row="' + rowIdx + '" value="' + Layer8DUtils.escapeHtml(String(row.reps)) + '"' + roDis + ' style="' + iStyle + roStyle + '"></div>' +
                    '</div>' +
                    '<div style="margin-top:4px;"><label style="font-size:11px;color:var(--layer8d-text-muted);">Notes</label><input type="text" class="mpr-notes" data-row="' + rowIdx + '" value="' + Layer8DUtils.escapeHtml(row.notes) + '"' + roDis + ' style="' + iStyle + roStyle + '"></div>' +
                    '</div>' +
                    thumbHtml +
                    '</div>' +
                    '<div style="display:flex;gap:6px;flex-wrap:wrap;">' + actions + '</div></div>';
                rowIdx++;
            });
        });
        html += '</div>';
        container.innerHTML = html;

        // State
        var st = _getState(container);
        st.flatRows = [];
        Object.keys(displayCircuits).sort().forEach(function(cNum) {
            displayCircuits[cNum].forEach(function(row) { st.flatRows.push(row.pe); });
        });
        st.plan = plan; st.exercises = exercises; st.exMap = exMap;

        // Capture originals from DOM
        if (!st.originals) {
            st.originals = {};
            container.querySelectorAll('.mpr-sets').forEach(function(i) { var pe = st.flatRows[parseInt(i.dataset.row)]; if (pe) { st.originals[pe.exerciseId] = st.originals[pe.exerciseId] || {}; st.originals[pe.exerciseId].sets = parseInt(i.value, 10) || 0; } });
            container.querySelectorAll('.mpr-reps').forEach(function(i) { var pe = st.flatRows[parseInt(i.dataset.row)]; if (pe) { st.originals[pe.exerciseId] = st.originals[pe.exerciseId] || {}; st.originals[pe.exerciseId].reps = parseInt(i.value, 10) || 0; } });
            container.querySelectorAll('.mpr-notes').forEach(function(i) { var pe = st.flatRows[parseInt(i.dataset.row)]; if (pe) { st.originals[pe.exerciseId] = st.originals[pe.exerciseId] || {}; st.originals[pe.exerciseId].notes = i.value.trim(); } });
            container.querySelectorAll('.mpr-load').forEach(function(i) { var pe = st.flatRows[parseInt(i.dataset.row)]; if (pe) { st.originals[pe.exerciseId] = st.originals[pe.exerciseId] || {}; st.originals[pe.exerciseId].loadType = parseInt(i.value, 10) || 0; } });
            container.querySelectorAll('.mpr-value').forEach(function(i) { var pe = st.flatRows[parseInt(i.dataset.row)]; var f = i.dataset.field; if (pe && f) { st.originals[pe.exerciseId] = st.originals[pe.exerciseId] || {}; st.originals[pe.exerciseId][f] = parseInt(i.value, 10) || 0; } });
        }

        if (window.PhysioClientExerciseInfo) PhysioClientExerciseInfo.loadAuthImages(container);

        if (needsInit) {
            container._planHandlerAttached = true;
            container.addEventListener('click', _handleClick);
            container.addEventListener('change', _handleChange);
        }
    }

    function _handleChange(e) {
        var sel = e.target.closest('.mpr-load');
        if (!sel) return;
        var container = e.currentTarget;
        var st = _getState(container);
        var rowIdx = parseInt(sel.dataset.row, 10);
        var pe = st.flatRows[rowIdx];
        if (!pe) return;
        pe.loadType = parseInt(sel.value, 10) || 0;
        var valInput = container.querySelector('.mpr-value[data-row="' + rowIdx + '"]');
        var valDiv = valInput ? valInput.parentNode : null;
        if (valDiv) valDiv.outerHTML = _valueDivHTML(pe, rowIdx);
    }

    function _collectEdits(container) {
        var st = _getState(container);
        container.querySelectorAll('.mpr-sets').forEach(function(i) { var pe = st.flatRows[parseInt(i.dataset.row)]; if (pe) pe.sets = parseInt(i.value, 10) || 0; });
        container.querySelectorAll('.mpr-reps').forEach(function(i) { var pe = st.flatRows[parseInt(i.dataset.row)]; if (pe) pe.reps = parseInt(i.value, 10) || 0; });
        container.querySelectorAll('.mpr-notes').forEach(function(i) { var pe = st.flatRows[parseInt(i.dataset.row)]; if (pe) pe.notes = i.value.trim(); });
        container.querySelectorAll('.mpr-load').forEach(function(i) { var pe = st.flatRows[parseInt(i.dataset.row)]; if (pe) pe.loadType = parseInt(i.value, 10) || 0; });
        container.querySelectorAll('.mpr-value').forEach(function(i) { var pe = st.flatRows[parseInt(i.dataset.row)]; var f = i.dataset.field; if (pe && f) pe[f] = parseInt(i.value, 10) || 0; });
    }

    function _rerender(container) {
        var st = _getState(container);
        _renderCircuits(container, st.plan, st.exercises, st.exMap);
    }

    // ── Delegated click handler ───────────────────────────────────────
    function _handleClick(e) {
        var t = e.target;
        var container = e.currentTarget;
        var st = _getState(container);
        var PA = window.PhysioPlanActions;

        var save = t.closest('.mpr-save-btn');
        if (save) { e.stopPropagation(); _collectEdits(container); window.PhysioPlanActions.logChanges(st.plan, st.exercises, st.exMap, st.originals); PA.save(st.plan); return; }

        var prog = t.closest('.mpr-progress');
        if (prog) { e.stopPropagation(); _collectEdits(container); var pe = st.flatRows[parseInt(prog.dataset.row)]; if (pe) { PA.swap(st.exMap, pe, 'progression', st.plan.planId, st.plan.clientId); _rerender(container); } return; }
        var reg = t.closest('.mpr-regress');
        if (reg) { e.stopPropagation(); _collectEdits(container); var rpe = st.flatRows[parseInt(reg.dataset.row)]; if (rpe) { PA.swap(st.exMap, rpe, 'regression', st.plan.planId, st.plan.clientId); _rerender(container); } return; }

        var rot = t.closest('.mpr-rotate');
        if (rot) {
            e.stopPropagation(); _collectEdits(container);
            var rotPe = st.flatRows[parseInt(rot.dataset.row)];
            if (rotPe) PA.openRotatePopup(st.exMap, rotPe, st.planJoint, st.plan.planId, st.plan.clientId, function() { _rerender(container); });
            return;
        }

        var del = t.closest('.mpr-delete');
        if (del) {
            e.stopPropagation(); _collectEdits(container);
            var dpe = st.flatRows[parseInt(del.dataset.row)];
            if (dpe) {
                var delName = (st.exMap[dpe.exerciseId] || {}).name || dpe.exerciseId;
                var delLabel = PA.CATEGORY_LABELS[dpe.circuitNumber] || ('Circuit ' + (dpe.circuitNumber || '?'));
                PA.remove(st.exercises, dpe); st.plan.exercises = st.exercises;
                Layer8MAuth.post(_api() + '/50/ExSwapLog', { clientId: st.plan.clientId, planId: st.plan.planId, oldExerciseId: dpe.exerciseId, newExerciseId: '', direction: 0, swapDate: Math.floor(Date.now() / 1000), therapistId: sessionStorage.getItem('currentUser') || '', description: '[' + delLabel + '] Removed: ' + delName })
                    .catch(function(err) { console.warn('Failed to log delete:', err); });
                _rerender(container);
            }
            return;
        }

        var up = t.closest('.mpr-up');
        var down = t.closest('.mpr-down');
        if (up || down) {
            e.stopPropagation(); _collectEdits(container);
            var mpe = st.flatRows[parseInt((up || down).dataset.row)];
            if (mpe && PA.move(st.exercises, st.exMap, mpe, up ? -1 : 1)) {
                var moveName = (st.exMap[mpe.exerciseId] || {}).name || mpe.exerciseId;
                var moveLabel = PA.CATEGORY_LABELS[mpe.circuitNumber] || ('Circuit ' + (mpe.circuitNumber || '?'));
                Layer8MAuth.post(_api() + '/50/ExSwapLog', { clientId: st.plan.clientId, planId: st.plan.planId, oldExerciseId: mpe.exerciseId, newExerciseId: mpe.exerciseId, direction: 0, swapDate: Math.floor(Date.now() / 1000), therapistId: sessionStorage.getItem('currentUser') || '', description: '[' + moveLabel + '] Moved ' + (up ? 'up' : 'down') + ': ' + moveName })
                    .catch(function(err) { console.warn('Failed to log move:', err); });
                _rerender(container);
            }
            return;
        }

        var add = t.closest('.mpr-add-btn');
        if (add) {
            e.stopPropagation(); _collectEdits(container);
            var aCNum = parseInt(add.dataset.circuit, 10);
            var available = PA.availableForCircuit(st.exercises, st.exMap, aCNum, st.planJoint, st.planPosture);
            var opts = available.length === 0
                ? '<option value="">No exercises available</option>'
                : '<option value="">-- Select --</option>' + available.map(function(ex) {
                    return '<option value="' + Layer8DUtils.escapeHtml(ex.exerciseId) + '">' + Layer8DUtils.escapeHtml(ex.name || ex.exerciseId) + '</option>';
                }).join('');
            Layer8MPopup.show({
                title: 'Add Exercise', size: 'medium', showFooter: true, saveButtonText: 'Add',
                content: '<div style="padding:12px;"><select id="mpr-add-sel" style="width:100%;padding:10px;border:1px solid var(--layer8d-border);border-radius:6px;font-size:14px;">' + opts + '</select></div>',
                onSave: function(popup) {
                    var b = popup && popup.body ? popup.body : popup;
                    var sel = b ? b.querySelector('#mpr-add-sel') : null;
                    var exId = sel ? sel.value : '';
                    if (!exId) { if (typeof Layer8MUtils !== 'undefined') Layer8MUtils.showError('Please select an exercise'); return; }
                    PA.addToPlan(st.exercises, exId, aCNum, st.exMap);
                    st.plan.exercises = st.exercises;
                    var addedName = (st.exMap[exId] || {}).name || exId;
                    var addLabel = PA.CATEGORY_LABELS[aCNum] || ('Circuit ' + aCNum);
                    Layer8MAuth.post(_api() + '/50/ExSwapLog', { clientId: st.plan.clientId, planId: st.plan.planId, oldExerciseId: '', newExerciseId: exId, direction: 0, swapDate: Math.floor(Date.now() / 1000), therapistId: sessionStorage.getItem('currentUser') || '', description: '[' + addLabel + '] Added: ' + addedName })
                        .catch(function(err) { console.warn('Failed to log add:', err); });
                    Layer8MPopup.close();
                    _rerender(container);
                }
            });
            return;
        }

        var vid = t.closest('.mpr-video');
        if (vid) { e.stopPropagation(); if (window.PhysioClientExerciseInfo) PhysioClientExerciseInfo.showVideoPopup(vid.dataset.eid, st.exMap); return; }

        var thumb = t.closest('.mpr-thumb');
        if (thumb) { e.stopPropagation(); if (window.PhysioClientExerciseInfo) PhysioClientExerciseInfo.showImagePopup(thumb.dataset.eid, st.exMap); return; }
    }
})();
