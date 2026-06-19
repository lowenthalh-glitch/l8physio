// Session View Rendering — circuit table rendering and event handlers
// Split from session-view.js for maintainability (see session-view.js for data loading)
(function() {
    'use strict';

    var SV = window.PhysioSessionViewInternal;

    function _renderPlanCircuits(container, plan, exercises, exMap) {
        var PA = window.PhysioPlanActions;
        var CATEGORY_LABELS = PA.CATEGORY_LABELS;
        var inputStyle = 'width:60px;padding:4px 6px;border:1px solid var(--layer8d-border);border-radius:4px;font-size:13px;';
        var notesStyle = 'width:100%;padding:4px 6px;border:1px solid var(--layer8d-border);border-radius:4px;font-size:13px;';
        var needsInit = !container._sessionHandlerAttached;

        var result = PA.groupAndSort(exercises, exMap);
        var sortedCircuits = result.circuits;

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
                '<span>Circuit ' + cNum + ' — ' + label + '</span>' +
                '<button class="session-add-btn layer8d-btn layer8d-btn-small" data-circuit="' + cNum + '" style="font-size:11px;padding:2px 8px;background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.4);">+ Add</button></div>';
            html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
            html += '<thead><tr style="background:var(--layer8d-bg-light);">' +
                '<th style="padding:6px 10px;text-align:left;">Exercise</th>' +
                '<th style="padding:6px 10px;text-align:left;width:90px;">Load</th>' +
                '<th style="padding:6px 10px;text-align:left;width:80px;">Value</th>' +
                '<th style="padding:6px 10px;text-align:left;width:70px;">Sets</th>' +
                '<th style="padding:6px 10px;text-align:left;width:70px;">Reps</th>' +
                '<th style="padding:6px 10px;text-align:left;">Notes</th>' +
                '<th style="padding:6px 4px;width:120px;"></th>' +
                '</tr></thead><tbody>';
            displayCircuits[cNum].forEach(function(row) {
                var fullEx = exMap[row.pe.exerciseId] || {};
                var eid = Layer8DUtils.escapeHtml(row.pe.exerciseId);
                var progRegBtns = '';
                if (fullEx.regressionExerciseId) {
                    var regName = (exMap[fullEx.regressionExerciseId] || {}).name || 'easier';
                    progRegBtns += '<button class="session-regress-btn" data-row="' + rowIdx + '" title="Regress to: ' + Layer8DUtils.escapeHtml(regName) + '" style="' + btnStyle + 'font-size:16px;color:var(--layer8d-error);">−</button>';
                }
                if (fullEx.progressionExerciseId) {
                    var progName = (exMap[fullEx.progressionExerciseId] || {}).name || 'harder';
                    progRegBtns += '<button class="session-progress-btn" data-row="' + rowIdx + '" title="Progress to: ' + Layer8DUtils.escapeHtml(progName) + '" style="' + btnStyle + 'font-size:16px;color:var(--layer8d-success);">+</button>';
                }
                if (fullEx.rotationGroupId) {
                    progRegBtns += '<button class="session-rotate-btn" data-row="' + rowIdx + '" title="Rotate" style="' + btnStyle + 'font-size:14px;">↻</button>';
                }
                var actionBtns = '<button class="session-move-up" data-row="' + rowIdx + '" title="Move up" style="' + btnStyle + '">▲</button>' +
                    '<button class="session-move-down" data-row="' + rowIdx + '" title="Move down" style="' + btnStyle + '">▼</button>' +
                    '<button class="session-video-btn" data-eid="' + eid + '" title="Watch video" style="' + btnStyle + '">▶</button>';
                if (fullEx.imageStoragePath) {
                    actionBtns += '<img class="session-img-thumb" data-eid="' + eid + '" data-img-path="' + Layer8DUtils.escapeHtml(fullEx.imageStoragePath) + '" alt="" style="width:28px;height:28px;object-fit:cover;border-radius:3px;cursor:pointer;vertical-align:middle;background:var(--layer8d-bg-light);">';
                }
                actionBtns += '<button class="session-delete-btn" data-row="' + rowIdx + '" title="Remove exercise" style="' + btnStyle + 'color:var(--layer8d-error);">✖</button>';

                var loadDropdown = PhysioPlanActions.loadTypeSelect(row.loadType, 'session-edit-load', ' data-row="' + rowIdx + '"');

                html += '<tr style="border-bottom:1px solid var(--layer8d-border);">' +
                    '<td style="padding:6px 10px;">' + Layer8DUtils.escapeHtml(row.name) + ' ' + progRegBtns + '</td>' +
                    '<td style="padding:6px 10px;">' + loadDropdown + '</td>' +
                    '<td style="padding:6px 10px;">' + SV.valueCellInner(row, rowIdx) + '</td>' +
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

        var st = SV.getState(container);
        st.flatRows = [];
        Object.keys(displayCircuits).sort().forEach(function(cNum) {
            displayCircuits[cNum].forEach(function(row) { st.flatRows.push(row.pe); });
        });
        st.plan = plan;
        st.exercises = exercises;
        st.exMap = exMap;
        if (!st.originals) {
            st.originals = {};
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
            container.querySelectorAll('.session-edit-value').forEach(function(input) {
                var idx = parseInt(input.dataset.row, 10);
                var pe = st.flatRows[idx];
                if (pe && input.dataset.field) {
                    if (!st.originals[pe.exerciseId]) st.originals[pe.exerciseId] = {};
                    st.originals[pe.exerciseId][input.dataset.field] = parseInt(input.value, 10) || 0;
                }
            });
        }

        if (window.PhysioClientExerciseInfo) {
            PhysioClientExerciseInfo.loadAuthImages(container);
        }

        if (needsInit) {
            container._sessionHandlerAttached = true;
            container.addEventListener('click', _handleContainerClick);
            container.addEventListener('change', _handleContainerChange);
        }
    }

    function _handleContainerChange(e) {
        var sel = e.target.closest('.session-edit-load');
        if (!sel) return;
        var container = e.currentTarget;
        var st = SV.getState(container);
        var rowIdx = parseInt(sel.dataset.row, 10);
        var pe = st.flatRows[rowIdx];
        if (!pe) return;
        pe.loadType = parseInt(sel.value, 10) || 0;
        var valInput = container.querySelector('.session-edit-value[data-row="' + rowIdx + '"]');
        var valTd = valInput ? valInput.closest('td') : null;
        if (valTd) valTd.innerHTML = SV.valueCellInner(pe, rowIdx);
    }

    function _handleContainerClick(e) {
        var t = e.target;
        var container = e.currentTarget;
        var st = SV.getState(container);
        var PA = window.PhysioPlanActions;

        var save = t.closest('.session-save-btn');
        if (save) {
            e.stopPropagation();
            SV.collectEdits(container);
            SV.logPlanChanges(st);
            PA.save(st.plan);
            return;
        }

        var prog = t.closest('.session-progress-btn');
        if (prog) { e.stopPropagation(); SV.collectEdits(container); var pi = parseInt(prog.dataset.row, 10); var ppe = st.flatRows[pi]; if (ppe) { PA.swap(st.exMap, ppe, 'progression', st.plan.planId, st.plan.clientId); SV.rerender(container); } return; }
        var reg = t.closest('.session-regress-btn');
        if (reg) { e.stopPropagation(); SV.collectEdits(container); var ri = parseInt(reg.dataset.row, 10); var rpe = st.flatRows[ri]; if (rpe) { PA.swap(st.exMap, rpe, 'regression', st.plan.planId, st.plan.clientId); SV.rerender(container); } return; }

        var rot = t.closest('.session-rotate-btn');
        if (rot) {
            e.stopPropagation(); SV.collectEdits(container);
            var roti = parseInt(rot.dataset.row, 10);
            var rotPe = st.flatRows[roti];
            if (rotPe) PA.openRotatePopup(st.exMap, rotPe, st.planJoints, st.plan.planId, st.plan.clientId, function() { SV.rerender(container); });
            return;
        }

        var del = t.closest('.session-delete-btn');
        if (del) {
            e.stopPropagation(); SV.collectEdits(container);
            var di = parseInt(del.dataset.row, 10); var dpe = st.flatRows[di];
            if (dpe) {
                var delName = (st.exMap[dpe.exerciseId] || {}).name || dpe.exerciseId;
                var delLabel = PA.CATEGORY_LABELS[dpe.circuitNumber] || ('Circuit ' + (dpe.circuitNumber || '?'));
                PA.remove(st.exercises, dpe); st.plan.exercises = st.exercises;
                fetch(SV.apiPrefix() + '/50/ExSwapLog', {
                    method: 'POST',
                    headers: Object.assign({}, SV.headers(), { 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                        clientId: st.plan.clientId, planId: st.plan.planId,
                        oldExerciseId: dpe.exerciseId, newExerciseId: '',
                        direction: 0, swapDate: Math.floor(Date.now() / 1000),
                        therapistId: sessionStorage.getItem('currentUser') || '',
                        description: '[' + delLabel + '] Removed: ' + delName
                    })
                }).catch(function(err) { console.warn('Failed to log delete:', err); });
                SV.rerender(container);
            }
            return;
        }

        var up = t.closest('.session-move-up');
        var down = t.closest('.session-move-down');
        if (up || down) {
            e.stopPropagation(); SV.collectEdits(container);
            var mi = parseInt((up || down).dataset.row, 10);
            var mpe = st.flatRows[mi];
            if (mpe && PA.move(st.exercises, st.exMap, mpe, up ? -1 : 1)) {
                var moveName = (st.exMap[mpe.exerciseId] || {}).name || mpe.exerciseId;
                var moveLabel = PA.CATEGORY_LABELS[mpe.circuitNumber] || ('Circuit ' + (mpe.circuitNumber || '?'));
                var moveDir = up ? 'up' : 'down';
                fetch(SV.apiPrefix() + '/50/ExSwapLog', {
                    method: 'POST',
                    headers: Object.assign({}, SV.headers(), { 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                        clientId: st.plan.clientId, planId: st.plan.planId,
                        oldExerciseId: mpe.exerciseId, newExerciseId: mpe.exerciseId,
                        direction: 0, swapDate: Math.floor(Date.now() / 1000),
                        therapistId: sessionStorage.getItem('currentUser') || '',
                        description: '[' + moveLabel + '] Moved ' + moveDir + ': ' + moveName
                    })
                }).catch(function(err) { console.warn('Failed to log move:', err); });
                SV.rerender(container);
            }
            return;
        }

        var add = t.closest('.session-add-btn');
        if (add) {
            e.stopPropagation(); SV.collectEdits(container);
            var aCNum = parseInt(add.dataset.circuit, 10);
            var available = PA.availableForCircuit(st.exercises, st.exMap, aCNum, st.planJoints, st.planPostures);
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
                    var addedName = (st.exMap[exId] || {}).name || exId;
                    var addLabel = PA.CATEGORY_LABELS[aCNum] || ('Circuit ' + aCNum);
                    fetch(SV.apiPrefix() + '/50/ExSwapLog', {
                        method: 'POST',
                        headers: Object.assign({}, SV.headers(), { 'Content-Type': 'application/json' }),
                        body: JSON.stringify({
                            clientId: st.plan.clientId, planId: st.plan.planId,
                            oldExerciseId: '', newExerciseId: exId,
                            direction: 0, swapDate: Math.floor(Date.now() / 1000),
                            therapistId: sessionStorage.getItem('currentUser') || '',
                            description: '[' + addLabel + '] Added: ' + addedName
                        })
                    }).catch(function(err) { console.warn('Failed to log add:', err); });
                    Layer8DPopup.close();
                    SV.rerender(container);
                }
            });
            return;
        }

        var vid = t.closest('.session-video-btn');
        if (vid) { e.stopPropagation(); PhysioClientExerciseInfo.showVideoPopup(vid.dataset.eid, st.exMap); return; }
        var img = t.closest('.session-img-thumb');
        if (img) { e.stopPropagation(); PhysioClientExerciseInfo.showImagePopup(img.dataset.eid, st.exMap); return; }
    }

    window.PhysioSessionRendering = {
        renderPlanCircuits: _renderPlanCircuits
    };

})();
