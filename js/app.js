window.TemboTool = window.TemboTool || {};

(function(tt) {

  var state = tt.State.get();

  function init() {
    tt.Timeline.init(function(idx, el) {
      selectEvent(idx, el);
    });

    document.getElementById('file-input').addEventListener('change', function(e) {
      var f = e.target.files[0];
      if (f) loadLog(f);
    });

    var dz = document.getElementById('drop-zone');
    if (dz) {
      dz.addEventListener('dragover', function(e) { e.preventDefault(); dz.classList.add('drag-over'); });
      dz.addEventListener('dragleave', function() { dz.classList.remove('drag-over'); });
      dz.addEventListener('drop', function(e) {
        e.preventDefault();
        dz.classList.remove('drag-over');
        var f = e.dataTransfer.files[0];
        if (f) loadLog(f);
      });
    }

    document.getElementById('search-input').addEventListener('input', tt.debounce(function() {
      searchTimeline(this.value);
    }, 200));

    var sessBtn = document.getElementById('btn-sessions');
    if (sessBtn) sessBtn.addEventListener('click', showSessionModal);

    var repoBtn = document.getElementById('btn-connect-repo');
    if (repoBtn) {
      repoBtn.addEventListener('click', function() {
        if (tt.Repo.isConnected()) {
          tt.Repo.disconnect();
        } else {
          tt.Repo.connect();
        }
      });
    }

    restoreLastSession();
  }

  function loadLog(file) {
    tt.showProgress(true);
    state.logFileName = file.name;
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var result = tt.parseLog(e.target.result);
        applyParsedResult(result);
        tt.State.saveCurrentSession();
        tt.showProgress(false);
      } catch (err) {
        tt.showProgress(false);
        tt.toast('Error parsing log: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  function applyParsedResult(result) {
    tt.State.reset();
    state = tt.State.get();
    state.events = result.events;
    state.filteredEvents = result.events.slice();
    state.fileMap = result.fileMap;

    var writes = 0;
    var edits = 0;
    var paths = Object.keys(result.fileMap);
    for (var i = 0; i < paths.length; i++) {
      if (result.fileMap[paths[i]].isNew) writes++;
      else edits++;
    }
    document.getElementById('stat-writes').textContent = writes;
    document.getElementById('stat-edits').textContent = edits;
    document.getElementById('stat-cmds').textContent = result.events.filter(function(e) { return e.type === 'run'; }).length;
    document.getElementById('stat-errors').textContent = result.events.filter(function(e) { return e.type === 'error'; }).length;

    if (result.startTime && result.endTime) {
      var dur = Math.round((new Date(result.endTime) - new Date(result.startTime)) / 60000);
      document.getElementById('stat-duration').textContent = dur + 'm';
    }

    document.getElementById('drop-zone').style.display = 'none';
    document.getElementById('stats-bar').classList.add('visible');
    document.getElementById('toolbar').classList.add('visible');
    document.getElementById('main-layout').classList.add('visible');

    tt.Timeline.render(state.filteredEvents, state.activeIdx);
    tt.FileCards.render(state.fileMap);

    tt.toast('Parsed ' + result.events.length + ' events. Extracted ' + paths.length + ' files.', 'success');

    saveToLocalStorage(result);
  }

  function selectEvent(idx, itemEl) {
    document.querySelectorAll('.timeline-item.active').forEach(function(el) { el.classList.remove('active'); });
    if (itemEl) itemEl.classList.add('active');
    state.activeIdx = idx;
    tt.DetailPanel.render(state.filteredEvents[idx]);
  }

  tt.filterTimeline = function(type, eventTarget) {
    state.filteredEvents = tt.Timeline.applyFilter(type, state.events);
    if (state.currentSearch) {
      state.filteredEvents = tt.Timeline.applySearch(state.currentSearch, state.filteredEvents);
    }
    document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
    if (eventTarget) eventTarget.classList.add('active');
    state.activeIdx = -1;
    tt.Timeline.render(state.filteredEvents, state.activeIdx);
    showEmptyDetail();
  };

  function searchTimeline(q) {
    state.currentSearch = q;
    var base = state.currentFilter === 'all' ? state.events.slice() : state.events.filter(function(e) { return e.type === state.currentFilter; });
    state.filteredEvents = tt.Timeline.applySearch(q, base);
    state.activeIdx = -1;
    tt.Timeline.render(state.filteredEvents, state.activeIdx);
    showEmptyDetail();
  }

  function showEmptyDetail() {
    var panel = document.getElementById('detail-panel');
    if (panel) {
      panel.innerHTML =
        '<div class="empty-state">' +
          '<div class="icon">\uD83D\uDC48</div>' +
          '<h3>Select an event</h3>' +
          '<p>Click any event in the timeline to see its details</p>' +
        '</div>';
    }
  }

  tt.copyAllFiles = function() {
    var all = [];
    var paths = Object.keys(state.fileMap);
    for (var i = 0; i < paths.length; i++) {
      all.push('// ===== ' + paths[i] + ' =====\n' + (state.fileMap[paths[i]].content || ''));
    }
    tt.copyText(all.join('\n\n'));
  };

  tt.copyFromFileMap = function(path) {
    var info = state.fileMap[path];
    if (info) tt.copyText(info.content || '');
  };

  tt.downloadFromFileMap = function(path) {
    var info = state.fileMap[path];
    if (info) tt.downloadFile(path, info.content || '');
  };

  tt.downloadPackage = function() {
    var lines = ['# Tembo Log Extracted Files\n# Generated: ' + new Date().toISOString() + '\n'];
    var paths = Object.keys(state.fileMap);
    for (var i = 0; i < paths.length; i++) {
      lines.push('# ===== FILE: ' + paths[i] + ' =====');
      lines.push(state.fileMap[paths[i]].content || '');
      lines.push('');
    }
    var blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tembo-changes-' + Date.now() + '.txt';
    a.click();
    URL.revokeObjectURL(a.href);
    tt.toast('Downloading changes package', 'success');
  };

  tt.downloadScript = function() {
    var script = tt.Repo.generateScript();
    var blob = new Blob([script], { type: 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'apply-tembo-changes.ps1';
    a.click();
    URL.revokeObjectURL(a.href);
    tt.toast('Downloaded PowerShell script. Run it from your repo root.', 'success');
  };

  function saveToLocalStorage(result) {
    try {
      var data = {
        fileName: state.logFileName,
        timestamp: Date.now(),
        events: result.events,
        fileMap: result.fileMap
      };
      localStorage.setItem('tembotool_last_session', JSON.stringify(data));
    } catch (e) {
      // localStorage may be full
    }
  }

  function restoreLastSession() {
    try {
      var raw = localStorage.getItem('tembotool_last_session');
      if (raw) {
        var data = JSON.parse(raw);
        if (data.fileMap && Object.keys(data.fileMap).length > 0) {
          var result = {
            events: data.events || [],
            fileMap: data.fileMap || {},
            startTime: null,
            endTime: null
          };
          if (result.events.length > 0) {
            result.startTime = result.events[0].ts;
            result.endTime = result.events[result.events.length - 1].ts;
          }
          state.logFileName = data.fileName || 'Previous session';
          applyParsedResult(result);
          tt.toast('Restored previous session: ' + state.logFileName, 'success');
        }
      }
    } catch (e) {
      // ignore restore errors
    }
  }

  function showSessionModal() {
    var existing = document.getElementById('session-modal-overlay');
    if (existing) {
      existing.classList.toggle('open');
      return;
    }

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.id = 'session-modal-overlay';
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.classList.remove('open');
    });

    var sessions = tt.State.getSessions();
    var itemsHtml = '';
    if (sessions.length === 0) {
      itemsHtml = '<div style="color:var(--text-muted);padding:20px;text-align:center">No previous sessions</div>';
    } else {
      for (var i = 0; i < sessions.length; i++) {
        var s = sessions[i];
        itemsHtml +=
          '<div class="session-item">' +
            '<div class="si-name">' + tt.esc(s.fileName) + '</div>' +
            '<div class="si-meta">' + new Date(s.timestamp).toLocaleString() + ' \u2014 ' +
              s.eventCount + ' events, ' + s.fileCount + ' files' +
              (s.errorCount > 0 ? ', ' + s.errorCount + ' errors' : '') +
              (s.appliedCount > 0 ? ', ' + s.appliedCount + ' applied' : '') +
            '</div>' +
          '</div>';
      }
    }

    overlay.innerHTML =
      '<div class="modal">' +
        '<button class="modal-close" onclick="document.getElementById(\'session-modal-overlay\').classList.remove(\'open\')">\u2716</button>' +
        '<h2>\uD83D\uDCC4 Session History</h2>' +
        itemsHtml +
        (sessions.length > 0 ?
          '<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">' +
            '<button class="btn btn-sm btn-red" onclick="if(confirm(\'Clear all session history?\')){TemboTool.State.clearSessions();document.getElementById(\'session-modal-overlay\').classList.remove(\'open\');}">Clear History</button>' +
          '</div>' : '') +
      '</div>';

    document.body.appendChild(overlay);
  }

  document.addEventListener('DOMContentLoaded', init);

})(window.TemboTool);
