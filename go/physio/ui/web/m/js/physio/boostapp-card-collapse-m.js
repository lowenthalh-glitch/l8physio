// Mobile Boostapp Calendar — collapsible card body.
// Renders BoostappCalendarEvent cards with the property list hidden behind
// a chevron toggle. Clicking the card body still opens the session popup;
// only the chevron toggles the property list.
(function() {
    'use strict';

    if (typeof Layer8MEditTable === 'undefined') return;

    var TARGET_MODEL = 'BoostappCalendarEvent';

    // Apply default sort (startTime ascending) for the Boostapp Calendar table.
    // The mobile view factory doesn't pass defaultSort through, so we hook into
    // init() — which runs before the first fetchData — to set sort fields when
    // the calling code hasn't already chosen one.
    if (Layer8MTable && Layer8MTable.prototype && Layer8MTable.prototype.init) {
        var origInit = Layer8MTable.prototype.init;
        Layer8MTable.prototype.init = function() {
            if (this.config && this.config.modelName === TARGET_MODEL && !this.sortColumn) {
                this.sortColumn = 'startTime';
                this.sortDirection = 'asc';
            }
            return origInit.apply(this, arguments);
        };
    }

    var origRenderDefaultCard = Layer8MEditTable.prototype._renderDefaultCard;

    Layer8MEditTable.prototype._renderDefaultCard = function(item, index) {
        if (this.config.modelName !== TARGET_MODEL) {
            return origRenderDefaultCard.call(this, item, index);
        }
        return renderCollapsibleCard.call(this, item, index);
    };

    function renderCollapsibleCard(item, index) {
        var cols = this.config.columns;
        var primaryCols   = cols.filter(function(c) { return c.primary; });
        var secondaryCols = cols.filter(function(c) { return c.secondary; });
        var bodyCols      = cols.filter(function(c) { return !c.primary && !c.secondary && !c.hidden; });
        var itemId = this.config.getItemId(item);

        var getValue = function(col) {
            if (col.render) return col.render(item, index);
            var v = Layer8MUtils.getNestedValue(item, col.key);
            if (col.formatter) v = col.formatter(v, item);
            return Layer8MUtils.escapeHtml(v);
        };

        var html = '<div class="mobile-edit-table-card boostapp-collapsible-card collapsed"'
                 + ' data-index="' + index + '"'
                 + ' data-id="' + Layer8MUtils.escapeAttr(itemId) + '">';

        html += '<div class="mobile-edit-table-card-header">';
        html += '<div class="mobile-edit-table-card-info">';
        primaryCols.forEach(function(col) {
            html += '<h4 class="mobile-edit-table-card-title">' + getValue(col) + '</h4>';
        });
        secondaryCols.forEach(function(col) {
            html += '<p class="mobile-edit-table-card-subtitle">' + getValue(col) + '</p>';
        });
        html += '</div>';

        if (bodyCols.length > 0) {
            html += '<button type="button" class="boostapp-collapse-toggle"'
                  + ' aria-label="Toggle details" title="Show/Hide details">'
                  + '<svg viewBox="0 0 24 24" width="22" height="22" fill="none"'
                  + ' stroke="currentColor" stroke-width="2"'
                  + ' stroke-linecap="round" stroke-linejoin="round">'
                  + '<polyline points="6 9 12 15 18 9"></polyline></svg>'
                  + '</button>';
        }

        html += '</div>'; // header

        if (bodyCols.length > 0) {
            html += '<div class="mobile-edit-table-card-body boostapp-collapsible-body">';
            bodyCols.forEach(function(col) {
                html += '<div class="mobile-edit-table-card-row">'
                      + '<span class="mobile-edit-table-card-label">'
                      + Layer8MUtils.escapeHtml(col.label) + '</span>'
                      + '<span class="mobile-edit-table-card-value">'
                      + getValue(col) + '</span>'
                      + '</div>';
            });
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    // Capture-phase listener so we beat the card's bubble-phase click handler
    // and can stop propagation before the row-click popup fires.
    document.addEventListener('click', function(e) {
        var btn = e.target.closest && e.target.closest('.boostapp-collapse-toggle');
        if (!btn) return;
        e.stopPropagation();
        e.preventDefault();
        var card = btn.closest('.boostapp-collapsible-card');
        if (card) card.classList.toggle('collapsed');
    }, true);

    var style = document.createElement('style');
    style.textContent =
        '.boostapp-collapsible-card.collapsed .boostapp-collapsible-body { display: none; }'
      + '.boostapp-collapse-toggle {'
      +   ' background: none; border: none; cursor: pointer; padding: 6px;'
      +   ' margin-left: 8px; color: var(--layer8d-text-medium, #555);'
      +   ' display: inline-flex; align-items: center; justify-content: center;'
      +   ' border-radius: 4px; transition: background-color 0.15s; flex-shrink: 0;'
      + ' }'
      + '.boostapp-collapse-toggle:hover {'
      +   ' background-color: var(--layer8d-bg-hover, rgba(0,0,0,0.06));'
      + ' }'
      + '.boostapp-collapse-toggle svg {'
      +   ' transition: transform 0.2s ease; transform: rotate(0deg);'
      + ' }'
      + '.boostapp-collapsible-card:not(.collapsed) .boostapp-collapse-toggle svg {'
      +   ' transform: rotate(180deg);'
      + ' }';
    document.head.appendChild(style);
})();
