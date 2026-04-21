// Client portal application initialization

// Global fetch interceptor — redirect to login on 401 from any fetch
(function() {
    var _originalFetch = window.fetch;
    window.fetch = function(url, options) {
        return _originalFetch.apply(this, arguments).then(function(response) {
            if (response.status === 401 && typeof showErrorAndLogout === 'function') {
                showErrorAndLogout('Session expired', 'Please log in again.');
            }
            return response;
        });
    };
})();

function getAuthHeaders() {
    const bearerToken = sessionStorage.getItem('bearerToken');
    return {
        'Authorization': bearerToken ? `Bearer ${bearerToken}` : '',
        'Content-Type': 'application/json'
    };
}

async function makeAuthenticatedRequest(url, options = {}) {
    const bearerToken = sessionStorage.getItem('bearerToken');

    if (!bearerToken) {
        console.error('No bearer token found');
        showErrorAndLogout('Your session has expired or is missing.', 'No authentication token was found. Please log in again.');
        return;
    }

    const headers = {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
        ...options.headers
    };

    try {
        const response = await fetch(url, { ...options, headers });

        if (response.status === 401) {
            showErrorAndLogout('Unauthorized — your session has expired.', 'The server returned 401 for endpoint: ' + url);
            return;
        }

        return response;
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

function logout() {
    sessionStorage.removeItem('bearerToken');
    localStorage.removeItem('bearerToken');
    localStorage.removeItem('rememberedUser');
    window.location.href = 'l8ui/login/index.html';
}

function showErrorAndLogout(message, detail) {
    sessionStorage.removeItem('bearerToken');
    localStorage.removeItem('bearerToken');
    localStorage.removeItem('rememberedUser');

    if (typeof Layer8DPopup !== 'undefined') {
        Layer8DPopup.show({
            title: 'Session Error',
            content: '<div style="padding:16px;">' +
                '<p style="margin-bottom:12px;font-size:15px;">' + Layer8DUtils.escapeHtml(message) + '</p>' +
                (detail ? '<pre style="background:var(--layer8d-bg-light);padding:12px;border-radius:6px;font-size:12px;max-height:200px;overflow:auto;white-space:pre-wrap;word-break:break-word;">' + Layer8DUtils.escapeHtml(detail) + '</pre>' : '') +
                '</div>',
            size: 'medium',
            showFooter: true,
            saveButtonText: 'Go to Login',
            showCancelButton: false,
            onSave: function() {
                Layer8DPopup.close();
                window.location.href = 'l8ui/login/index.html';
            }
        });
    } else {
        alert(message + (detail ? '\n\n' + detail : ''));
        window.location.href = 'l8ui/login/index.html';
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    if (typeof Layer8DConfig !== 'undefined') {
        await Layer8DConfig.load();
    }

    const bearerToken = sessionStorage.getItem('bearerToken');
    if (!bearerToken) {
        window.location.href = 'l8ui/login/index.html';
        return;
    }

    localStorage.setItem('bearerToken', bearerToken);
    window.bearerToken = bearerToken;

    const username = sessionStorage.getItem('currentUser') || '';
    document.querySelector('.username').textContent = username;

    // Load per-type action permissions for the current user
    try {
        const permResp = await fetch('/permissions', {
            headers: { 'Authorization': `Bearer ${bearerToken}`, 'Content-Type': 'application/json' }
        });
        if (permResp.ok) {
            window.Layer8DPermissions = await permResp.json();
        }
    } catch (e) { console.warn('Failed to load permissions:', e); }

    loadSection('physio');

    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            loadSection(this.getAttribute('data-section'));
        });
    });
});
