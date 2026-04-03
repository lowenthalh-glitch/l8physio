(function() {
    'use strict';

    var POSTURE_CODES = { 1:'KYPH', 2:'LORD', 3:'UFLAT', 4:'LFLAT', 5:'VALG', 6:'PRON', 7:'GEN' };
    var JOINT_CODES   = { 1:'SHO',  2:'KNE',  3:'ANK',  4:'LBP',  5:'ELB',  6:'GEN', 7:'HIP', 8:'CORE', 9:'SIJ' };

    function _protocolCode(posture, joint) {
        return (POSTURE_CODES[posture] || '?') + '-' + (JOINT_CODES[joint] || '?');
    }

    function _enumLabel(val, map) {
        if (!map) return val || '—';
        return map[val] || '—';
    }

    function _setsRepsDisplay(val, displayVal) {
        if (displayVal) return displayVal;
        if (val != null && val !== 0) return String(val);
        return '\u2014';
    }

    function _toSlot(ex) {
        return {
            exerciseId:   ex.exerciseId,
            exerciseType: ex.exerciseType,
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
    var CATEGORY_ORDER  = [1, 2, 3, 4];

    function _assembleCircuits(allExercises, protocols, _unused, phase, volume) {
        var phaseInt      = parseInt(phase,  10);
        var variableSlots = parseInt(volume, 10) - 2;
        var circuits      = [];
        var num           = 0;

        protocols.forEach(function(proto) {
            var protoExs = allExercises.filter(function(ex) {
                if (ex.posture !== proto.posture || ex.joint !== proto.joint) return false;
                var p = ex.phase || 0;
                return p === 0 || p <= phaseInt;
            });

            CATEGORY_ORDER.forEach(function(cat) {
                var catExs   = protoExs.filter(function(ex) { return ex.category === cat; });
                var fixed    = catExs.filter(function(ex) { return ex.exerciseType === 1; });
                var variable = catExs.filter(function(ex) { return ex.exerciseType === 2; });
                if (fixed.length === 0 && variable.length === 0) return;

                num++;
                var slots = [];
                slots.push(fixed[0] ? _toSlot(fixed[0]) : null);
                slots.push(fixed[1] ? _toSlot(fixed[1]) : null);
                for (var j = 0; j < variableSlots; j++) {
                    slots.push(variable[j] ? _toSlot(variable[j]) : null);
                }

                var code = _protocolCode(proto.posture, proto.joint);
                circuits.push({
                    num:          num,
                    label:        code + ' \u2014 ' + CATEGORY_LABELS[cat],
                    protocolCode: code,
                    category:     cat,
                    slots:        slots
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
                '<td colspan="6" class="wb-empty-cell">\u2014</td>' +
                '<td class="wb-move-btns"></td>' +
                '<td class="wb-action-col"></td>' +
                '</tr>';
        }

        var enums     = (window.PhysioManagement && window.PhysioManagement.enums) || {};
        var typeLabel = slot.exerciseType === 1 ? 'Fixed' : 'Variable';
        var typeCls   = slot.exerciseType === 1 ? 'wb-badge-fixed' : 'wb-badge-var';

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
              '<td><span class="wb-badge ' + typeCls + '">' + typeLabel + '</span></td>',
              '<td class="wb-move-btns">',
                (canUp   ? '<button class="wb-move-up"   title="Move up">\u25b2</button>'   : '<span class="wb-move-ph"></span>'),
                (canDown ? '<button class="wb-move-down" title="Move down">\u25bc</button>' : '<span class="wb-move-ph"></span>'),
              '</td>',
              '<td class="wb-action-col">',
                '<button class="wb-action-btn wb-edit-btn" title="Edit">\u270f\ufe0f</button>',
                '<button class="wb-action-btn wb-delete-btn" title="Delete">\u{1f5d1}</button>',
              '</td>',
            '</tr>'
        ].join('');
    }

    function _renderEditRow(slot, rowIndex, circuitIndex) {
        var enums       = (window.PhysioManagement && window.PhysioManagement.enums) || {};
        var typeLabel   = slot ? (slot.exerciseType === 1 ? 'Fixed' : 'Variable') : '';
        var exerciseType = slot ? slot.exerciseType : 2;

        // Build exercise options from cached pool filtered to same type
        var allEx  = window.PhysioWorkoutCircuits._allExercises || [];
        var pool   = allEx.filter(function(ex) { return ex.exerciseType === exerciseType; });
        var exOpts = pool.map(function(ex) {
            var sel = (slot && ex.exerciseId === slot.exerciseId) ? ' selected' : '';
            return '<option value="' + Layer8DUtils.escapeHtml(ex.exerciseId) + '"' + sel + '>' +
                Layer8DUtils.escapeHtml(ex.name || ex.exerciseId) + '</option>';
        }).join('');

        var setsVal  = slot ? (slot.sets  || '') : '';
        var repsVal  = slot ? (slot.reps  || '') : '';
        var notesVal = slot ? (slot.notes || '') : '';

        return [
            '<tr class="wb-edit-row" data-circuit="' + circuitIndex + '" data-slot="' + rowIndex + '">',
              '<td class="wb-num">' + (rowIndex + 1) + '</td>',
              '<td>',
                '<select class="wb-edit-input wb-edit-exercise">',
                  exOpts || '<option value="">— No exercises available —</option>',
                '</select>',
              '</td>',
              '<td><input type="number" class="wb-edit-input wb-edit-sets" value="' + setsVal + '" placeholder="Sets" min="0" style="width:52px"></td>',
              '<td><input type="number" class="wb-edit-input wb-edit-reps" value="' + repsVal + '" placeholder="Reps" min="0" style="width:52px"></td>',
              '<td><input type="text" class="wb-edit-input wb-edit-notes" value="' + Layer8DUtils.escapeHtml(notesVal) + '" placeholder="Notes" style="width:100px"></td>',
              '<td><span class="wb-badge ' + (exerciseType === 1 ? 'wb-badge-fixed' : 'wb-badge-var') + '">' + typeLabel + '</span></td>',
              '<td class="wb-move-btns"></td>',
              '<td class="wb-action-col">',
                '<button class="wb-action-btn wb-edit-save" title="Save">\u2713</button>',
                '<button class="wb-action-btn wb-edit-cancel" title="Cancel">\u00d7</button>',
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
              '<div class="wb-circuit-header">Circuit ' + circuit.num + ' \u2014 ' + circuit.label + '</div>',
              '<table class="wb-table">',
                '<thead><tr>',
                  '<th>#</th><th>Exercise</th><th>Sets</th><th>Reps</th><th>Notes</th><th>Type</th><th></th><th></th>',
                '</tr></thead>',
                '<tbody>' + rows + '</tbody>',
              '</table>',
              '<div class="wb-add-row-bar">',
                '<button class="layer8d-btn layer8d-btn-secondary layer8d-btn-small wb-add-fixed" data-circuit="' + circuitIndex + '">+ Add Fixed</button>',
                '<button class="layer8d-btn layer8d-btn-secondary layer8d-btn-small wb-add-variable" data-circuit="' + circuitIndex + '">+ Add Variable</button>',
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

        if (dir === -1 && cur.exerciseType === 2 && tgt.exerciseType === 1) {
            Layer8DNotification.warning('Variable exercises cannot be placed above Fixed exercises.');
            return;
        }
        if (dir === 1 && cur.exerciseType === 1 && tgt.exerciseType === 2) {
            Layer8DNotification.warning('Fixed exercises cannot be placed below Variable exercises.');
            return;
        }

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
                var existingSlot = circuits3[ci3].slots[si3];
                var exType = existingSlot ? existingSlot.exerciseType : (chosen ? chosen.exerciseType : 2);

                circuits3[ci3].slots[si3] = {
                    exerciseId:   exSel.value,
                    exerciseType: exType,
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

            // Add Fixed
            var addFixed = e.target.closest('.wb-add-fixed');
            if (addFixed) {
                var ci6 = parseInt(addFixed.dataset.circuit, 10);
                var circuits6 = window.PhysioWorkoutBuilder._lastCircuits || [];
                if (!circuits6[ci6]) return;
                var newIdx = circuits6[ci6].slots.length;
                circuits6[ci6].slots.push(null); // placeholder so row index is stable
                _rerenderCircuit(output, ci6);
                // Open edit form on the new row immediately
                var newTr = output.querySelector('#wb-circuit-' + ci6 + ' tbody tr:last-child');
                if (newTr) {
                    // Last row is the add-bar, get last tbody tr
                    var tbody = output.querySelector('#wb-circuit-' + ci6 + ' tbody');
                    var allTr = tbody ? tbody.querySelectorAll('tr') : [];
                    var lastTr = allTr[allTr.length - 1];
                    if (lastTr) lastTr.outerHTML = _renderEditRowForType(newIdx, ci6, 1);
                }
                return;
            }

            // Add Variable
            var addVar = e.target.closest('.wb-add-variable');
            if (addVar) {
                var ci7 = parseInt(addVar.dataset.circuit, 10);
                var circuits7 = window.PhysioWorkoutBuilder._lastCircuits || [];
                if (!circuits7[ci7]) return;
                var newIdx7 = circuits7[ci7].slots.length;
                circuits7[ci7].slots.push(null);
                _rerenderCircuit(output, ci7);
                var tbody7 = output.querySelector('#wb-circuit-' + ci7 + ' tbody');
                var allTr7 = tbody7 ? tbody7.querySelectorAll('tr') : [];
                var lastTr7 = allTr7[allTr7.length - 1];
                if (lastTr7) lastTr7.outerHTML = _renderEditRowForType(newIdx7, ci7, 2);
                return;
            }
        });
    }

    // Render an edit row for a brand-new slot of a given type (no existing slot data)
    function _renderEditRowForType(rowIndex, circuitIndex, exerciseType) {
        var allEx  = window.PhysioWorkoutCircuits._allExercises || [];
        var pool   = allEx.filter(function(ex) { return ex.exerciseType === exerciseType; });
        var exOpts = pool.map(function(ex) {
            return '<option value="' + Layer8DUtils.escapeHtml(ex.exerciseId) + '">' +
                Layer8DUtils.escapeHtml(ex.name || ex.exerciseId) + '</option>';
        }).join('');
        var typeCls   = exerciseType === 1 ? 'wb-badge-fixed' : 'wb-badge-var';
        var typeLabel = exerciseType === 1 ? 'Fixed' : 'Variable';

        return [
            '<tr class="wb-edit-row" data-circuit="' + circuitIndex + '" data-slot="' + rowIndex + '">',
              '<td class="wb-num">' + (rowIndex + 1) + '</td>',
              '<td>',
                '<select class="wb-edit-input wb-edit-exercise">',
                  exOpts || '<option value="">— No exercises available —</option>',
                '</select>',
              '</td>',
              '<td><input type="number" class="wb-edit-input wb-edit-sets" placeholder="Sets" min="0" style="width:52px"></td>',
              '<td><input type="number" class="wb-edit-input wb-edit-reps" placeholder="Reps" min="0" style="width:52px"></td>',
              '<td><input type="text" class="wb-edit-input wb-edit-notes" placeholder="Notes" style="width:100px"></td>',
              '<td><span class="wb-badge ' + typeCls + '">' + typeLabel + '</span></td>',
              '<td class="wb-move-btns"></td>',
              '<td class="wb-action-col">',
                '<button class="wb-action-btn wb-edit-save" title="Save">\u2713</button>',
                '<button class="wb-action-btn wb-edit-cancel" title="Cancel">\u00d7</button>',
              '</td>',
            '</tr>'
        ].join('');
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
