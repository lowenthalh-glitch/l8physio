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
                    // Dashboard uses frontend aggregation (workaround for ORM zero-value panic)
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
        var detailsHtml = '';
        if (formDef && item) {
            detailsHtml = Layer8DForms.generateFormHtml(formDef, item);
        }

        var containerId = 'therapist-clients-popup-table';
        var popupContent = '<div class="physio-therapist-tabs" style="display:flex;gap:0;border-bottom:2px solid var(--layer8d-border);margin-bottom:16px;">' +
            '<button class="physio-therapist-tab active" data-ptab="details" style="padding:8px 20px;border:none;background:none;cursor:pointer;font-size:14px;font-weight:600;border-bottom:2px solid var(--layer8d-primary);margin-bottom:-2px;color:var(--layer8d-primary);">Details</button>' +
            '<button class="physio-therapist-tab" data-ptab="clients" style="padding:8px 20px;border:none;background:none;cursor:pointer;font-size:14px;font-weight:500;border-bottom:2px solid transparent;margin-bottom:-2px;color:var(--layer8d-text-medium);">Clients</button>' +
            '</div>' +
            '<div class="physio-therapist-pane" data-ppane="details">' + detailsHtml + '</div>' +
            '<div class="physio-therapist-pane" data-ppane="clients" style="display:none;"><div id="' + containerId + '" style="min-height:200px;"></div></div>';

        Layer8DPopup.show({
            title: therapistName,
            content: popupContent,
            size: 'large',
            showFooter: false,
            onShow: function(body) {
                // Make details form read-only
                var detailsPane = body.querySelector('[data-ppane="details"]');
                if (detailsPane) {
                    detailsPane.querySelectorAll('input, select, textarea').forEach(function(el) {
                        el.disabled = true;
                    });
                }

                // Custom tab switching
                var clientsLoaded = false;
                body.querySelectorAll('.physio-therapist-tab').forEach(function(tab) {
                    tab.addEventListener('click', function() {
                        var target = tab.getAttribute('data-ptab');
                        // Update tab styles
                        body.querySelectorAll('.physio-therapist-tab').forEach(function(t) {
                            t.classList.remove('active');
                            t.style.borderBottomColor = 'transparent';
                            t.style.color = 'var(--layer8d-text-medium)';
                            t.style.fontWeight = '500';
                        });
                        tab.classList.add('active');
                        tab.style.borderBottomColor = 'var(--layer8d-primary)';
                        tab.style.color = 'var(--layer8d-primary)';
                        tab.style.fontWeight = '600';
                        // Show/hide panes
                        body.querySelectorAll('.physio-therapist-pane').forEach(function(p) {
                            p.style.display = p.getAttribute('data-ppane') === target ? '' : 'none';
                        });
                        // Load clients table on first click
                        if (target === 'clients' && !clientsLoaded) {
                            clientsLoaded = true;
                            _loadTherapistClientsTable(containerId, tid);
                        }
                    });
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
    function _showDashboardDetail(item) {
        if (!item) return;
        var clientId = item.clientId;
        var enums = PhysioManagement.enums;
        var render = PhysioManagement.render;

        var STATUS_OPTS = { 0: '— Clear —', 1: 'Green', 2: 'Yellow', 3: 'Red' };
        var currentOverride = item.overrideStatus || 0;

        var overrideHtml = '<select id="htdash-override-select" style="padding:6px 10px;border-radius:4px;border:1px solid var(--layer8d-border);">';
        Object.keys(STATUS_OPTS).forEach(function(k) {
            overrideHtml += '<option value="' + k + '"' + (parseInt(k) === currentOverride ? ' selected' : '') + '>' + STATUS_OPTS[k] + '</option>';
        });
        overrideHtml += '</select>';

        var overviewHtml = '<div style="padding:8px 0;">' +
            '<div style="margin-bottom:12px;"><strong>Client:</strong> ' + Layer8DUtils.escapeHtml(item.clientName || '') + '</div>' +
            '<div style="margin-bottom:12px;"><strong>Therapist:</strong> ' + Layer8DUtils.escapeHtml(item.therapistName || '') + '</div>' +
            '<div style="margin-bottom:12px;"><strong>Last Feedback:</strong> ' + (item.lastFeedbackDate ? Layer8DUtils.formatDate(item.lastFeedbackDate) : '—') +
            ' ' + (item.lastFeedbackStatus ? render.sessionStatus(item.lastFeedbackStatus) : '') + '</div>' +
            '<div style="margin-bottom:12px;"><strong>Last Session:</strong> ' + (item.lastSessionDate ? Layer8DUtils.formatDate(item.lastSessionDate) : '—') +
            ' ' + (item.lastSessionStatus ? render.sessionStatus(item.lastSessionStatus) : '') + '</div>' +
            '<div style="margin-bottom:12px;"><strong>Swaps:</strong> ' + (item.swapCount || 0) + '</div>' +
            '<div style="margin-bottom:8px;"><strong>Override Status:</strong> ' + overrideHtml + '</div>' +
            '</div>';

        var swapTableId = 'htdash-swaplog-table';

        var popupContent = '<div class="physio-therapist-tabs" style="display:flex;gap:0;border-bottom:2px solid var(--layer8d-border);margin-bottom:16px;">' +
            '<button class="physio-therapist-tab active" data-ptab="overview" style="padding:8px 20px;border:none;background:none;cursor:pointer;font-size:14px;font-weight:600;border-bottom:2px solid var(--layer8d-primary);margin-bottom:-2px;color:var(--layer8d-primary);">Overview</button>' +
            '<button class="physio-therapist-tab" data-ptab="swaps" style="padding:8px 20px;border:none;background:none;cursor:pointer;font-size:14px;font-weight:500;border-bottom:2px solid transparent;margin-bottom:-2px;color:var(--layer8d-text-medium);">Exercise Changes</button>' +
            '</div>' +
            '<div class="physio-therapist-pane" data-ppane="overview">' + overviewHtml + '</div>' +
            '<div class="physio-therapist-pane" data-ppane="swaps" style="display:none;"><div id="' + swapTableId + '" style="min-height:200px;"></div></div>';

        Layer8DPopup.show({
            title: item.clientName || 'Client Dashboard',
            content: popupContent,
            size: 'large',
            showFooter: false,
            onShow: function(body) {
                // Override save handler
                var sel = body.querySelector('#htdash-override-select');
                if (sel) {
                    sel.addEventListener('change', function() {
                        _saveOverride(clientId, parseInt(sel.value, 10));
                    });
                }

                // Tab switching
                var swapsLoaded = false;
                body.querySelectorAll('.physio-therapist-tab').forEach(function(tab) {
                    tab.addEventListener('click', function() {
                        var target = tab.getAttribute('data-ptab');
                        body.querySelectorAll('.physio-therapist-tab').forEach(function(t) {
                            t.classList.remove('active');
                            t.style.borderBottomColor = 'transparent';
                            t.style.color = 'var(--layer8d-text-medium)';
                            t.style.fontWeight = '500';
                        });
                        tab.classList.add('active');
                        tab.style.borderBottomColor = 'var(--layer8d-primary)';
                        tab.style.color = 'var(--layer8d-primary)';
                        tab.style.fontWeight = '600';
                        body.querySelectorAll('.physio-therapist-pane').forEach(function(p) {
                            p.style.display = p.getAttribute('data-ppane') === target ? '' : 'none';
                        });
                        if (target === 'swaps' && !swapsLoaded) {
                            swapsLoaded = true;
                            _loadSwapLogTable(swapTableId, clientId);
                        }
                    });
                });
            }
        });
    }

    function _saveOverride(clientId, newStatus) {
        var query = encodeURIComponent(JSON.stringify({ text: 'select * from PhysioClient where clientId=' + clientId }));
        fetch(Layer8DConfig.resolveEndpoint('/50/PhyClient') + '?body=' + query, {
            method: 'GET', headers: getAuthHeaders()
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var client = (data.list || [])[0];
            if (!client) { Layer8DNotification.error('Client not found'); return; }
            client.overrideStatus = newStatus;
            return fetch(Layer8DConfig.resolveEndpoint('/50/PhyClient'), {
                method: 'PUT',
                headers: Object.assign({}, getAuthHeaders(), { 'Content-Type': 'application/json' }),
                body: JSON.stringify(client)
            });
        })
        .then(function(r) {
            if (r && r.ok) Layer8DNotification.success('Override updated');
            else Layer8DNotification.error('Failed to update override');
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
