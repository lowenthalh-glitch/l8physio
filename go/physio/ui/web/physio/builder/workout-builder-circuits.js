(function() {
    'use strict';

    function _classificationLabel(posture, joint) {
        var enums = (window.PhysioManagement && window.PhysioManagement.enums) || {};
        var p = (enums.POSTURE && enums.POSTURE[posture]) || '?';
        var j = (enums.JOINT   && enums.JOINT[joint])     || '?';
        return p + ' · ' + j;
    }

    function _setsRepsDisplay(val, displayVal) {
        if (displayVal) return displayVal;
        if (val != null && val !== 0) return String(val);
        return '—';
    }

    function _toSlot(ex) {
        return {
            exerciseId:   ex.exerciseId,
            name:         ex.name || ex.exerciseId || '—',
            sets:         ex.defaultSets  || 0,
            reps:         ex.defaultReps  || 0,
            repsDisplay:  ex.defaultRepsDisplay || '',
            notes:        ex.loadNotes    || '',
            exercise:     ex
        };
    }

    // ── Assemble circuits ──────────────────────────────────────────────────────

    var CATEGORY_LABELS = { 1: 'Mobility', 2: 'Rehab', 3: 'Strength', 4: 'Functional' };

    // Build circuits from per-protocol circuit specs. Each protocol carries:
    //   { posture, joint, circuits: [{ category, count }, ...] }
    // Exercises picked into a circuit are excluded from all later circuits (dedup across plan).
    // If a circuit can't be filled, remaining slots are left null so the therapist sees the gap.
    function _assembleCircuits(allExercises, protocols) {
        var circuits = [];
        var num      = 0;
        var used     = {};

        (protocols || []).forEach(function(proto) {
            if (!proto.circuits || proto.circuits.length === 0) return;

            var protoExs = allExercises.filter(function(ex) {
                var exPostures = (ex.postures && ex.postures.length) ? ex.postures : (ex.posture ? [ex.posture] : []);
                if (exPostures.indexOf(proto.posture) === -1) return false;
                if (!ex.joints || ex.joints.indexOf(proto.joint) === -1) return false;
                return true;
            });

            proto.circuits.forEach(function(spec) {
                var cat   = spec.category;
                var count = spec.count > 0 ? spec.count : 1;

                var catExs = protoExs.filter(function(ex) {
                    if (used[ex.exerciseId]) return false;
                    return ex.categories && ex.categories.indexOf(cat) !== -1;
                });

                num++;
                var slots = [];
                for (var j = 0; j < count; j++) {
                    if (catExs[j]) {
                        used[catExs[j].exerciseId] = true;
                        slots.push(_toSlot(catExs[j]));
                    } else {
                        slots.push(null);
                    }
                }

                circuits.push({
                    num:      num,
                    label:    _classificationLabel(proto.posture, proto.joint) + ' — ' + CATEGORY_LABELS[cat],
                    posture:  proto.posture,
                    joint:    proto.joint,
                    category: cat,
                    slots:    slots
                });
            });
        });

        return circuits;
    }

    // ── Row rendering ──────────────────────────────────────────────────────────

    function _renderRow(slot, rowIndex, circuitIndex) {
        if (!slot) {
            return '<tr class="wb-empty-row" data-circuit="' + circuitIndex + '" data-slot="' + rowIndex + '">' +
                '<td class="wb-num">' + (rowIndex + 1) + '</td>' +
                '<td colspan="5" class="wb-empty-cell">—</td>' +
                '<td class="wb-move-btns"></td>' +
                '<td class="wb-action-col"></td>' +
                '</tr>';
        }

        var circuits  = window.PhysioWorkoutBuilder._lastCircuits || [];
        var slots     = circuits[circuitIndex] ? circuits[circuitIndex].slots : [];
        var canUp     = rowIndex > 0               && slots[rowIndex - 1] != null;
        var canDown   = rowIndex < slots.length - 1 && slots[rowIndex + 1] != null;

        return [
            '<tr data-circuit="' + circuitIndex + '" data-slot="' + rowIndex + '">',
              '<td class="wb-num">' + (rowIndex + 1) + '</td>',
              '<td class="wb-name">' + Layer8DUtils.escapeHtml(slot.name) + '</td>',
              '<td class="wb-sets">' + _setsRepsDisplay(slot.sets) + '</td>',
              '<td class="wb-reps">' + _setsRepsDisplay(slot.reps, slot.repsDisplay) + '</td>',
              '<td class="wb-load">' + Layer8DUtils.escapeHtml(slot.notes || '') + '</td>',
              '<td class="wb-move-btns">',
                (canUp   ? '<button class="wb-move-up"   title="Move up">▲</button>'   : '<span class="wb-move-ph"></span>'),
                (canDown ? '<button class="wb-move-down" title="Move down">▼</button>' : '<span class="wb-move-ph"></span>'),
              '</td>',
              '<td class="wb-action-col">',
                '<button class="wb-action-btn wb-edit-btn" title="Edit">✏️</button>',
                '<button class="wb-action-btn wb-delete-btn" title="Delete">\u{1f5d1}</button>',
              '</td>',
            '</tr>'
        ].join('');
    }

    function _buildPool(circuitIndex, currentExerciseId) {
        var allEx    = window.PhysioWorkoutCircuits._allExercises || [];
        var circuits = window.PhysioWorkoutBuilder._lastCircuits || [];
        var circuit  = circuits[circuitIndex];
        var cat      = circuit ? circuit.category : 0;
        var posture  = circuit ? circuit.posture  : 0;
        var joint    = circuit ? circuit.joint    : 0;

        // Collect exercise IDs already picked anywhere in the plan, except the slot being edited.
        var picked = {};
        circuits.forEach(function(c) {
            (c.slots || []).forEach(function(s) {
                if (s && s.exerciseId && s.exerciseId !== currentExerciseId) {
                    picked[s.exerciseId] = true;
                }
            });
        });

        return allEx.filter(function(ex) {
            if (picked[ex.exerciseId]) return false;
            if (cat) {
                var exCats = (ex.categories && ex.categories.length) ? ex.categories : (ex.category ? [ex.category] : []);
                if (exCats.indexOf(cat) === -1) return false;
            }
            if (posture) {
                var exPostures = (ex.postures && ex.postures.length) ? ex.postures : (ex.posture ? [ex.posture] : []);
                if (exPostures.indexOf(posture) === -1) return false;
            }
            if (joint) {
                if (!ex.joints || ex.joints.indexOf(joint) === -1) return false;
            }
            return true;
        });
    }

    function _renderEditRow(slot, rowIndex, circuitIndex) {
        var pool = _buildPool(circuitIndex, slot ? slot.exerciseId : null);
        var exOpts = pool.map(function(ex) {
            var sel = (slot && ex.exerciseId === slot.exerciseId) ? ' selected' : '';
            return '<option value="' + Layer8DUtils.escapeHtml(ex.exerciseId) + '"' + sel + '>' +
                Layer8DUtils.escapeHtml(ex.name || ex.exerciseId) + '</option>';
        }).join('');

        // For a new (empty) slot, pre-fill sets/reps/notes from the first option in the pool.
        var defaultEx = slot ? null : (pool[0] || null);
        var setsVal   = slot ? (slot.sets  || '') : (defaultEx ? (defaultEx.defaultSets || '') : '');
        var repsVal   = slot ? (slot.reps  || '') : (defaultEx ? (defaultEx.defaultReps || '') : '');
        var notesVal  = slot ? (slot.notes || '') : (defaultEx ? (defaultEx.loadNotes   || '') : '');

        return [
            '<tr class="wb-edit-row" data-circuit="' + circuitIndex + '" data-slot="' + rowIndex + '">',
              '<td class="wb-num">' + (rowIndex + 1) + '</td>',
              '<td>',
                '<select class="wb-edit-input wb-edit-exercise">',
                  exOpts || '<option value="">— No exercises available —</option>',
                '</select>',
              '</td>',
              '<td><input type="number" class="wb-edit-input wb-edit-sets" value="' + setsVal + '" placeholder="Sets" min="0" style="width:80px"></td>',
              '<td><input type="number" class="wb-edit-input wb-edit-reps" value="' + repsVal + '" placeholder="Reps" min="0" style="width:80px"></td>',
              '<td><input type="text" class="wb-edit-input wb-edit-notes" value="' + Layer8DUtils.escapeHtml(notesVal) + '" placeholder="Notes" style="width:100px"></td>',
              '<td class="wb-move-btns"></td>',
              '<td class="wb-action-col wb-action-col-edit">',
                '<button class="layer8d-btn layer8d-btn-primary layer8d-btn-small wb-edit-save">Save</button>',
                '<button class="layer8d-btn layer8d-btn-secondary layer8d-btn-small wb-edit-cancel">Cancel</button>',
              '</td>',
            '</tr>'
        ].join('');
    }

    // ── Circuit rendering ──────────────────────────────────────────────────────

    function _renderCircuit(circuit, circuitIndex) {
        var rows = circuit.slots.map(function(slot, i) {
            return _renderRow(slot, i, circuitIndex);
        }).join('');

        return [
            '<div class="wb-circuit" id="wb-circuit-' + circuitIndex + '">',
              '<div class="wb-circuit-header">Circuit ' + circuit.num + ' — ' + circuit.label + '</div>',
              '<div class="wb-table-scroll">',
                '<table class="wb-table">',
                  '<thead><tr>',
                    '<th>#</th><th>Exercise</th><th>Sets</th><th>Reps</th><th>Notes</th><th></th><th></th>',
                  '</tr></thead>',
                  '<tbody>' + rows + '</tbody>',
                '</table>',
              '</div>',
              '<div class="wb-add-row-bar">',
                '<button class="layer8d-btn layer8d-btn-secondary layer8d-btn-small wb-add-exercise" data-circuit="' + circuitIndex + '">+ Add Exercise</button>',
              '</div>',
            '</div>'
        ].join('');
    }

    function _rerenderCircuit(output, circuitIndex) {
        var circuits = window.PhysioWorkoutBuilder._lastCircuits || [];
        var circuit  = circuits[circuitIndex];
        if (!circuit) return;
        var div = output.querySelector('#wb-circuit-' + circuitIndex);
        if (div) div.outerHTML = _renderCircuit(circuit, circuitIndex);
    }

    // ── Move ──────────────────────────────────────────────────────────────────

    function _moveExercise(output, circuitIdx, slotIdx, dir) {
        var circuits = window.PhysioWorkoutBuilder._lastCircuits;
        if (!circuits || !circuits[circuitIdx]) return;

        var slots  = circuits[circuitIdx].slots;
        var target = slotIdx + dir;

        if (target < 0 || target >= slots.length) return;
        if (!slots[slotIdx] || !slots[target]) return;

        var cur = slots[slotIdx];
        var tgt = slots[target];

        slots[slotIdx] = tgt;
        slots[target]  = cur;
        _rerenderCircuit(output, circuitIdx);
    }

    // ── Event delegation ──────────────────────────────────────────────────────

    function _attachEvents(output) {
        if (output._wbEventsAttached) return;
        output._wbEventsAttached = true;

        // Enter key in edit row triggers save
        output.addEventListener('keydown', function(e) {
            if (e.key !== 'Enter') return;
            var tr = e.target.closest('.wb-edit-row');
            if (!tr) return;
            var saveBtn = tr.querySelector('.wb-edit-save');
            if (saveBtn) saveBtn.click();
        });

        // Exercise picker change: refill sets/reps/notes from the picked exercise's defaults
        output.addEventListener('change', function(e) {
            var sel = e.target.closest('.wb-edit-exercise');
            if (!sel) return;
            var tr = sel.closest('.wb-edit-row');
            if (!tr) return;
            var allEx  = window.PhysioWorkoutCircuits._allExercises || [];
            var chosen = allEx.filter(function(ex) { return ex.exerciseId === sel.value; })[0];
            if (!chosen) return;
            var setsEl  = tr.querySelector('.wb-edit-sets');
            var repsEl  = tr.querySelector('.wb-edit-reps');
            var notesEl = tr.querySelector('.wb-edit-notes');
            if (setsEl)  setsEl.value  = chosen.defaultSets || '';
            if (repsEl)  repsEl.value  = chosen.defaultReps || '';
            if (notesEl) notesEl.value = chosen.loadNotes   || '';
        });

        output.addEventListener('click', function(e) {
            // Move up / down
            var moveBtn = e.target.closest('.wb-move-up, .wb-move-down');
            if (moveBtn) {
                var tr = moveBtn.closest('tr');
                if (tr) {
                    _moveExercise(output,
                        parseInt(tr.dataset.circuit, 10),
                        parseInt(tr.dataset.slot,    10),
                        moveBtn.classList.contains('wb-move-up') ? -1 : 1
                    );
                }
                return;
            }

            // Edit button
            var editBtn = e.target.closest('.wb-edit-btn');
            if (editBtn) {
                var tr2 = editBtn.closest('tr');
                if (!tr2) return;
                var ci = parseInt(tr2.dataset.circuit, 10);
                var si = parseInt(tr2.dataset.slot,    10);
                var circuits = window.PhysioWorkoutBuilder._lastCircuits || [];
                var slot = circuits[ci] ? circuits[ci].slots[si] : null;
                tr2.outerHTML = _renderEditRow(slot, si, ci);
                return;
            }

            // Save inline edit
            var saveBtn = e.target.closest('.wb-edit-save');
            if (saveBtn) {
                var tr3 = saveBtn.closest('tr');
                if (!tr3) return;
                var ci3 = parseInt(tr3.dataset.circuit, 10);
                var si3 = parseInt(tr3.dataset.slot,    10);
                var circuits3 = window.PhysioWorkoutBuilder._lastCircuits || [];
                if (!circuits3[ci3]) return;

                var exSel   = tr3.querySelector('.wb-edit-exercise');
                var setsEl  = tr3.querySelector('.wb-edit-sets');
                var repsEl  = tr3.querySelector('.wb-edit-reps');
                var notesEl = tr3.querySelector('.wb-edit-notes');

                if (!exSel || !exSel.value) {
                    Layer8DNotification.warning('Please select an exercise.');
                    return;
                }

                var allEx3 = window.PhysioWorkoutCircuits._allExercises || [];
                var chosen = allEx3.filter(function(ex) { return ex.exerciseId === exSel.value; })[0];

                circuits3[ci3].slots[si3] = {
                    exerciseId:   exSel.value,
                    name:         chosen ? (chosen.name || exSel.value) : exSel.value,
                    sets:         parseInt(setsEl.value,  10) || 0,
                    reps:         parseInt(repsEl.value,  10) || 0,
                    repsDisplay:  chosen ? (chosen.defaultRepsDisplay || '') : '',
                    notes:        notesEl.value.trim(),
                    exercise:     chosen || null
                };
                _rerenderCircuit(output, ci3);
                return;
            }

            // Cancel inline edit
            var cancelBtn = e.target.closest('.wb-edit-cancel');
            if (cancelBtn) {
                var tr4 = cancelBtn.closest('tr');
                if (!tr4) return;
                var ci4 = parseInt(tr4.dataset.circuit, 10);
                var si4 = parseInt(tr4.dataset.slot,    10);
                var circuits4 = window.PhysioWorkoutBuilder._lastCircuits || [];
                var slot4 = circuits4[ci4] ? circuits4[ci4].slots[si4] : null;
                tr4.outerHTML = _renderRow(slot4, si4, ci4);
                return;
            }

            // Delete button
            var delBtn = e.target.closest('.wb-delete-btn');
            if (delBtn) {
                var tr5 = delBtn.closest('tr');
                if (!tr5) return;
                var ci5 = parseInt(tr5.dataset.circuit, 10);
                var si5 = parseInt(tr5.dataset.slot,    10);
                var circuits5 = window.PhysioWorkoutBuilder._lastCircuits || [];
                if (!circuits5[ci5]) return;
                circuits5[ci5].slots.splice(si5, 1);
                _rerenderCircuit(output, ci5);
                return;
            }

            // Add Exercise
            var addEx = e.target.closest('.wb-add-exercise');
            if (addEx) {
                var ci6 = parseInt(addEx.dataset.circuit, 10);
                var circuits6 = window.PhysioWorkoutBuilder._lastCircuits || [];
                if (!circuits6[ci6]) return;
                var newIdx = circuits6[ci6].slots.length;
                circuits6[ci6].slots.push(null); // placeholder so row index is stable
                _rerenderCircuit(output, ci6);
                var tbody = output.querySelector('#wb-circuit-' + ci6 + ' tbody');
                var allTr = tbody ? tbody.querySelectorAll('tr') : [];
                var lastTr = allTr[allTr.length - 1];
                if (lastTr) lastTr.outerHTML = _renderEditRow(null, newIdx, ci6);
                return;
            }
        });
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    window.PhysioWorkoutCircuits = {
        _allExercises: [],

        assembleCircuits: _assembleCircuits,

        renderAll: function(output, circuits) {
            var html = '<div class="wb-circuits">';
            circuits.forEach(function(c, i) { html += _renderCircuit(c, i); });
            html += '</div>';
            output.innerHTML = html;
            _attachEvents(output);
        }
    };

})();
