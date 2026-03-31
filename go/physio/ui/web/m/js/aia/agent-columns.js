(function() {
    'use strict';
    window.MobileAiaAgent = window.MobileAiaAgent || {};

    var cols = L8Agent.columns;
    MobileAiaAgent.columns = {
        L8AgentConversation: cols.L8AgentConversation.map(function(c) {
            if (c.key === 'title')  return Object.assign({}, c, { primary: true });
            if (c.key === 'status') return Object.assign({}, c, { secondary: true });
            return c;
        }),
        L8AgentPrompt: cols.L8AgentPrompt.map(function(c) {
            if (c.key === 'name')     return Object.assign({}, c, { primary: true });
            if (c.key === 'category') return Object.assign({}, c, { secondary: true });
            return c;
        })
    };
    MobileAiaAgent.primaryKeys = L8Agent.primaryKeys;
})();
