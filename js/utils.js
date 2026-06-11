window.TemboTool = window.TemboTool || {};

(function(tt) {

  tt.esc = function(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  tt.shortPath = function(p, max) {
    if (max === undefined) max = 50;
    if (!p) return '';
    const parts = p.replace(/\\/g, '/').split('/');
    if (parts.length <= 3) return p;
    const result = '.../' + parts.slice(-2).join('/');
    return result.length > max ? result.slice(0, max) + '\u2026' : result;
  };

  tt.getDotClass = function(type) {
    const m = { write: 'dot-write', edit: 'dot-edit', run: 'dot-run', success: 'dot-success', error: 'dot-error', stdout: 'dot-stdout', cd: 'dot-cd' };
    return m[type] || 'dot-other';
  };

  tt.getTypeColor = function(type) {
    const m = { write: 'var(--accent)', edit: 'var(--accent2)', run: 'var(--green)', success: 'var(--cyan)', error: 'var(--red)', stdout: 'var(--yellow)', cd: 'var(--orange)', mkdir: 'var(--pink)' };
    return m[type] || 'var(--text-muted)';
  };

  tt.getFileIcon = function(ext) {
    const m = { kt: '\uD83D\uDD31', py: '\uD83D\uDC0D', js: '\uD83D\uDFE1', ts: '\uD83D\uDD37', html: '\uD83C\uDF10', css: '\uD83C\uDFA8', md: '\uD83D\uDCDD', json: '\uD83D\uDCCB', xml: '\uD83D\uDCC4', sh: '\u26A1', gradle: '\uD83D\uDD27', toml: '\uD83D\uDD27' };
    return m[ext] || '\uD83D\uDCC4';
  };

  tt.syntaxHighlight = function(line) {
    return line
      .replace(/(&quot;[^&]*&quot;)/g, '<span class="str">$1</span>')
      .replace(/\b(import|from|class|def|return|if|else|elif|for|while|try|except|with|as|pass|break|continue|True|False|None|val|var|fun|data|object|when|is|in|override|suspend|private|public|companion|enum|sealed|interface|abstract|extends|implements)\b/g, '<span class="kw">$1</span>');
  };

  tt.renderCode = function(content, isDiff) {
    if (isDiff === undefined) isDiff = false;
    if (typeof content === 'object') content = JSON.stringify(content, null, 2);
    if (!content) return '<div class="code-line"><span class="line-num">\u2014</span><span style="color:var(--text-muted);font-style:italic">Empty content</span></div>';
    const lines = String(content).split('\n');
    return lines.map(function(line, i) {
      var cls = 'code-line';
      var displayedLine = line;
      if (isDiff) {
        if (line.startsWith('+')) {
          cls += ' added';
          displayedLine = line.slice(1);
        } else if (line.startsWith('-')) {
          cls += ' removed';
          displayedLine = line.slice(1);
        } else if (line.startsWith('@@')) {
          return '<div class="' + cls + '" style="color:var(--accent2);background:rgba(124,111,247,0.05);padding:0 16px;font-weight:600;"><span class="line-num">@@</span><span>' + tt.esc(line) + '</span></div>';
        }
      }
      return '<div class="' + cls + '"><span class="line-num">' + (i + 1) + '</span><span>' + tt.syntaxHighlight(tt.esc(displayedLine)) + '</span></div>';
    }).join('');
  };

  tt.copyText = function(text) {
    navigator.clipboard.writeText(text)
      .then(function() { tt.toast('Copied to clipboard', 'success'); })
      .catch(function() { tt.toast('Failed to copy', 'error'); });
  };

  var toastTimer;
  tt.toast = function(msg, type) {
    if (type === undefined) type = '';
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'show ' + type;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() { el.className = ''; }, 3000);
  };

  tt.showProgress = function(show) {
    var el = document.getElementById('progress-bar');
    if (el) el.style.display = show ? 'block' : 'none';
  };

  tt.downloadFile = function(path, content) {
    var name = path.split('/').pop() || 'file.txt';
    var blob = new Blob([content], { type: 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  tt.debounce = function(fn, delay) {
    var timer = null;
    return function() {
      var context = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function() { fn.apply(context, args); }, delay);
    };
  };

})(window.TemboTool);
