(function() {
    'use strict';

    if (!window.Layer8MNavCrud || !window.PhysioUserProvisioningMobile) return;

    var origOpenServiceForm = Layer8MNavCrud.openServiceForm.bind(Layer8MNavCrud);

    Layer8MNavCrud.openServiceForm = async function(serviceConfig, formDef, item) {
        var isEdit = !!item;
        var model = serviceConfig && serviceConfig.model;
        var needsProvisioning = !isEdit && (model === 'PhysioClient' || model === 'PhysioTherapist');

        if (!needsProvisioning) {
            return origOpenServiceForm(serviceConfig, formDef, item);
        }

        var title = 'Add ' + serviceConfig.label.replace(/s$/, '');
        var content = Layer8MForms.renderForm(formDef, {});

        Layer8MPopup.show({
            title: title,
            content: content,
            size: 'large',
            saveButtonText: 'Create',
            onShow: function(popup) {
                Layer8MForms.initFormFields(popup.body, formDef);
            },
            onSave: async function(popup) {
                var body = popup.body;
                var errors = Layer8MForms.validateForm(body);
                if (errors.length > 0) {
                    Layer8MForms.showErrors(body, errors);
                    return;
                }
                var data = Layer8MForms.getFormData(body);
                try {
                    // Pre-generate the PK client-side. The POST response is an L8Transaction
                    // whose `id` is the transaction UUID, not the entity's, so we can't
                    // recover the server-generated PK. Server's GenerateID skips non-empty
                    // fields, so this value wins, and we can pass it to UserProvisioning so
                    // L8User.userId equals therapistId/clientId (required by scope-deny).
                    if (!data[serviceConfig.idField]) {
                        data[serviceConfig.idField] = crypto.randomUUID();
                    }
                    await Layer8MAuth.post(Layer8MConfig.resolveEndpoint(serviceConfig.endpoint), data);
                    Layer8MUtils.showSuccess(serviceConfig.label.replace(/s$/, '') + ' created');
                    Layer8MPopup.close();

                    if (model === 'PhysioClient') {
                        PhysioUserProvisioningMobile.createClientUser(data);
                    } else if (model === 'PhysioTherapist') {
                        PhysioUserProvisioningMobile.createTherapistUser(data);
                    }

                    var activeTable = window._Layer8MNavActiveTable;
                    if (activeTable) activeTable.refresh();
                } catch (error) {
                    Layer8MUtils.showError(error.message || ('Failed to save ' + serviceConfig.label.replace(/s$/, '').toLowerCase()));
                }
            }
        });
    };
})();
