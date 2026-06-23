(function() {
    'use strict';

    const SECTIONS = {
        'dashboard': 'sections/dashboard.html',
        'system':    'sections/system.html'
    };

    let currentSection = 'dashboard';
    let sectionCache = {};

    // Global showErrorAndLogout for layer8d-module-filter.js compatibility
    window.showErrorAndLogout = function(message, detail) {
        if (typeof Layer8MAuth !== 'undefined') {
            Layer8MAuth.showErrorAndLogout(message, detail);
        } else {
            alert(message + (detail ? '\n\n' + detail : ''));
            window.location.href = '../l8ui/login/index.html';
        }
    };

    // Polyfill Layer8MAuth.fetchText — l8ui's mobile auth ships get/post/put/...
    // but no text-returning helper, and loadSection() needs raw HTML. Mirror
    // get() but return response.text() instead of response.json().
    if (typeof Layer8MAuth !== 'undefined' && !Layer8MAuth.fetchText) {
        Layer8MAuth.fetchText = async function(url) {
            const response = await this.makeAuthenticatedRequest(url, { method: 'GET' });
            if (!response) return null; // 401 — redirect already in progress
            if (!response.ok) {
                throw new Error('Request failed: ' + response.status);
            }
            return response.text();
        };
    }

    // Wrap Layer8MAuth.logout so it also clears userPortal. l8ui's logout
    // only clears bearerToken/currentUser, which would otherwise leak the
    // previous user's portal-filtered nav into the next login on the same tab.
    if (typeof Layer8MAuth !== 'undefined' && Layer8MAuth.logout && !Layer8MAuth._portalLogoutPatched) {
        var _origLogout = Layer8MAuth.logout.bind(Layer8MAuth);
        Layer8MAuth.logout = function(redirect) {
            sessionStorage.removeItem('userPortal');
            return _origLogout(redirect);
        };
        Layer8MAuth._portalLogoutPatched = true;
    }

    window.MobileApp = {
        async init() {
            if (!Layer8MAuth.requireAuth()) return;

            await Layer8MConfig.load();
            await Layer8DConfig.load();

            this.updateUserInfo();

            // Load per-type action permissions
            try {
                const perms = await Layer8MAuth.get('/permissions');
                if (perms) window.Layer8DPermissions = perms;
            } catch (e) { console.warn('Failed to load permissions:', e); }

            // Physio does not use ModConfig — skip Layer8DModuleFilter to avoid logout on 404

            // Apply permission-based sidebar filtering
            if (typeof Layer8DPermissionFilter !== 'undefined' && window.Layer8DPermissions) {
                this.applyPermissionFilter();
            }

            // Apply portal-based service filtering (mirrors desktop portal HTML files)
            this.applyPortalFilter();

            this.initSidebar();

            var refreshBtn = document.getElementById('refresh-btn');
            if (refreshBtn) refreshBtn.addEventListener('click', () => {
                // If the user is inside a data list, refresh just the list.
                // currentSection only tracks the top-level section, so reloading
                // it would bounce the user back to the home module grid.
                var activeTable = window._Layer8MNavActiveTable;
                if (activeTable && typeof activeTable.refresh === 'function'
                    && activeTable.containerId
                    && document.getElementById(activeTable.containerId)) {
                    activeTable.refresh();
                    return;
                }
                this.loadSection(currentSection, true);
            });

            const hash = window.location.hash.slice(1);
            const section = SECTIONS[hash] ? hash : 'dashboard';
            await this.loadSection(section);

            window.addEventListener('hashchange', () => {
                const newSection = window.location.hash.slice(1);
                if (SECTIONS[newSection] && newSection !== currentSection) {
                    this.loadSection(newSection);
                }
            });
        },

        updateUserInfo() {
            const username = Layer8MAuth.getUsername();
            const initial = username.charAt(0).toUpperCase();
            const nameEl = document.getElementById('user-name');
            const avatarEl = document.getElementById('user-avatar');
            if (nameEl) nameEl.textContent = username;
            if (avatarEl) avatarEl.textContent = initial;
        },

        initSidebar() {
            const menuToggle = document.getElementById('menu-toggle');
            const overlay = document.getElementById('sidebar-overlay');

            if (menuToggle) menuToggle.addEventListener('click', () => this.openSidebar());
            if (overlay) overlay.addEventListener('click', () => this.closeSidebar());

            document.querySelectorAll('.sidebar-item[data-section]').forEach(item => {
                item.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const section = item.dataset.section;
                    const module = item.dataset.module;
                    this.closeSidebar();
                    await this.loadSection(section);
                    if (module && window.Layer8MNav) {
                        Layer8MNav.navigateToModule(module);
                    }
                });
            });
        },

        openSidebar() {
            var sb = document.getElementById('sidebar');
            var sbo = document.getElementById('sidebar-overlay');
            if (sb) sb.classList.add('open');
            if (sbo) sbo.classList.add('visible');
            document.body.style.overflow = 'hidden';
        },

        closeSidebar() {
            var sb = document.getElementById('sidebar');
            var sbo = document.getElementById('sidebar-overlay');
            if (sb) sb.classList.remove('open');
            if (sbo) sbo.classList.remove('visible');
            document.body.style.overflow = '';
        },

        async loadSection(section, forceReload = false) {
            if (section === 'dashboard' && sessionStorage.getItem('userPortal') === 'client-app.html') {
                this._loadClientLanding();
                return;
            }
            if (section !== 'dashboard' && section !== 'system' &&
                window.LAYER8M_NAV_CONFIG && LAYER8M_NAV_CONFIG[section]) {
                await this._loadDashboardForModule(section, forceReload);
                return;
            }

            const sectionUrl = SECTIONS[section] || SECTIONS['dashboard'];
            this.updateNavState(section);

            const contentArea = document.getElementById('content-area');
            if (!contentArea) return;

            contentArea.style.opacity = '0.5';

            try {
                if (!forceReload && sectionCache[section]) {
                    contentArea.innerHTML = sectionCache[section];
                } else {
                    const html = await Layer8MAuth.fetchText(sectionUrl + '?t=' + Date.now());
                    if (html === null) return; // 401 — redirect already in progress
                    sectionCache[section] = html;
                    contentArea.innerHTML = html;
                }

                this.executeScripts(contentArea);
                this.initSection(section);

                currentSection = section;
                window.location.hash = section;
                contentArea.scrollTop = 0;

            } catch (error) {
                console.error('Error loading section:', error);
                contentArea.innerHTML = `
                    <div style="padding:32px;text-align:center;color:#6b7280;">
                        <p>Failed to load section. <button onclick="MobileApp.loadSection('${section}', true)" style="color:#2563eb;background:none;border:none;cursor:pointer;text-decoration:underline;">Retry</button></p>
                    </div>`;
            }

            contentArea.style.opacity = '1';
        },

        _loadClientLanding() {
            const contentArea = document.getElementById('content-area');
            if (!contentArea) return;
            this.updateNavState('dashboard');
            currentSection = 'dashboard';
            if (window.MobilePhysioClientLanding) {
                MobilePhysioClientLanding.renderForCurrentUser(contentArea);
            } else {
                contentArea.innerHTML = '<div style="padding:32px;text-align:center;color:#6b7280;">Client landing module not loaded.</div>';
            }
        },

        async _loadDashboardForModule(moduleKey, forceReload) {
            this.updateNavState(moduleKey);

            const contentArea = document.getElementById('content-area');
            if (!contentArea) return;

            contentArea.style.opacity = '0.5';

            try {
                if (!forceReload && sectionCache['dashboard']) {
                    contentArea.innerHTML = sectionCache['dashboard'];
                } else {
                    const html = await Layer8MAuth.fetchText(SECTIONS['dashboard'] + '?t=' + Date.now());
                    if (html === null) return; // 401 — redirect already in progress
                    sectionCache['dashboard'] = html;
                    contentArea.innerHTML = html;
                }

                this.executeScripts(contentArea);
                this.initSection('dashboard');

                Layer8MNav.navigateToModule(moduleKey);

                currentSection = moduleKey;
                window.location.hash = moduleKey;
                contentArea.scrollTop = 0;
            } catch (error) {
                console.error('Error loading module:', error);
            }

            contentArea.style.opacity = '1';
        },

        updateNavState(section) {
            document.querySelectorAll('.sidebar-item').forEach(item => {
                item.classList.remove('active');
                const itemSection = item.dataset.section;
                const itemModule = item.dataset.module;
                if (itemModule === section || itemSection === section) {
                    item.classList.add('active');
                }
            });
        },

        executeScripts(container) {
            container.querySelectorAll('script').forEach(oldScript => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                newScript.textContent = oldScript.textContent;
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });
        },

        initSection(section) {
            const initFunctions = {
                'dashboard': 'initMobileDashboard',
                'system':    'initMobileSystem'
            };
            const initFn = initFunctions[section];
            if (initFn && typeof window[initFn] === 'function') {
                window[initFn]();
            }
        },

        applyPortalFilter() {
            var portal = sessionStorage.getItem('userPortal') || '';
            if (!portal || portal === 'app.html') return; // admin — no filtering

            // Define which services each portal can see (matches desktop portal HTML files)
            var PORTAL_SERVICES = {
                'client-app.html':    ['clients'],
                'therapist-app.html': ['therapists', 'clients', 'boostapp']
            };
            var PORTAL_SIDEBAR = {
                'client-app.html':    ['physio'],
                'therapist-app.html': ['physio', 'aia']
            };

            var allowed = PORTAL_SERVICES[portal];
            var allowedSidebar = PORTAL_SIDEBAR[portal];
            if (!allowed) return;

            // Filter sidebar items
            if (allowedSidebar) {
                document.querySelectorAll('.sidebar-item[data-module]').forEach(function(item) {
                    var mod = item.dataset.module;
                    if (mod && allowedSidebar.indexOf(mod) === -1) {
                        item.style.display = 'none';
                    }
                });
            }

            // Filter nav config services — remove disallowed services from config
            var nc = window.LAYER8M_NAV_CONFIG;
            if (nc && nc.physio && nc.physio.services && nc.physio.services.management) {
                nc.physio.services.management = nc.physio.services.management.filter(function(svc) {
                    return allowed.indexOf(svc.key) !== -1;
                });
            }

            // Filter top-level home modules (home card grid) to match the sidebar
            if (allowedSidebar && nc && Array.isArray(nc.modules)) {
                nc.modules = nc.modules.filter(function(m) {
                    return allowedSidebar.indexOf(m.key) !== -1;
                });
            }

            // Hide dashboard KPI stats grid for non-admin portals
            if (!document.getElementById('portal-hide-stats-style')) {
                var style = document.createElement('style');
                style.id = 'portal-hide-stats-style';
                style.textContent = '#nav-stats { display: none !important; }';
                document.head.appendChild(style);
            }
        },

        applyPermissionFilter() {
            if (!window.Layer8DPermissionFilter || !Layer8DPermissionFilter._isActive()) return;
            document.querySelectorAll('.sidebar-item[data-section]').forEach(item => {
                const section = item.dataset.section;
                const module = item.dataset.module;
                if (section === 'dashboard' || module === 'system') return;
                const moduleKey = module || section;
                var mc = window.LAYER8M_NAV_CONFIG && LAYER8M_NAV_CONFIG[moduleKey];
                if (!mc || !mc.services) return;
                var hasAny = false;
                Object.values(mc.services).forEach(function(svcs) {
                    svcs.forEach(function(svc) {
                        if (svc.model && Layer8DPermissionFilter.canView(svc.model)) hasAny = true;
                    });
                });
                if (!hasAny) item.style.display = 'none';
            });
        },

        getCurrentSection() {
            return currentSection;
        },

        logout() {
            Layer8MAuth.logout();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => MobileApp.init());
    } else {
        MobileApp.init();
    }
})();
