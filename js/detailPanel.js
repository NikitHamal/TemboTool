window.TemboTool = window.TemboTool || {};

(function(tt) {

  tt.DetailPanel = {
    render: function(ev) {
      var panel = document.getElementById('detail-panel');
      if (!panel) return;

      var bodyHtml = '';

      if (ev.type === 'write' || ev.type === 'edit') {
        var content = ev.content || (ev.details && ev.details.content) || '';
        bodyHtml =
          '<div style="position:relative;">' +
            '<button class="copy-btn" onclick="TemboTool.DetailPanel.copyActiveContent()">Copy</button>' +
            '<div class="code-block" style="padding:16px 0">' +
              tt.renderCode(content) +
            '</div>' +
          '</div>';
      } else if (ev.type === 'run' || ev.type === 'success' || ev.type === 'error') {
        var cmd = ev.command || ev.details.command || '';
        var stdout = ev.stdout || '';
        var stderr = ev.stderr || '';
        var exitCode = ev.exitCode;
        bodyHtml =
          '<div style="padding:16px 20px">' +
            (cmd ? '<div style="margin-bottom:12px">' +
              '<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Command</div>' +
              '<div style="font-family:\'JetBrains Mono\',monospace;font-size:13px;background:var(--surface3);padding:10px 14px;border-radius:8px;color:var(--accent)">' + tt.esc(cmd) + '</div>' +
            '</div>' : '') +
            (stdout ? '<div style="margin-bottom:12px"><div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">stdout</div><pre style="font-family:\'JetBrains Mono\',monospace;font-size:11.5px;background:var(--surface3);padding:10px 14px;border-radius:8px;overflow-x:auto;color:var(--green);white-space:pre-wrap">' + tt.esc(stdout) + '</pre></div>' : '') +
            (stderr ? '<div><div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">stderr</div><pre style="font-family:\'JetBrains Mono\',monospace;font-size:11.5px;background:var(--surface3);padding:10px 14px;border-radius:8px;overflow-x:auto;color:var(--red);white-space:pre-wrap">' + tt.esc(stderr) + '</pre></div>' : '') +
            (exitCode !== undefined ? '<div style="margin-top:12px;font-size:12px;color:' + (exitCode === 0 ? 'var(--green)' : 'var(--red)') + '">Exit code: ' + exitCode + '</div>' : '') +
          '</div>';
      } else if (ev.type === 'stdout') {
        var msg = ev.details && ev.details.result ? ev.details.result : ev.label;
        bodyHtml =
          '<div class="ai-summary" style="margin:16px 20px;border-radius:8px;">' +
            '\uD83D\uDCAC <strong>AI Agent Said:</strong><br><br>' + tt.esc(String(msg)) +
          '</div>';
      } else {
        bodyHtml = '<div style="padding:16px 20px"><pre style="font-family:\'JetBrains Mono\',monospace;font-size:11px;color:var(--text-muted);white-space:pre-wrap;overflow-x:auto">' + tt.esc(ev.raw || JSON.stringify(ev.details, null, 2)) + '</pre></div>';
      }

      var subtitle = ev.path || ev.command || ev.cwd || '';

      panel.innerHTML =
        '<div class="panel">' +
          '<div class="panel-header">' +
            '<div class="ti-dot ' + tt.getDotClass(ev.type) + '" style="width:12px;height:12px;flex-shrink:0"></div>' +
            '<div>' +
              '<div class="panel-title" style="color:' + tt.getTypeColor(ev.type) + '">' + ev.type.toUpperCase() + ' \u2014 ' + new Date(ev.ts).toLocaleTimeString() + '</div>' +
              (subtitle ? '<div class="panel-subtitle" style="font-family:\'JetBrains Mono\',monospace">' + tt.esc(subtitle) + '</div>' : '') +
            '</div>' +
            ((ev.type === 'write' || ev.type === 'edit') && ev.path ?
              '<div class="panel-actions">' +
                '<button class="btn btn-sm btn-green" onclick="TemboTool.DetailPanel.markActiveApplied()">\u2705 Mark Applied</button>' +
              '</div>' : '') +
          '</div>' +
          bodyHtml +
        '</div>';
    },

    copyActiveContent: function() {
      var state = tt.State.get();
      if (state.activeIdx !== -1) {
        var ev = state.filteredEvents[state.activeIdx];
        var content = ev.content || (ev.details && ev.details.content) || '';
        tt.copyText(content);
      }
    },

    markActiveApplied: function() {
      var state = tt.State.get();
      if (state.activeIdx !== -1) {
        var ev = state.filteredEvents[state.activeIdx];
        if (ev.path) {
          tt.FileCards.markApplied(ev.path);
        }
      }
    }
  };

})(window.TemboTool);
