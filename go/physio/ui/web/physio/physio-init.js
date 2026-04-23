(function() {
    'use strict';
    Layer8DModuleFactory.create({
        namespace:         'Physio',
        defaultModule:     'management',
        defaultService:    'therapists',
        sectionSelector:   'management',
        initializerName:   'initializePhysio',
        requiredNamespaces: ['PhysioManagement']
    });

    var origInit = window.initializePhysio;
    window.initializePhysio = function() {
        if (typeof origInit === 'function') origInit();

        // Load name lookup maps for column rendering
        if (PhysioManagement.lookups && PhysioManagement.lookups.load) {
            PhysioManagement.lookups.load();
        }

        // Override loadServiceView to handle 'builder' (not in config — nav bails early without this)
        var origLoadSV = window.Physio && window.Physio.loadServiceView;
        if (typeof origLoadSV === 'function') {
            window.Physio.loadServiceView = function(moduleKey, serviceKey) {
                if (serviceKey === 'htdash') {
                    var sectionEl = window.Physio._state && window.Physio._state.sectionEl;
                    if (sectionEl) {
                        sectionEl.querySelectorAll('.l8-service-view').forEach(function(v) {
                            v.classList.toggle('active', v.dataset.service === 'htdash');
                        });
                        sectionEl.querySelectorAll('.l8-subnav-item').forEach(function(a) {
                            a.classList.toggle('active', a.dataset.service === 'htdash');
                        });
                    }
                    setTimeout(function() {
                        if (window.PhysioHeadDashboard) {
                            PhysioHeadDashboard.init('management-htdash-table-container');
                        }
                    }, 50);
                    return;
                }
                if (serviceKey === 'builder') {
                    var sectionEl = window.Physio._state && window.Physio._state.sectionEl;
                    if (sectionEl) {
                        sectionEl.querySelectorAll('.l8-service-view').forEach(function(v) {
                            v.classList.toggle('active', v.dataset.service === 'builder');
                        });
                    }
                    setTimeout(function() {
                        PhysioWorkoutBuilder.init('physio-workout-builder');
                    }, 50);
                    return;
                }
                origLoadSV.call(this, moduleKey, serviceKey);
            };
        }

        // Override _openAddModal for PhysioClient/PhysioTherapist to auto-create user accounts
        var origOpenAdd = window.Physio && window.Physio._openAddModal;
        if (typeof origOpenAdd === 'function') {
            window.Physio._openAddModal = function(service) {
                if ((service.model === 'PhysioClient' || service.model === 'PhysioTherapist') && window.PhysioUserProvisioning) {
                    var formDef = Layer8DServiceRegistry.getFormDef('Physio', service.model);
                    if (!formDef) { origOpenAdd.call(this, service); return; }
                    var svcConfig = {
                        endpoint: Layer8DConfig.resolveEndpoint(service.endpoint),
                        primaryKey: Layer8DServiceRegistry.getPrimaryKey('Physio', service.model),
                        modelName: service.model
                    };
                    Layer8DPopup.show({
                        title: 'Add ' + formDef.title,
                        content: Layer8DForms.generateFormHtml(formDef, {}),
                        size: 'large',
                        showFooter: true,
                        saveButtonText: 'Save',
                        onSave: async function() {
                            var data = Layer8DForms.collectFormData(formDef);
                            var errors = Layer8DForms.validateFormData(formDef, data);
                            if (errors.length > 0) {
                                Layer8DNotification.error('Validation failed', errors.map(function(e) { return e.message; }));
                                return;
                            }
                            try {
                                var result = await Layer8DForms.saveRecord(svcConfig.endpoint, data, false);
                                Layer8DPopup.close();
                                if (window.Physio.refreshCurrentTable) window.Physio.refreshCurrentTable();
                                // saveRecord returns a transaction result, not the entity.
                                // Build the entity from the form data + the generated ID.
                                var entity = Object.assign({}, data);
                                if (result && result.id) {
                                    entity[svcConfig.primaryKey] = result.id;
                                }
                                if (entity) {
                                    if (service.model === 'PhysioClient') PhysioUserProvisioning.createClientUser(entity);
                                    else PhysioUserProvisioning.createTherapistUser(entity);
                                }
                            } catch (err) {
                                Layer8DNotification.error('Error saving', [err.message]);
                            }
                        },
                        onShow: function(body) {
                            Layer8DForms.setFormContext(formDef, svcConfig);
                            setTimeout(function() { Layer8DForms.attachDatePickers(body); }, 50);
                        }
                    });
                } else {
                    origOpenAdd.call(this, service);
                }
            };
        }

        var origShowDetails = window.Physio && window.Physio._showDetailsModal;
        console.log('[physio-init] origShowDetails type:', typeof origShowDetails, '| PhysioPlanEditor:', !!window.PhysioPlanEditor);
        if (typeof origShowDetails === 'function') {
            window.Physio._showDetailsModal = function(service, item, itemId) {
                console.log('[physio-init] _showDetailsModal called for model:', service.model);
                if (service.model === 'HeadThDashRow') {
                    _showDashboardDetail(item);
                } else if (service.model === 'BoostappCalendarEvent') {
                    _showSessionView(item);
                } else if (service.model === 'PhysioClient' && window.PhysioClientExercises) {
                    PhysioClientExercises.open(itemId || (item && item.clientId));
                } else if (service.model === 'PhysioTherapist') {
                    _showTherapistClients(item, itemId);
                } else if (service.model === 'TreatmentPlan' && window.PhysioPlanEditor) {
                    _showTreatmentPlan(item, itemId);
                } else {
                    console.log('[physio-init] falling back to origShowDetails for model:', service.model);
                    origShowDetails.call(this, service, item, itemId);
                }
            };
        } else {
            console.warn('[physio-init] origShowDetails is not a function — override not installed');
        }
    };

    function _showTreatmentPlan(item, planId) {
        var id = planId || (item && item.planId);
        if (!id) return;
        PhysioPlanEditor.open(item, function() {
            if (window.Physio && window.Physio.loadServiceView) {
                window.Physio.loadServiceView('management', 'plans');
            }
        });
    }

    function _showTherapistClients(item, therapistId) {
        var tid = therapistId || (item && item.therapistId);
        if (!tid) return;

        var therapistName = (item && item.firstName && item.lastName)
            ? (item.firstName + ' ' + item.lastName)
            : (PhysioManagement.lookups ? PhysioManagement.lookups.therapistName(tid) : tid);

        var formDef = Layer8DServiceRegistry.getFormDef('Physio', 'PhysioTherapist');
        var svcConfig = {
            endpoint: Layer8DConfig.resolveEndpoint('/50/PhyTherapt'),
            primaryKey: 'therapistId',
            modelName: 'PhysioTherapist'
        };

        // Build details HTML — render each section as a labeled block (not tabs within tabs)
        var detailsHtml = '';
        if (formDef && item) {
            formDef.sections.forEach(function(section) {
                detailsHtml += '<div style="margin-bottom:16px;">';
                detailsHtml += '<h4 style="margin:0 0 8px;color:var(--layer8d-text-dark);font-size:14px;border-bottom:1px solid var(--layer8d-border);padding-bottom:6px;">' +
                    Layer8DUtils.escapeHtml(section.title) + '</h4>';
                detailsHtml += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;">';
                section.fields.forEach(function(field) {
                    var val = item[field.key];
                    var display = '';
                    if (field.type === 'date' && val) {
                        display = Layer8DUtils.formatDate(val);
                    } else if (field.type === 'datetime' && val) {
                        display = Layer8DUtils.formatDateTime(val);
                    } else if (field.type === 'checkbox') {
                        display = val ? 'Yes' : 'No';
                    } else if (field.type === 'select' && field.options) {
                        display = field.options[val] || val || '\u2014';
                    } else {
                        display = val || '\u2014';
                    }
                    detailsHtml += '<div style="font-size:13px;">' +
                        '<span style="color:var(--layer8d-text-muted);">' + Layer8DUtils.escapeHtml(field.label) + ':</span> ' +
                        '<span style="color:var(--layer8d-text-dark);">' + Layer8DUtils.escapeHtml(String(display)) + '</span></div>';
                });
                detailsHtml += '</div></div>';
            });
        }

        var containerId = 'therapist-clients-popup-table';
        var popupContent = '<div class="probler-popup-tabs">' +
            '<div class="probler-popup-tab active" data-tab="details">Personal Details</div>' +
            '<div class="probler-popup-tab" data-tab="clients">Clients</div>' +
            '</div>' +
            '<div class="probler-popup-tab-content">' +
            '<div class="probler-popup-tab-pane active" data-pane="details" style="min-height:200px;">' + detailsHtml + '</div>' +
            '<div class="probler-popup-tab-pane" data-pane="clients"><div id="' + containerId + '" style="min-height:200px;"></div></div>' +
            '</div>';

        Layer8DPopup.show({
            title: therapistName,
            content: popupContent,
            size: 'large',
            showFooter: false,
            onShow: function(body) {
                // Lazy-load clients table on tab click
                var clientsLoaded = false;
                body.addEventListener('click', function(e) {
                    var tab = e.target.closest('.probler-popup-tab[data-tab="clients"]');
                    if (tab && !clientsLoaded) {
                        clientsLoaded = true;
                        _loadTherapistClientsTable(containerId, tid);
                    }
                });
            }
        });
    }

    function _loadTherapistClientsTable(containerId, tid) {
        var el = document.getElementById(containerId);
        if (!el || typeof Layer8DTable === 'undefined') return;

        var colFactory = window.Layer8ColumnFactory;
        var cols = [
            ...colFactory.col('firstName', 'First Name'),
            ...colFactory.col('lastName',  'Last Name'),
            ...colFactory.col('email',     'Email'),
            ...colFactory.col('phone',     'Phone'),
            ...colFactory.col('diagnosis', 'Diagnosis')
        ];

        var table = new Layer8DTable({
            containerId: containerId,
            endpoint: Layer8DConfig.resolveEndpoint('/50/PhyClient'),
            modelName: 'PhysioClient',
            columns: cols,
            primaryKey: 'clientId',
            pageSize: 20,
            serverSide: true,
            baseWhereClause: 'therapistId=' + tid,
            showActions: false
        });
        table.init();
    }

    // ── Dashboard detail popup with override + swap log ──────────────
    window._showDashboardDetail = function(item, onRefresh) {
        if (!item) return;
        var clientId = item.clientId;
        var render = PhysioManagement.render;

        var STATUS_OPTS = { 0: '\u2014 Clear \u2014', 1: 'Green', 2: 'Yellow', 3: 'Red' };
        var currentOverride = item.overrideStatus || 0;

        var overrideHtml = '<select id="htdash-override-select" style="padding:6px 10px;border-radius:4px;border:1px solid var(--layer8d-border);">';
        Object.keys(STATUS_OPTS).forEach(function(k) {
            overrideHtml += '<option value="' + k + '"' + (parseInt(k) === currentOverride ? ' selected' : '') + '>' + STATUS_OPTS[k] + '</option>';
        });
        overrideHtml += '</select>';

        var overviewHtml = '<div style="padding:8px 0;">' +
            '<div style="margin-bottom:12px;"><strong>Client:</strong> ' + Layer8DUtils.escapeHtml(item.clientName || '') + '</div>' +
            '<div style="margin-bottom:12px;"><strong>Therapist:</strong> ' + Layer8DUtils.escapeHtml(item.therapistName || '') + '</div>' +
            '<div style="margin-bottom:12px;"><strong>Last Feedback:</strong> ' + (item.lastFeedbackDate ? Layer8DUtils.formatDate(item.lastFeedbackDate) : '\u2014') +
            ' ' + (item.lastFeedbackStatus ? render.sessionStatus(item.lastFeedbackStatus) : '') + '</div>' +
            '<div style="margin-bottom:12px;"><strong>Last Session:</strong> ' + (item.lastSessionDate ? Layer8DUtils.formatDate(item.lastSessionDate) : '\u2014') +
            ' ' + (item.lastSessionStatus ? render.sessionStatus(item.lastSessionStatus) : '') + '</div>' +
            '<div style="margin-bottom:12px;"><strong>Reason:</strong> ' + Layer8DUtils.escapeHtml(item.statusReason || 'None') + '</div>' +
            '<div style="margin-bottom:12px;"><strong>Swaps:</strong> ' + (item.swapCount || 0) + '</div>' +
            '<div style="margin-bottom:12px;border-top:1px solid var(--layer8d-border);padding-top:12px;">' +
            '<div style="margin-bottom:8px;"><strong>Override Reason:</strong> <input type="text" id="htdash-override-reason" placeholder="Reason for override (required)" style="padding:6px 10px;border-radius:4px;border:1px solid var(--layer8d-border);width:100%;"></div>' +
            '<div style="display:flex;align-items:center;gap:12px;"><strong>Override Status:</strong> ' + overrideHtml +
            ' <button id="htdash-save-override" class="layer8d-btn layer8d-btn-primary layer8d-btn-small">Save Override</button></div>' +
            '</div></div>';

        var swapTableId = 'htdash-swaplog-table';
        var timelineId = 'htdash-timeline-container';
        var planContainerId = 'htdash-plan-container';

        var popupContent = '<div class="probler-popup-tabs">' +
            '<div class="probler-popup-tab active" data-tab="overview">Overview</div>' +
            '<div class="probler-popup-tab" data-tab="plan">Workout Plan</div>' +
            '<div class="probler-popup-tab" data-tab="timeline">Timeline</div>' +
            '<div class="probler-popup-tab" data-tab="swaps">Exercise Changes</div>' +
            '</div>' +
            '<div class="probler-popup-tab-content">' +
            '<div class="probler-popup-tab-pane active" data-pane="overview">' + overviewHtml + '</div>' +
            '<div class="probler-popup-tab-pane" data-pane="plan"><div id="' + planContainerId + '" style="min-height:200px;"></div></div>' +
            '<div class="probler-popup-tab-pane" data-pane="timeline"><div id="' + timelineId + '" style="min-height:200px;"></div></div>' +
            '<div class="probler-popup-tab-pane" data-pane="swaps"><div id="' + swapTableId + '" style="min-height:200px;"></div></div>' +
            '</div>';

        Layer8DPopup.show({
            title: item.clientName || 'Client Dashboard',
            content: popupContent,
            size: 'xlarge',
            showFooter: false,
            onShow: function(body) {
                // Override save handler — requires reason before saving
                var saveBtn = body.querySelector('#htdash-save-override');
                if (saveBtn) {
                    saveBtn.addEventListener('click', function() {
                        var sel = body.querySelector('#htdash-override-select');
                        var reasonInput = body.querySelector('#htdash-override-reason');
                        var newStatus = sel ? parseInt(sel.value, 10) : 0;
                        var reason = reasonInput ? reasonInput.value.trim() : '';
                        if (!reason) {
                            Layer8DNotification.error('Please enter a reason for the override.');
                            if (reasonInput) reasonInput.focus();
                            return;
                        }
                        _saveOverride(clientId, currentOverride, newStatus, reason, function() {
                            currentOverride = newStatus;
                            if (reasonInput) reasonInput.value = '';
                            // Refresh timeline in place
                            if (window.PhysioDashTimeline) {
                                var tlContainer = body.querySelector('#' + timelineId);
                                if (tlContainer) PhysioDashTimeline.render(tlContainer, clientId);
                            }
                            // Refresh dashboard table behind popup
                            if (onRefresh) onRefresh();
                        });
                    });
                }

                // Lazy-load tabs on click (popup handles tab switching automatically)
                // Timeline refreshes EVERY time its tab is clicked (to show latest changes)
                var planLoaded = false, swapsLoaded = false;
                body.addEventListener('click', function(e) {
                    var tab = e.target.closest('.probler-popup-tab');
                    if (!tab) return;
                    var target = tab.dataset.tab;
                    if (target === 'plan' && !planLoaded && window.PhysioSessionPlanRenderer) {
                        planLoaded = true;
                        PhysioSessionPlanRenderer.render(body.querySelector('#' + planContainerId), clientId);
                    }
                    if (target === 'timeline' && window.PhysioDashTimeline) {
                        PhysioDashTimeline.render(body.querySelector('#' + timelineId), clientId);
                    }
                    if (target === 'swaps' && !swapsLoaded) {
                        swapsLoaded = true;
                        _loadSwapLogTable(swapTableId, clientId);
                    }
                });
            }
        });
    };

    function _saveOverride(clientId, fromStatus, toStatus, reason, onSuccess) {
        // 1. POST override log
        fetch(Layer8DConfig.resolveEndpoint('/50/OvrdLog'), {
            method: 'POST',
            headers: Object.assign({}, getAuthHeaders(), { 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                clientId: clientId,
                changedBy: sessionStorage.getItem('currentUser') || '',
                fromStatus: fromStatus,
                toStatus: toStatus,
                changeDate: Math.floor(Date.now() / 1000),
                reason: reason
            })
        }).catch(function(err) { console.warn('Failed to log override:', err); });

        // 2. Update PhysioClient overrideStatus
        var query = encodeURIComponent(JSON.stringify({ text: 'select * from PhysioClient where clientId=' + clientId }));
        fetch(Layer8DConfig.resolveEndpoint('/50/PhyClient') + '?body=' + query, {
            method: 'GET', headers: getAuthHeaders()
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var client = (data.list || [])[0];
            if (!client) { Layer8DNotification.error('Client not found'); return; }
            client.overrideStatus = toStatus;
            return fetch(Layer8DConfig.resolveEndpoint('/50/PhyClient'), {
                method: 'PUT',
                headers: Object.assign({}, getAuthHeaders(), { 'Content-Type': 'application/json' }),
                body: JSON.stringify(client)
            });
        })
        .then(function(r) {
            if (r && r.ok) {
                Layer8DNotification.success('Override updated');
                if (onSuccess) onSuccess();
            } else {
                Layer8DNotification.error('Failed to update override');
            }
        })
        .catch(function(err) { Layer8DNotification.error('Error: ' + err.message); });
    }

    function _loadSwapLogTable(containerId, clientId) {
        var el = document.getElementById(containerId);
        if (!el || typeof Layer8DTable === 'undefined') return;

        var cols = PhysioManagement.columns.ExerciseSwapLog || [];

        var table = new Layer8DTable({
            containerId: containerId,
            endpoint: Layer8DConfig.resolveEndpoint('/50/ExSwapLog'),
            modelName: 'ExerciseSwapLog',
            columns: cols,
            primaryKey: 'swapId',
            pageSize: 20,
            serverSide: true,
            baseWhereClause: 'clientId=' + clientId,
            showActions: false
        });
        table.init();
    }
})();
