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
                if (service.model === 'PhysioClient' && window.PhysioClientExercises) {
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
})();
