(function() {
    'use strict';

    PhysioManagement.lookups = {
        _therapists: {},
        _clients:    {},
        _loaded:     false,

        load: async function() {
            if (this._loaded) return;
            const self = this;

            function authHeaders() {
                const token = sessionStorage.getItem('bearerToken');
                return token ? { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
            }

            function buildQuery(type) {
                return '?body=' + encodeURIComponent(JSON.stringify({ text: 'select * from ' + type }));
            }

            const prefix = (typeof Layer8DConfig !== 'undefined' && Layer8DConfig.getApiPrefix)
                ? Layer8DConfig.getApiPrefix() : '/physio';

            try {
                const r = await fetch(prefix + '/50/PhyTherapt' + buildQuery('PhysioTherapist'), { headers: authHeaders() });
                if (r.ok) {
                    const data = await r.json();
                    (data.list || []).forEach(function(t) {
                        self._therapists[t.therapistId] = t.firstName + ' ' + t.lastName;
                    });
                }
            } catch(e) {}

            try {
                const r = await fetch(prefix + '/50/PhyClient' + buildQuery('PhysioClient'), { headers: authHeaders() });
                if (r.ok) {
                    const data = await r.json();
                    (data.list || []).forEach(function(c) {
                        self._clients[c.clientId] = c.firstName + ' ' + c.lastName;
                    });
                }
            } catch(e) {}

            self._loaded = true;
        },

        therapistName: function(id) {
            return this._therapists[id] || id || '-';
        },

        clientName: function(id) {
            return this._clients[id] || id || '-';
        }
    };
})();
