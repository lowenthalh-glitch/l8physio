(function() {
    'use strict';

    // Fetch an image from FileStore via PUT (returns base64), convert to blob URL
    function _fetchImageBlob(storagePath, callback) {
        if (!storagePath) { callback(null); return; }
        var endpoint = Layer8DConfig.resolveEndpoint('/0/FileStore');
        var headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : {};
        headers['Content-Type'] = 'application/json';
        fetch(endpoint, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify({ storagePath: storagePath })
        })
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(data) {
            if (!data || !data.fileData) { callback(null); return; }
            var binary = atob(data.fileData);
            var bytes = new Uint8Array(binary.length);
            for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            var blob = new Blob([bytes], { type: data.mimeType || 'image/jpeg' });
            callback(URL.createObjectURL(blob));
        })
        .catch(function() { callback(null); });
    }

    function _extractYoutubeId(url) {
        var m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        return m ? m[1] : null;
    }

    function _renderVideoHtml(videoPath) {
        if (!videoPath) {
            return '<div class="physio-no-video">No video available</div>';
        }
        var ytId = _extractYoutubeId(videoPath);
        if (ytId) {
            return '<div class="physio-video-wrapper">' +
                '<iframe src="https://www.youtube.com/embed/' + ytId + '" ' +
                'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
                'allowfullscreen></iframe></div>';
        }
        var vimeoMatch = videoPath.match(/vimeo\.com\/(\d+)/);
        if (vimeoMatch) {
            return '<div class="physio-video-wrapper">' +
                '<iframe src="https://player.vimeo.com/video/' + vimeoMatch[1] + '" allowfullscreen></iframe></div>';
        }
        if (/^https?:\/\//i.test(videoPath)) {
            return '<div class="physio-video-wrapper">' +
                '<video controls style="position:absolute;top:0;left:0;width:100%;height:100%">' +
                '<source src="' + Layer8DUtils.escapeHtml(videoPath) + '">' +
                '</video></div>';
        }
        return '<div class="physio-no-video">' +
            '<a href="' + Layer8DConfig.getApiPrefix() + '/0/FileStore?path=' + encodeURIComponent(videoPath) + '" ' +
            'target="_blank" class="physio-video-link">\u25b6 View Video</a></div>';
    }

    function _buildExerciseCheckboxes(plan, exerciseMap) {
        var exercises = (plan && plan.exercises) || [];
        if (exercises.length === 0) return '<span style="color:var(--layer8d-text-muted)">No exercises in plan</span>';
        var exMap = exerciseMap || {};
        var html = '<div class="physio-diff-exercise-list" style="max-height:150px;overflow-y:auto;border:1px solid var(--layer8d-border);border-radius:4px;padding:6px;">';
        exercises.forEach(function(pe) {
            var ex = exMap[pe.exerciseId] || {};
            var name = ex.name || pe.exerciseId || 'Unknown';
            var eid = Layer8DUtils.escapeHtml(pe.exerciseId);
            html += '<label style="display:block;padding:3px 0;cursor:pointer;">' +
                '<input type="checkbox" class="physio-diff-ex-cb" value="' + eid + '" style="margin-right:6px;">' +
                Layer8DUtils.escapeHtml(name) + '</label>';
        });
        html += '</div>';
        return html;
    }

    window.PhysioClientExerciseInfo = {
        buildExerciseCheckboxes: _buildExerciseCheckboxes,
        renderVideoHtml: _renderVideoHtml,

        loadAuthImages: function(container) {
            container.querySelectorAll('img[data-img-path]').forEach(function(img) {
                _fetchImageBlob(img.dataset.imgPath, function(blobUrl) {
                    if (blobUrl) img.src = blobUrl;
                });
            });
        },

        showVideoPopup: function(exerciseId, exerciseMap) {
            var ex = (exerciseMap || {})[exerciseId] || {};
            var name = ex.name || exerciseId;
            var videoHtml = _renderVideoHtml(ex.videoStoragePath || '');
            Layer8DPopup.show({ title: name, content: '<div style="padding:8px;">' + videoHtml + '</div>', size: 'large', showFooter: false });
        },

        showImagePopup: function(exerciseId, exerciseMap) {
            var ex = (exerciseMap || {})[exerciseId] || {};
            if (!ex.imageStoragePath) return;
            var name = ex.name || exerciseId;
            Layer8DPopup.show({
                title: name,
                content: '<div style="padding:8px;text-align:center;"><img id="physio-img-popup" alt="" style="max-width:100%;max-height:500px;border-radius:6px;display:none;"><div class="physio-exercises-loading" id="physio-img-loading">Loading\u2026</div></div>',
                size: 'large', showFooter: false,
                onShow: function() {
                    _fetchImageBlob(ex.imageStoragePath, function(blobUrl) {
                        var img = document.getElementById('physio-img-popup');
                        var loading = document.getElementById('physio-img-loading');
                        if (blobUrl && img) { img.src = blobUrl; img.style.display = ''; }
                        if (loading) loading.style.display = 'none';
                    });
                }
            });
        },
        render: function(plan, planExercises, exerciseMap, container) {
            var ordered = planExercises.slice().sort(function(a, b) {
                return (a.orderIndex || 0) - (b.orderIndex || 0);
            });
            if (ordered.length === 0) {
                container.innerHTML = '<div class="physio-no-protocol">No exercises in this plan.</div>';
                return;
            }
            var html = '<div class="physio-exercise-grid">';
            ordered.forEach(function(pe) {
                var ex   = exerciseMap[pe.exerciseId] || {};
                var name = ex.name || pe.exerciseId || '\u2014';
                var sets = pe.sets || ex.defaultSets || '';
                var reps = pe.reps || ex.defaultRepsDisplay || (ex.defaultReps ? String(ex.defaultReps) : '') || '';
                html += '<div class="physio-exercise-card">';
                html += _renderVideoHtml(ex.videoStoragePath || '');
                html += '<div class="physio-exercise-info">';
                html += '<div class="physio-exercise-name">' + Layer8DUtils.escapeHtml(name) + '</div>';
                if (sets || reps) {
                    html += '<div class="physio-exercise-prescription">';
                    if (sets) html += '<span class="physio-rx-badge">' + Layer8DUtils.escapeHtml(String(sets)) + ' sets</span>';
                    if (reps) html += '<span class="physio-rx-badge">' + Layer8DUtils.escapeHtml(String(reps)) + ' reps</span>';
                    html += '</div>';
                }
                if (ex.description)       html += '<div class="physio-exercise-desc">'         + Layer8DUtils.escapeHtml(ex.description) + '</div>';
                if (ex.instructions)      html += '<div class="physio-exercise-instructions"><strong>Instructions:</strong> ' + Layer8DUtils.escapeHtml(ex.instructions) + '</div>';
                if (ex.muscleGroup)       html += '<div class="physio-exercise-meta"><strong>Muscle Group:</strong> ' + Layer8DUtils.escapeHtml(ex.muscleGroup) + '</div>';
                if (ex.equipment)         html += '<div class="physio-exercise-meta"><strong>Equipment:</strong> '    + Layer8DUtils.escapeHtml(ex.equipment) + '</div>';
                if (ex.effort)            html += '<div class="physio-exercise-meta"><strong>Effort:</strong> '       + Layer8DUtils.escapeHtml(String(ex.effort)) + '</div>';
                if (ex.contraindications) html += '<div class="physio-exercise-meta physio-exercise-meta-warn"><strong>Contraindications:</strong> ' + Layer8DUtils.escapeHtml(ex.contraindications) + '</div>';
                if (ex.loadNotes)         html += '<div class="physio-exercise-notes">'         + Layer8DUtils.escapeHtml(ex.loadNotes) + '</div>';
                if (pe.notes)             html += '<div class="physio-exercise-notes"><strong>Plan note:</strong> '  + Layer8DUtils.escapeHtml(pe.notes) + '</div>';
                html += '</div></div>';
            });
            html += '</div>';
            container.innerHTML = html;
        }
    };
})();
