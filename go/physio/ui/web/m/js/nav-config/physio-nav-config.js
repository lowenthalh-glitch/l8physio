(function() {
    'use strict';

    window.LAYER8M_NAV_CONFIG = {
        modules: [
            { key: 'physio', label: 'Physiotherapy', icon: 'physio', hasSubModules: true },
            { key: 'aia',    label: 'AI Agent',       icon: 'aia',   hasSubModules: true },
            { key: 'system', label: 'System',         icon: 'system', hasSubModules: true }
        ],

        physio: {
            subModules: [
                { key: 'management', label: 'Management', icon: 'physio' }
            ],
            services: {
                'management': [
                    { key: 'clients',      label: 'Clients',         icon: 'person',
                      endpoint: '/50/PhyClient',  model: 'PhysioClient',  idField: 'clientId',
                      onRowClick: function(item, id) {
                          if (window.MobilePhysioClientExercises) {
                              MobilePhysioClientExercises.open(id);
                          }
                      }},
                    { key: 'exercises',    label: 'Exercises',       icon: 'activity',
                      endpoint: '/50/PhyExercis', model: 'PhysioExercise',idField: 'exerciseId' },
                    { key: 'plans',        label: 'Treatment Plans', icon: 'clipboard',
                      endpoint: '/50/PhyPlan',    model: 'TreatmentPlan', idField: 'planId',
                      supportedViews: ['table', 'calendar'] },
                    { key: 'appointments', label: 'Appointments',    icon: 'calendar',
                      endpoint: '/50/PhyAppt',    model: 'Appointment',   idField: 'apptId',
                      supportedViews: ['table', 'calendar'] },
                    { key: 'progress',     label: 'Progress Logs',   icon: 'chart',
                      endpoint: '/50/PhyLog',     model: 'ProgressLog',   idField: 'logId' },
                    { key: 'protocols',    label: 'Protocols',        icon: 'clipboard',
                      endpoint: '/50/PhyProto', model: 'PhysioProtocol', idField: 'protocolId' },
                    { key: 'boostapp',     label: 'Boostapp Calendar', icon: 'calendar',
                      endpoint: '/50/BstpCal',  model: 'BoostappCalendarEvent', idField: 'eventId',
                      readOnly: true, supportedViews: ['table', 'calendar'] }
                ]
            }
        },

        aia: {
            subModules: [
                { key: 'agent', label: 'Agent', icon: 'aia' }
            ],
            services: {
                'agent': [
                    { key: 'chat', label: 'Chat', icon: 'aia',
                      customInit: 'MobileAiaAgent', customContainer: 'aia-chat-container',
                      subtitle: 'AI-powered assistant' }
                ]
            }
        },

        system: {
            subModules: [
                { key: 'admin', label: 'Administration', icon: 'system' }
            ],
            services: {
                'admin': [
                    { key: 'health',      label: 'Health',      icon: 'system',
                      endpoint: '/0/Health',     model: 'L8Health',   idField: 'service', readOnly: true },
                    { key: 'users',       label: 'Users',       icon: 'person',
                      endpoint: '/0/User',       model: 'L8User',     idField: 'userId' },
                    { key: 'roles',       label: 'Roles',       icon: 'system',
                      endpoint: '/0/Role',       model: 'L8Role',     idField: 'roleId' }
                ]
            }
        },

        icons: {
            'physio': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>',
            'aia':    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.17A7 7 0 0 1 14 23h-4a7 7 0 0 1-6.83-4H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"></path><circle cx="9" cy="15" r="1"></circle><circle cx="15" cy="15" r="1"></circle></svg>',
            'system': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
            'person':    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
            'activity':  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>',
            'clipboard': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>',
            'calendar':  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
            'chart':     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>',
            'default':   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>'
        },

        getIcon(key) {
            return this.icons[key] || this.icons['default'];
        }
    };
})();
