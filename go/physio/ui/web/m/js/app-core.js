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

    window.MobileApp = {
        async init() {
            if (!Layer8MAuth.requireAuth()) return;

            await Layer8MConfig.load();
            await Layer8DConfig.load();

            this.updateUserInfo();

            const token = Layer8MAuth.getBearerToken();

            // Load per-type action permissions
            try {
                const permResp = await fetch('/permissions', {
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                });
                if (permResp.ok) {
                    window.Layer8DPermissions = await permResp.json();
                }
            } catch (e) { console.warn('Failed to load permissions:', e); }

            // Physio does not use ModConfig — skip Layer8DModuleFilter to avoid logout on 404

            // Apply permission-based sidebar filtering
            if (typeof Layer8DPermissionFilter !== 'undefined' && window.Layer8DPermissions) {
                this.applyPermissionFilter();
            }

            this.initSidebar();

            var refreshBtn = document.getElementById('refresh-btn');
            if (refreshBtn) refreshBtn.addEventListener('click', () => {
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
                    const response = await fetch(sectionUrl + '?t=' + Date.now());
                    if (!response.ok) throw new Error('Failed to load section');
                    const html = await response.text();
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

        async _loadDashboardForModule(moduleKey, forceReload) {
            this.updateNavState(moduleKey);

            const contentArea = document.getElementById('content-area');
            if (!contentArea) return;

            contentArea.style.opacity = '0.5';

            try {
                if (!forceReload && sectionCache['dashboard']) {
                    contentArea.innerHTML = sectionCache['dashboard'];
                } else {
                    const response = await fetch(SECTIONS['dashboard'] + '?t=' + Date.now());
                    if (!response.ok) throw new Error('Failed to load dashboard');
                    const html = await response.text();
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
