window.TemboTool = window.TemboTool || {};

(function(tt) {

  var onSelectCallback = null;

  tt.Timeline = {
    init: function(onSelect) {
      onSelectCallback = onSelect;
    },

    render: function(events, activeIdx) {
      var list = document.getElementById('timeline-list');
      if (!list) return;
      list.innerHTML = '';

      for (var i = 0; i < events.length; i++) {
        var ev = events[i];
        var item = document.createElement('div');
        item.className = 'timeline-item' + (i === activeIdx ? ' active' : '');
        item.dataset.idx = i;

        var colorClass = tt.getDotClass(ev.type);
        var timeStr = new Date(ev.ts).toLocaleTimeString();
        var pathOrLabel = ev.path || ev.command || ev.cwd || ev.label || '';

        item.innerHTML =
          '<div class="ti-dot ' + colorClass + '"></div>' +
          '<div class="ti-body">' +
            '<div class="ti-type" style="color:' + tt.getTypeColor(ev.type) + '">' + tt.esc(ev.type) + '</div>' +
            '<div class="ti-path" title="' + tt.esc(pathOrLabel) + '">' + tt.esc(tt.shortPath(pathOrLabel)) + '</div>' +
            '<div class="ti-time">' + timeStr + '</div>' +
          '</div>';

        (function(idx, el) {
          el.addEventListener('click', function() {
            if (onSelectCallback) onSelectCallback(idx, el);
          });
        })(i, item);

        list.appendChild(item);
      }
    },

    applyFilter: function(filterType, events) {
      var state = tt.State.get();
      state.currentFilter = filterType;
      if (filterType === 'all') {
        return events.slice();
      }
      return events.filter(function(e) { return e.type === filterType; });
    },

    applySearch: function(query, baseEvents) {
      if (!query) return baseEvents.slice();
      var q = query.toLowerCase();
      return baseEvents.filter(function(e) {
        var searchable = [e.type, e.path, e.command, e.label, e.stdout].filter(Boolean).join(' ').toLowerCase();
        return searchable.indexOf(q) !== -1;
      });
    }
  };

})(window.TemboTool);
