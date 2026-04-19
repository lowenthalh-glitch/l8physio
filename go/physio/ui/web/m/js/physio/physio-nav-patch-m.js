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
                    var result = await Layer8MAuth.post(Layer8MConfig.resolveEndpoint(serviceConfig.endpoint), data);
                    Layer8MUtils.showSuccess(serviceConfig.label.replace(/s$/, '') + ' created');
                    Layer8MPopup.close();

                    var entity = Object.assign({}, data);
                    if (result && result.id) {
                        entity[serviceConfig.idField] = result.id;
                    }

                    if (model === 'PhysioClient') {
                        PhysioUserProvisioningMobile.createClientUser(entity);
                    } else if (model === 'PhysioTherapist') {
                        PhysioUserProvisioningMobile.createTherapistUser(entity);
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
