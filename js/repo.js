window.TemboTool = window.TemboTool || {};

(function(tt) {

  var repoDirHandle = null;
  var repoRootName = '';
  var backups = {};

  function isSupported() {
    return 'showDirectoryPicker' in window;
  }

  function getDirHandle() {
    return repoDirHandle;
  }

  tt.Repo = {
    isConnected: function() {
      return repoDirHandle !== null;
    },

    getRootName: function() {
      return repoRootName;
    },

    getHandle: function() {
      return repoDirHandle;
    },

    connect: async function() {
      if (!isSupported()) {
        tt.toast('Your browser does not support File System Access API. Use Chrome/Edge 86+ or download the PowerShell script instead.', 'error');
        return false;
      }
      try {
        repoDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        repoRootName = repoDirHandle.name;
        tt.State.setRepoInfo(repoRootName);
        var state = tt.State.get();
        tt.FileCards.render(state.fileMap);

        if (state.fileMap && Object.keys(state.fileMap).length > 0) {
          tt.showProgress(true);
          await tt.Analyzer.analyzeRepo(repoDirHandle, state.fileMap);
          tt.FileCards.render(state.fileMap);
          tt.showProgress(false);
        }

        tt.toast('Connected to repo: ' + repoRootName, 'success');
        updateRepoBadge();
        return true;
      } catch (e) {
        if (e.name !== 'AbortError') {
          tt.toast('Failed to connect to repo: ' + e.message, 'error');
        }
        return false;
      }
    },

    disconnect: function() {
      repoDirHandle = null;
      repoRootName = '';
      backups = {};
      tt.State.setRepoInfo('');
      var state = tt.State.get();
      state.fileAnalysis = {};
      state.pathMapping = {};
      tt.FileCards.render(state.fileMap);
      updateRepoBadge();
      tt.toast('Disconnected from repo', 'success');
    },

    refreshAnalysis: async function() {
      if (!repoDirHandle) return;
      var state = tt.State.get();
      if (!state.fileMap || Object.keys(state.fileMap).length === 0) return;
      tt.showProgress(true);
      await tt.Analyzer.analyzeRepo(repoDirHandle, state.fileMap);
      tt.FileCards.render(state.fileMap);
      tt.showProgress(false);
      tt.toast('Repo analysis refreshed', 'success');
    },

    fileExists: async function(filePath) {
      if (!repoDirHandle) return false;
      var parts = filePath.replace(/\\/g, '/').split('/');
      var fileName = parts.pop();
      var handle = repoDirHandle;
      try {
        for (var i = 0; i < parts.length; i++) {
          if (!parts[i] || parts[i] === '.' || parts[i] === '..') continue;
          handle = await handle.getDirectoryHandle(parts[i]);
        }
        await handle.getFileHandle(fileName);
        return true;
      } catch (e) {
        return false;
      }
    },

    readFile: async function(filePath) {
      if (!repoDirHandle) return null;
      var parts = filePath.replace(/\\/g, '/').split('/');
      var fileName = parts.pop();
      var handle = repoDirHandle;
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
    },

    writeFile: async function(filePath, content) {
      if (!repoDirHandle) {
        tt.toast('Connect to a repo first!', 'error');
        return false;
      }

      var pathParts = filePath.replace(/\\/g, '/').split('/');
      var fileName = pathParts.pop();
      var dirHandle = repoDirHandle;

      try {
        for (var i = 0; i < pathParts.length; i++) {
          if (pathParts[i] === '.' || pathParts[i] === '..') continue;
          dirHandle = await dirHandle.getDirectoryHandle(pathParts[i], { create: true });
        }

        try {
          var existingHandle = await dirHandle.getFileHandle(fileName);
          var existingFile = await existingHandle.getFile();
          var existingContent = await existingFile.text();
          var backupKey = filePath.replace(/\\/g, '/');
          backups[backupKey] = existingContent;
        } catch (e) {
          // File doesn't exist, no backup needed
        }

        var fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
        var writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();

        return true;
      } catch (e) {
        tt.toast('Failed to write ' + tt.shortPath(filePath) + ': ' + e.message, 'error');
        return false;
      }
    },

    deleteFile: async function(filePath) {
      if (!repoDirHandle) return false;

      var pathParts = filePath.replace(/\\/g, '/').split('/');
      var fileName = pathParts.pop();
      var dirHandle = repoDirHandle;

      try {
        for (var i = 0; i < pathParts.length; i++) {
          if (pathParts[i] === '.' || pathParts[i] === '..') continue;
          dirHandle = await dirHandle.getDirectoryHandle(pathParts[i]);
        }
        await dirHandle.removeEntry(fileName);
        return true;
      } catch (e) {
        return false;
      }
    },

    restoreBackup: async function(filePath) {
      var key = filePath.replace(/\\/g, '/');
      if (!backups[key]) {
        var deleted = await tt.Repo.deleteFile(filePath);
        return deleted ? 'deleted' : 'none';
      }
      var ok = await tt.Repo.writeFile(filePath, backups[key]);
      if (ok) {
        delete backups[key];
        return 'restored';
      }
      return false;
    },

    hasBackup: function(filePath) {
      var key = filePath.replace(/\\/g, '/');
      return key in backups;
    },

    generateScript: function() {
      var state = tt.State.get();
      var paths = Object.keys(state.fileMap);
      var lines = [];
      lines.push('# Tembo Tool - Apply Changes Script');
      lines.push('# Generated: ' + new Date().toISOString());
      lines.push('# Run this script from your repo root directory');
      lines.push('');
      lines.push('$ErrorActionPreference = "Stop"');
      lines.push('');

      for (var i = 0; i < paths.length; i++) {
        var p = paths[i];
        var info = state.fileMap[p];
        var content = info.content || '';
        lines.push('# File: ' + p);
        lines.push('$path = "' + p.replace(/"/g, '`"') + '"');
        lines.push('$dir = Split-Path -Parent $path');
        lines.push('if (!(Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }');

        lines.push('@\"');
        lines.push(content);
        lines.push('"@ | Out-File -FilePath $path -Encoding utf8 -Force');
        lines.push('Write-Host "  Applied: $path"');
        lines.push('');
      }

      lines.push('Write-Host ""');
      lines.push('Write-Host "All ' + paths.length + ' files applied successfully!" -ForegroundColor Green');

      return lines.join('\n');
    }
  };

  function updateRepoBadge() {
    var badge = document.getElementById('repo-badge');
    if (badge) {
      if (repoDirHandle) {
        badge.style.display = 'inline-flex';
        badge.textContent = '\uD83D\uDCC1 ' + repoRootName;
        badge.className = 'badge badge-repo';
      } else {
        badge.style.display = 'none';
      }
    }
    var btn = document.getElementById('btn-connect-repo');
    if (btn) {
      btn.textContent = repoDirHandle ? '\uD83D\uDDC2\uFE0F Disconnect' : '\uD83D\uDCE1 Connect Repo';
      btn.className = repoDirHandle ? 'btn btn-sm btn-green' : 'btn btn-sm btn-secondary';
    }
  }

  tt.updateRepoBadge = updateRepoBadge;

})(window.TemboTool);
