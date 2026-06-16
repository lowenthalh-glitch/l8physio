// MobilePhysioTherapistDetail — therapist popup with personal details + clients list
(function() {
    'use strict';

    window.MobilePhysioTherapistDetail = {
        open: function(item, therapistId) {
            var tid = therapistId || (item && item.therapistId);
            if (!tid) return;
            var name = (item && item.firstName && item.lastName)
                ? (item.firstName + ' ' + item.lastName) : tid;

            // Build read-only details from form definition
            var formDef = (MobilePhysioManagement.forms || {}).PhysioTherapist;
            var detailsHtml = '';
            if (formDef && item) {
                formDef.sections.forEach(function(section) {
                    detailsHtml += '<div style="margin-bottom:14px;">';
                    detailsHtml += '<h4 style="margin:0 0 8px;font-size:14px;color:var(--layer8d-text-dark);border-bottom:1px solid var(--layer8d-border);padding-bottom:6px;">' +
                        Layer8DUtils.escapeHtml(section.title) + '</h4>';
                    section.fields.forEach(function(field) {
                        var val = item[field.key];
                        var display = '';
                        if (field.type === 'date' && val) display = Layer8DUtils.formatDate(val);
                        else if (field.type === 'checkbox') display = val ? 'Yes' : 'No';
                        else if (field.type === 'select' && field.options) display = field.options[val] || val || '\u2014';
                        else display = val || '\u2014';
                        detailsHtml += '<div style="font-size:13px;margin-bottom:6px;"><span style="color:var(--layer8d-text-muted);">' +
                            Layer8DUtils.escapeHtml(field.label) + ':</span> <span style="color:var(--layer8d-text-dark);">' +
                            Layer8DUtils.escapeHtml(String(display)) + '</span></div>';
                    });
                    detailsHtml += '</div>';
                });
            }

            var clientsId = 'mtherapist-clients-' + Date.now();

            Layer8MPopup.show({
                title: name,
                size: 'full',
                showFooter: false,
                tabs: [
                    { id: 'details', label: 'Personal Details', content: '<div style="min-height:150px;">' + detailsHtml + '</div>' },
                    { id: 'clients', label: 'Clients', content: '<div id="' + clientsId + '" style="min-height:150px;"></div>' }
                ],
                onTabChange: function(tabId, popup) {
                    if (tabId === 'clients') {
                        var body = popup && popup.body ? popup.body : popup;
                        if (!body) return;
                        var cc = body.querySelector('#' + clientsId);
                        if (cc && !cc._loaded) {
                            cc._loaded = true;
                            _loadClients(cc, tid);
                        }
                    }
                }
            });
        }
    };

    function _loadClients(container, tid) {
        if (!container || typeof Layer8MEditTable === 'undefined') return;
        var divId = 'mtherapist-tbl-' + Date.now();
        container.innerHTML = '<div id="' + divId + '"></div>';
        var col = window.Layer8ColumnFactory;
        var columns = [
            ...col.col('firstName', 'First Name'),
            ...col.col('lastName', 'Last Name'),
            ...col.col('email', 'Email'),
            ...col.col('diagnosis', 'Diagnosis')
        ];
        new Layer8MEditTable(divId, {
            endpoint: Layer8DConfig.resolveEndpoint('/50/PhyClient'),
            modelName: 'PhysioClient',
            columns: columns,
            rowsPerPage: 15,
            getItemId: function(item) { return item.clientId; },
            baseWhereClause: 'therapistId=' + tid
        });
    }
})();
