// Main application initialization

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

// Read the bearer from sessionStorage first, then fall back to localStorage —
// mirrors Layer8MAuth.getBearerToken() on mobile so the two surfaces persist
// sessions the same way (sessionStorage for the current tab, localStorage only
// when the user opted into remember-me).
function _getStoredToken() {
    return sessionStorage.getItem('bearerToken') || localStorage.getItem('bearerToken');
}

function getAuthHeaders() {
    const bearerToken = _getStoredToken();
    return {
        'Authorization': bearerToken ? `Bearer ${bearerToken}` : '',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
    };
}

async function makeAuthenticatedRequest(url, options = {}) {
    const bearerToken = _getStoredToken();

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
    await Layer8DConfig.load();

    const bearerToken = _getStoredToken();
    if (!bearerToken) {
        window.location.href = 'l8ui/login/index.html';
        return;
    }

    // Gate the localStorage copy on the same signal mobile uses:
    // login-auth.js writes 'rememberedUser' iff the user checked "Remember me",
    // so a match between that and the current user means remember-me is on.
    // Without this, the bearer would leak to persistent storage on shared
    // devices even when the user declined remember-me.
    const rememberMe = !!localStorage.getItem('rememberedUser') &&
        localStorage.getItem('rememberedUser') === sessionStorage.getItem('currentUser');
    if (rememberMe) {
        localStorage.setItem('bearerToken', bearerToken);
    } else {
        localStorage.removeItem('bearerToken');
    }
    window.bearerToken = bearerToken;

    const username = sessionStorage.getItem('currentUser') || 'Admin';
    document.querySelector('.username').textContent = username;

    // Load per-type action permissions for the current user
    // Required fetch: unset Layer8DPermissions is read by l8ui as PERMISSIVE, so fail loudly.
    const permResp = await fetch('/permissions', {
        headers: { 'Authorization': `Bearer ${bearerToken}`, 'Content-Type': 'application/json' }
    });
    if (!permResp.ok) throw new Error('/permissions returned HTTP ' + permResp.status);
    const perms = await permResp.json();
    if (perms === null || typeof perms !== 'object') throw new Error('/permissions: expected an object');
    window.Layer8DPermissions = perms;

    // Physio does not use ModConfig — skip Layer8DModuleFilter to avoid logout on 404

    // Apply permission-based nav filtering (hide modules/services user can't GET)
    const nsMap = {
        'physio': 'Physio'
    };
    Layer8DPermissionFilter.registerResolver(function(sectionKey, moduleKey, serviceKey) {
        var ns = window[nsMap[sectionKey]];
        if (!ns || !ns.modules || !ns.modules[moduleKey]) return null;
        var svc = ns.modules[moduleKey].services.find(function(s) { return s.key === serviceKey; });
        return svc ? svc.model : null;
    });

    var sidebarModels = {};
    Object.keys(nsMap).forEach(function(section) {
        var ns = window[nsMap[section]];
        if (!ns || !ns.modules) return;
        var models = [];
        Object.values(ns.modules).forEach(function(mod) {
            if (mod.services) mod.services.forEach(function(svc) { if (svc.model) models.push(svc.model); });
        });
        sidebarModels[section] = models;
    });
    Layer8DPermissionFilter.applyToSidebar(sidebarModels);

    // Initialize floating AI chat bubble
    if (typeof L8AgentBubble !== 'undefined') {
        L8AgentBubble.init({ chatEndpoint: '/55/AgntChat' });
    }

    const hashParts = typeof getHashParts === 'function' ? getHashParts() : { section: '', service: '' };
    const initSection = hashParts.section && sections[hashParts.section] ? hashParts.section : 'physio';
    loadSection(initSection);
    if (hashParts.service) {
        setTimeout(function() {
            const navItem = document.querySelector('.l8-subnav-item[data-service="' + hashParts.service + '"]');
            if (navItem) navItem.click();
        }, 500);
    }

    // Sidebar: one entry per Physio management service, plus System.
    const navLinks = document.querySelectorAll('.nav-link');
    // Hide service entries the user cannot GET (the in-page sub-nav is hidden, so applyToSection no longer covers them).
    navLinks.forEach(link => {
        const svc = link.getAttribute('data-service');
        if (!svc) return;
        const model = Layer8DPermissionFilter._resolve('physio', 'management', svc);
        if (model && !Layer8DPermissionFilter.canView(model)) link.closest('li').style.display = 'none';
    });

    const setActive = function(link) {
        navLinks.forEach(l => l.classList.remove('active'));
        if (link) link.classList.add('active');
    };
    const activeLinkFor = function(section, service) {
        if (section === 'physio') return document.querySelector('.nav-link[data-service="' + (service || 'therapists') + '"]');
        return document.querySelector('.nav-link[data-section="' + section + '"]:not([data-service])');
    };
    setActive(activeLinkFor(initSection, hashParts.service));

    // Run cb once the physio section is rendered and initialised (sub-nav handlers are bound by its initializer).
    const whenPhysioReady = function(service, cb) {
        const ready = function() {
            return document.querySelector('.l8-subnav-item[data-service="' + service + '"]') &&
                window.Physio && window.Physio._state && window.Physio._state.sectionEl;
        };
        if (ready()) { cb(); return; }
        const area = document.getElementById('content-area');
        const obs = new MutationObserver(function() { if (ready()) { obs.disconnect(); clearTimeout(timer); cb(); } });
        const timer = setTimeout(function() { obs.disconnect(); }, 10000);
        obs.observe(area, { childList: true, subtree: true, attributes: true });
    };
    const physioLoaded = function() {
        return !!document.querySelector('.physio-section') && !!(window.Physio && window.Physio._state && window.Physio._state.sectionEl);
    };

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            setActive(this);
            const section = this.getAttribute('data-section');
            const service = this.getAttribute('data-service');
            if (section !== 'physio') { loadSection(section); return; }
            if (!physioLoaded()) loadSection('physio');
            whenPhysioReady(service, function() {
                const item = document.querySelector('.l8-subnav-item[data-service="' + service + '"]');
                if (item) item.click();
            });
        });
    });

    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.addEventListener('scroll', function() {
            const scrollPosition = this.scrollTop;
            const sectionContainer = this.querySelector('.section-container');
            if (sectionContainer) {
                const parallaxOffset = scrollPosition * 0.3;
                sectionContainer.style.transform = `translateY(${parallaxOffset * 0.1}px)`;
            }
        });
    }
});
