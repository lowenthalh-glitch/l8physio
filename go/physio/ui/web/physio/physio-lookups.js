(function() {
    'use strict';

    PhysioManagement.lookups = {
        _therapists: {},
        _clients:    {},
        _exercises:  {},
        _loaded:     false,
        _loading:    null,

        load: function() {
            if (this._loaded) return Promise.resolve();
            if (this._loading) return this._loading;
            const self = this;

            this._loading = (async function() {
                // Mobile fires lookups.load() at script-init, before MobileApp.init's
                // Layer8DConfig.load() has resolved. Without the prefix, fetch hits
                // the wrong URL (no /physio) and the maps stay empty.
                if (typeof Layer8DConfig !== 'undefined' && Layer8DConfig.load
                    && Layer8DConfig.isLoaded && !Layer8DConfig.isLoaded()) {
                    try { await Layer8DConfig.load(); } catch(e) {}
                }

                function authHeaders() {
                    const token = sessionStorage.getItem('bearerToken') || localStorage.getItem('bearerToken');
                    return token ? { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
                }

                function buildQuery(type) {
                    return '?body=' + encodeURIComponent(JSON.stringify({ text: 'select * from ' + type }));
                }

                const resolved = (typeof Layer8DConfig !== 'undefined' && Layer8DConfig.getApiPrefix)
                    ? Layer8DConfig.getApiPrefix() : '';
                const prefix = resolved || '/physio';

                let anyOk = false;

                try {
                    const r = await fetch(prefix + '/50/PhyTherapt' + buildQuery('PhysioTherapist'), { headers: authHeaders() });
                    if (r.ok) {
                        const data = await r.json();
                        (data.list || []).forEach(function(t) {
                            self._therapists[t.therapistId] = t.firstName + ' ' + t.lastName;
                        });
                        anyOk = true;
                    }
                } catch(e) {}

                try {
                    const r = await fetch(prefix + '/50/PhyClient' + buildQuery('PhysioClient'), { headers: authHeaders() });
                    if (r.ok) {
                        const data = await r.json();
                        (data.list || []).forEach(function(c) {
                            self._clients[c.clientId] = c.firstName + ' ' + c.lastName;
                        });
                        anyOk = true;
                    }
                } catch(e) {}

                try {
                    const r = await fetch(prefix + '/50/PhyExercis' + buildQuery('PhysioExercise'), { headers: authHeaders() });
                    if (r.ok) {
                        const data = await r.json();
                        (data.list || []).forEach(function(ex) {
                            self._exercises[ex.exerciseId] = ex.name || ex.exerciseId;
                        });
                        anyOk = true;
                    }
                } catch(e) {}

                // Only mark loaded if at least one fetch succeeded — otherwise
                // a future caller (e.g. table refresh) can retry.
                if (anyOk) self._loaded = true;
                self._loading = null;
            })();
            return this._loading;
        },

        therapistName: function(id) {
            return this._therapists[id] || id || '-';
        },

        clientName: function(id) {
            return this._clients[id] || id || '-';
        },

        exerciseName: function(id) {
            return this._exercises[id] || id || '-';
        }
    };
})();
