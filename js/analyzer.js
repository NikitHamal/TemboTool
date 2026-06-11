window.TemboTool = window.TemboTool || {};

(function(tt) {

  var analysis = {};
  var pathMapping = {};

  function normalizePath(p) {
    return p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
  }

  function findCommonPrefix(paths) {
    if (!paths || paths.length === 0) return '';
    var normalized = paths.map(normalizePath);
    var parts = normalized[0].split('/');
    var prefix = '';
    for (var i = 0; i < parts.length - 1; i++) {
      var candidate = prefix + (prefix ? '/' : '') + parts[i];
      var allMatch = normalized.every(function(p) { return p.indexOf(candidate + '/') === 0 || p === candidate; });
      if (allMatch && candidate) prefix = candidate;
      else break;
    }
    return prefix;
  }

  function stripCommonPrefix(paths) {
    var prefix = findCommonPrefix(paths);
    if (!prefix) return paths;
    return paths.map(function(p) {
      var n = normalizePath(p);
      if (n.indexOf(prefix + '/') === 0) return n.slice(prefix.length + 1);
      return n;
    });
  }

  tt.Analyzer = {
    analyzeRepo: async function(repoDirHandle, fileMap) {
      analysis = {};
      pathMapping = {};
      var paths = Object.keys(fileMap);
      if (paths.length === 0) return analysis;

      var normalized = stripCommonPrefix(paths);

      for (var i = 0; i < paths.length; i++) {
        var logPath = paths[i];
        var candidate = normalizePath(normalized[i]);
        var repoFile = await resolvePath(repoDirHandle, candidate);

        pathMapping[logPath] = repoFile || candidate;

        if (repoFile) {
          var existing = await readRepoFile(repoDirHandle, repoFile);
          var logContent = fileMap[logPath].content || '';
          if (existing !== null) {
            var diff = computeDiff(existing, logContent);
            var hasChanges = diff.some(function(d) { return d.type !== 'same'; });
            analysis[logPath] = {
              resolvedPath: repoFile,
              repoStatus: hasChanges ? 'modified' : 'up-to-date',
              repoContent: existing,
              logContent: logContent,
              diff: diff,
              diffStats: countDiff(diff)
            };
          } else {
            analysis[logPath] = {
              resolvedPath: repoFile,
              repoStatus: 'new',
              repoContent: null,
              logContent: logContent,
              diff: null,
              diffStats: { added: logContent.split('\n').length, removed: 0, same: 0 }
            };
          }
        } else {
          analysis[logPath] = {
            resolvedPath: candidate,
            repoStatus: 'new',
            repoContent: null,
            logContent: fileMap[logPath].content || '',
            diff: null,
            diffStats: { added: (fileMap[logPath].content || '').split('\n').length, removed: 0, same: 0 }
          };
        }
      }

      var state = tt.State.get();
      state.fileAnalysis = analysis;
      state.pathMapping = pathMapping;
      return analysis;
    },

    getAnalysis: function(path) {
      return path ? analysis[path] : analysis;
    },

    getResolvedPath: function(logPath) {
      return pathMapping[logPath] || normalizePath(logPath);
    },

    renderDiff: function(diffLines) {
      if (!diffLines || diffLines.length === 0) {
        return '<div class="code-line"><span class="line-num">\u2014</span><span style="color:var(--text-muted);font-style:italic">No changes</span></div>';
      }
      return diffLines.map(function(d, i) {
        var cls = 'code-line';
        var prefix = '';
        if (d.type === 'added') { cls += ' added'; prefix = '<span class="add-prefix">+</span>'; }
        else if (d.type === 'removed') { cls += ' removed'; prefix = '<span class="rem-prefix">-</span>'; }
        else { prefix = '<span style="color:var(--text-dim);margin-right:4px"> </span>'; }
        return '<div class="' + cls + '"><span class="line-num">' + (i + 1) + '</span>' + prefix + '<span>' + tt.syntaxHighlight(tt.esc(d.line || '')) + '</span></div>';
      }).join('');
    },

    getPathAnalysisMarkup: function(path) {
      var a = analysis[path];
      if (!a) return '';

      var statusIcon = { 'new': '\uD83C\uDD95', 'modified': '\u270F\uFE0F', 'up-to-date': '\u2705', 'unresolved': '\u26A0\uFE0F' };
      var statusColor = { 'new': 'var(--accent)', 'modified': 'var(--accent2)', 'up-to-date': 'var(--green)', 'unresolved': 'var(--red)' };
      var status = a.repoStatus || 'unresolved';
      var resolvedPath = a.resolvedPath || path;
      var pathDiffers = resolvedPath !== normalizePath(path);

      var html = '<div class="analysis-bar">';
      html += '<span class="analysis-status" style="color:' + (statusColor[status] || 'var(--text-muted)') + '">' +
        (statusIcon[status] || '') + ' ' + status + '</span>';

      if (a.diffStats) {
        var parts = [];
        if (a.diffStats.added > 0) parts.push('<span style="color:var(--green)">+' + a.diffStats.added + '</span>');
        if (a.diffStats.removed > 0) parts.push('<span style="color:var(--red)">-' + a.diffStats.removed + '</span>');
        if (parts.length > 0) html += ' <span class="analysis-stats">' + parts.join(' ') + '</span>';
      }

      if (pathDiffers) {
        html += ' <span class="analysis-path-resolve" title="Resolved from original path">\uD83D\uDD17 ' + tt.esc(resolvedPath) + '</span>';
      }

      html += '</div>';

      if (a.diff && a.diff.length > 0) {
        var hasChanges = a.diff.some(function(d) { return d.type !== 'same'; });
        if (hasChanges) {
          html += '<div class="analysis-diff">';
          html += '<div class="analysis-diff-header">Diff vs repo</div>';
          html += '<div class="code-block" style="padding:8px 0;max-height:300px;overflow-y:auto">';
          html += tt.Analyzer.renderDiff(a.diff);
          html += '</div></div>';
        }
      }

      return html;
    }
  };

  function countDiff(diff) {
    if (!diff) return { added: 0, removed: 0, same: 0 };
    var counts = { added: 0, removed: 0, same: 0 };
    for (var i = 0; i < diff.length; i++) {
      if (diff[i].type === 'added') counts.added++;
      else if (diff[i].type === 'removed') counts.removed++;
      else counts.same++;
    }
    return counts;
  }

  async function resolvePath(dirHandle, candidate) {
    var parts = candidate.split('/');
    var handle = dirHandle;

    for (var i = 0; i < parts.length - 1; i++) {
      if (!parts[i] || parts[i] === '.' || parts[i] === '..') continue;
      try {
        handle = await handle.getDirectoryHandle(parts[i]);
      } catch (e) {
        return null;
      }
    }

    var fileName = parts[parts.length - 1];
    if (!fileName) return null;

    try {
      await handle.getFileHandle(fileName);
      return candidate;
    } catch (e) {
      return null;
    }
  }

  async function readRepoFile(dirHandle, filePath) {
    var parts = filePath.split('/');
    var fileName = parts.pop();
    var handle = dirHandle;

    try {
      for (var i = 0; i < parts.length; i++) {
        if (!parts[i] || parts[i] === '.' || parts[i] === '..') continue;
        handle = await handle.getDirectoryHandle(parts[i]);
      }
      var fileHandle = await handle.getFileHandle(fileName);
      var file = await fileHandle.getFile();
      return await file.text();
    } catch (e) {
      return null;
    }
  }

  function computeDiff(oldText, newText) {
    var oldLines = (oldText || '').split('\n');
    var newLines = (newText || '').split('\n');
    var m = oldLines.length;
    var n = newLines.length;

    var lcs = [];
    for (var i = 0; i <= m; i++) {
      lcs[i] = [];
      for (var j = 0; j <= n; j++) {
        if (i === 0 || j === 0) lcs[i][j] = 0;
        else if (oldLines[i - 1] === newLines[j - 1]) lcs[i][j] = lcs[i - 1][j - 1] + 1;
        else lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
    }

    var result = [];
    var ii = m, jj = n;
    var temp = [];
    while (ii > 0 || jj > 0) {
      if (ii > 0 && jj > 0 && oldLines[ii - 1] === newLines[jj - 1]) {
        temp.unshift({ type: 'same', line: oldLines[ii - 1] });
        ii--; jj--;
      } else if (jj > 0 && (ii === 0 || lcs[ii][jj - 1] >= lcs[ii - 1][jj])) {
        temp.unshift({ type: 'added', line: newLines[jj - 1] });
        jj--;
      } else if (ii > 0) {
        temp.unshift({ type: 'removed', line: oldLines[ii - 1] });
        ii--;
      } else {
        break;
      }
    }

    return temp;
  }

  tt.Analyzer.computeDiff = computeDiff;

})(window.TemboTool);
