(function() {
    'use strict';

    // MobilePhysioClientExercises — shows a client's assigned protocol exercises with video
    window.MobilePhysioClientExercises = {

        open: function(clientId) {
            var self = this;
            var config = Layer8MConfig.getConfig();
            var apiPrefix = config && config.app ? config.app.apiPrefix : '';

            var query = encodeURIComponent(JSON.stringify({ text: 'select * from PhysioClient where clientId=' + clientId }));
            Layer8MAuth.get(apiPrefix + '/50/PhyClient?body=' + query)
            .then(function(data) {
                var list = (data && data.list) || [];
                var client = list.length > 0 ? list[0] : null;
                if (!client) {
                    Layer8MUtils.showError('Client not found');
                    return;
                }
                self._showPopup(client, apiPrefix);
            })
            .catch(function(err) {
                Layer8MUtils.showError('Failed to load client');
            });
        },

        _showPopup: function(client, apiPrefix) {
            var self = this;
            var name = (client.firstName || '') + ' ' + (client.lastName || '');

            Layer8MPopup.show({
                title: name,
                content: '<div class="mobile-physio-ex-tabs">' +
                    '<button class="mobile-physio-ex-tab active" data-tab="exercises">My Exercises</button>' +
                    '<button class="mobile-physio-ex-tab" data-tab="details">Details</button>' +
                '</div>' +
                '<div id="mobile-physio-exercises-pane" class="mobile-physio-ex-pane active">' +
                    '<div class="mobile-physio-loading">Loading exercises…</div>' +
                '</div>' +
                '<div id="mobile-physio-details-pane" class="mobile-physio-ex-pane">' +
                    '<div class="mobile-physio-details-body"></div>' +
                '</div>',
                size: 'full',
                showFooter: false,
                onShow: function(popup) {
                    var body = popup.body || popup;

                    // Tab switching
                    body.querySelectorAll('.mobile-physio-ex-tab').forEach(function(btn) {
                        btn.addEventListener('click', function() {
                            body.querySelectorAll('.mobile-physio-ex-tab').forEach(function(b) { b.classList.remove('active'); });
                            body.querySelectorAll('.mobile-physio-ex-pane').forEach(function(p) { p.classList.remove('active'); });
                            btn.classList.add('active');
                            var paneId = btn.dataset.tab === 'exercises' ? 'mobile-physio-exercises-pane' : 'mobile-physio-details-pane';
                            var pane = body.querySelector('#' + paneId);
                            if (pane) pane.classList.add('active');
                        });
                    });

                    // Load exercises
                    self._loadExercises(client, body.querySelector('#mobile-physio-exercises-pane'), apiPrefix);

                    // Render details
                    self._renderDetails(client, body.querySelector('.mobile-physio-details-body'));
                }
            });
        },

        _loadExercises: function(client, container, apiPrefix) {
            var self = this;
            if (!client.protocolId) {
                container.innerHTML = '<div class="mobile-physio-no-protocol">No protocol assigned. Ask your therapist to assign one.</div>';
                return;
            }

            var query = encodeURIComponent(JSON.stringify({ text: 'select * from PhysioProtocol where protocolId=' + client.protocolId }));
            Layer8MAuth.get(apiPrefix + '/50/PhyProto?body=' + query)
            .then(function(data) {
                var list = (data && data.list) || [];
                var protocol = list.length > 0 ? list[0] : null;
                if (!protocol) {
                    container.innerHTML = '<div class="mobile-physio-no-protocol">Protocol not found.</div>';
                    return;
                }
                self._renderExercises(protocol, container, apiPrefix);
            })
            .catch(function() {
                container.innerHTML = '<div class="mobile-physio-no-protocol">Failed to load protocol.</div>';
            });
        },

        _renderExercises: function(protocol, container, apiPrefix) {
            var self = this;
            var exercises = protocol.exercises || [];
            if (exercises.length === 0) {
                container.innerHTML = '<div class="mobile-physio-no-protocol">Protocol "' +
                    Layer8MUtils.escapeHtml(protocol.name) + '" has no exercises yet.</div>';
                return;
            }

            var exerciseIds = exercises.filter(function(e) { return e.exerciseId; }).map(function(e) { return e.exerciseId; });
            if (exerciseIds.length === 0) {
                self._buildExerciseHTML(protocol, exercises, {}, container);
                return;
            }

            var query = encodeURIComponent(JSON.stringify({ text: 'select * from PhysioExercise where exerciseId=' + exerciseIds[0] }));
            Layer8MAuth.get(apiPrefix + '/50/PhyExercis?body=' + query)
            .then(function(data) {
                var exerciseMap = {};
                ((data && data.list) || []).forEach(function(ex) { exerciseMap[ex.exerciseId] = ex; });
                self._buildExerciseHTML(protocol, exercises, exerciseMap, container);
            })
            .catch(function() {
                self._buildExerciseHTML(protocol, exercises, {}, container);
            });
        },

        _buildExerciseHTML: function(protocol, exercises, exerciseMap, container) {
            var html = '<div class="mobile-physio-protocol-name">' + Layer8MUtils.escapeHtml(protocol.name) + '</div>';

            exercises.forEach(function(pe, idx) {
                var fullEx = exerciseMap[pe.exerciseId] || {};
                var name = pe.exerciseName || fullEx.name || 'Exercise ' + (idx + 1);
                var sets = pe.sets || fullEx.defaultSets || '';
                var reps = pe.reps || (fullEx.defaultReps ? String(fullEx.defaultReps) : '');
                var loadNotes = pe.loadNotes || fullEx.loadNotes || '';
                var effort = pe.effort || fullEx.effort || '';
                var videoUrl = fullEx.videoStoragePath || '';

                var videoHtml = '';
                if (videoUrl) {
                    var embedUrl = videoUrl;
                    var ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
                    if (ytMatch) {
                        embedUrl = 'https://www.youtube.com/embed/' + ytMatch[1] + '?rel=0&modestbranding=1&playsinline=1';
                    }
                    videoHtml = '<div class="mobile-physio-video">' +
                        '<iframe src="' + Layer8MUtils.escapeHtml(embedUrl) + '" frameborder="0" ' +
                        'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
                        'allowfullscreen playsinline loading="lazy"></iframe>' +
                        '</div>';
                } else {
                    videoHtml = '<div class="mobile-physio-no-video">No video available</div>';
                }

                html += '<div class="mobile-physio-ex-card">' +
                    videoHtml +
                    '<div class="mobile-physio-ex-body">' +
                        '<div class="mobile-physio-ex-name">' + Layer8MUtils.escapeHtml(name) + '</div>' +
                        '<div class="mobile-physio-ex-rx">';

                if (sets) html += '<span class="mobile-physio-rx-tag">Sets: ' + Layer8MUtils.escapeHtml(String(sets)) + '</span>';
                if (reps) html += '<span class="mobile-physio-rx-tag">Reps: ' + Layer8MUtils.escapeHtml(reps) + '</span>';
                if (effort) html += '<span class="mobile-physio-rx-tag">Effort: ' + Layer8MUtils.escapeHtml(effort) + '</span>';

                html += '</div>';
                if (loadNotes) html += '<div class="mobile-physio-ex-notes">' + Layer8MUtils.escapeHtml(loadNotes) + '</div>';
                html += '</div></div>';
            });

            container.innerHTML = html;
        },

        _renderDetails: function(client, container) {
            var formDef = (MobilePhysioManagement.forms || {}).PhysioClient;
            if (!formDef) { container.innerHTML = '<p>Form not available.</p>'; return; }
            container.innerHTML = Layer8MForms.renderForm(formDef, client, true);
            if (typeof Layer8MForms.initFormFields === 'function') {
                Layer8MForms.initFormFields(container);
            }
        }
    };

})();
