window.TemboTool = window.TemboTool || {};

(function(tt) {

  tt.FileCards = {
    render: function(fileMap) {
      var container = document.getElementById('file-cards');
      if (!container) return;
      var paths = Object.keys(fileMap);

      if (paths.length === 0) {
        container.style.display = 'none';
        return;
      }

      container.classList.add('visible');

      var state = tt.State.get();
      var appliedCount = state.appliedPaths.length;
      var writtenCount = state.writtenPaths.length;
      var totalCount = paths.length;
      var repoConnected = tt.Repo && tt.Repo.isConnected();

      var analysis = state.fileAnalysis || {};
      var modifiedCount = 0;
      var newCount = 0;
      var deletedCount = 0;
      var upToDateCount = 0;
      var unresolvedCount = 0;
      for (var p in analysis) {
        var s = analysis[p].repoStatus;
        if (s === 'modified') modifiedCount++;
        else if (s === 'new') newCount++;
        else if (s === 'deleted') deletedCount++;
        else if (s === 'up-to-date') upToDateCount++;
        else unresolvedCount++;
      }

      container.innerHTML =
        '<div class="section-title">\uD83D\uDCC1 ' + paths.length + ' File Changes' +
        (repoConnected && modifiedCount + newCount + deletedCount > 0 ? ' <span style="color:var(--text-muted);font-weight:400;text-transform:none;letter-spacing:0;font-size:11px">' +
          (newCount > 0 ? newCount + ' new' : '') +
          (newCount > 0 && modifiedCount > 0 ? ', ' : '') +
          (modifiedCount > 0 ? modifiedCount + ' to update' : '') +
          ((newCount > 0 || modifiedCount > 0) && deletedCount > 0 ? ', ' : '') +
          (deletedCount > 0 ? deletedCount + ' to delete' : '') +
          (upToDateCount > 0 ? ', ' + upToDateCount + ' up-to-date' : '') +
          '</span>' : '') +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;align-items:center">' +
          '<button class="btn btn-sm ' + (repoConnected ? 'btn-green' : 'btn-secondary') + '" onclick="TemboTool.FileCards.applyAll()" title="Write all files to repo">' +
            '\u2705 Apply All' +
          '</button>' +
          (repoConnected ? '<button class="btn btn-sm btn-primary" onclick="TemboTool.FileCards.syncRepo()" title="Only write files that differ from repo">' +
            '\uD83D\uDD04 Sync Changes' +
          '</button>' : '') +
          '<button class="btn btn-sm btn-secondary" onclick="TemboTool.FileCards.undoAll()">\u21A9\uFE0F Undo All</button>' +
          '<button class="btn btn-sm btn-secondary" onclick="TemboTool.copyAllFiles()">\uD83D\uDCCB Copy All</button>' +
          '<button class="btn btn-sm btn-amber" onclick="TemboTool.downloadPackage()">\u2B07\uFE0F Download</button>' +
          (repoConnected ? '<button class="btn btn-sm btn-secondary" onclick="TemboTool.Repo.refreshAnalysis()">\uD83D\uDD04 Refresh Analysis</button>' : '') +
          '<button class="btn btn-sm btn-secondary" onclick="TemboTool.downloadScript()">\uD83D\uDCBB PS Script</button>' +
          '<span style="margin-left:auto;font-size:12px;color:var(--text-muted);padding:4px 0">' +
            appliedCount + '/' + totalCount + ' applied' +
            (writtenCount > 0 ? ' \u2022 ' + writtenCount + ' on disk' : '') +
          '</span>' +
        '</div>' +
        (repoConnected && upToDateCount === totalCount && totalCount > 0 ?
          '<div style="padding:10px 14px;background:rgba(72,187,120,0.1);border:1px solid rgba(72,187,120,0.3);border-radius:8px;margin-bottom:12px;font-size:13px;color:var(--green)">' +
            '\u2705 All files are up-to-date with the repo. No changes needed.' +
          '</div>' : '') +
        (repoConnected && unresolvedCount > 0 ?
          '<div style="padding:10px 14px;background:rgba(252,129,129,0.1);border:1px solid rgba(252,129,129,0.3);border-radius:8px;margin-bottom:12px;font-size:13px;color:var(--red)">' +
            '\u26A0\uFE0F ' + unresolvedCount + ' file(s) could not be resolved in the repo. Paths may need adjustment.' +
          '</div>' : '');

      paths.sort(function(a, b) {
        var aStatus = analysis[a] ? analysis[a].repoStatus : '';
        var bStatus = analysis[b] ? analysis[b].repoStatus : '';
        var order = { 'modified': 0, 'deleted': 0, 'new': 1, 'up-to-date': 2, 'unresolved': 3 };
        var aOrd = order[aStatus] !== undefined ? order[aStatus] : 99;
        var bOrd = order[bStatus] !== undefined ? order[bStatus] : 99;
        if (aOrd !== bOrd) return aOrd - bOrd;
        return a.localeCompare(b);
      });

      for (var i = 0; i < paths.length; i++) {
        var p = paths[i];
        var info = fileMap[p];
        var isNew = info.isNew;
        var safeId = 'fc_' + p.replace(/[^a-zA-Z0-9]/g, '_');

        var ext = p.split('.').pop().toLowerCase();
        var icon = tt.getFileIcon(ext);

        var written = state.writtenPaths.indexOf(p) !== -1;
        var marked = state.appliedPaths.indexOf(p) !== -1;
        var a = analysis[p];
        var repoStatus = a ? a.repoStatus : null;

        var statusLabel = repoStatus;
        if (!statusLabel) {
          if (info.isDeleted) statusLabel = 'deleted';
          else if (isNew) statusLabel = 'new';
          else statusLabel = 'modified';
        }
        if (written) statusLabel = 'written';
        else if (marked) statusLabel = 'marked';

        var statusClass = 'modified';
        if (statusLabel === 'written' || statusLabel === 'marked' || statusLabel === 'up-to-date') {
          statusClass = 'applied';
        } else if (info.isDeleted) {
          statusClass = 'deleted';
        } else if (isNew) {
          statusClass = 'new';
        }

        var hasUndo = written || tt.Repo.hasBackup(p);

        var card = document.createElement('div');
        card.className = 'file-card' + (written ? ' applied' : '');
        card.id = safeId;

        var analysisHtml = repoConnected && a ? tt.Analyzer.getPathAnalysisMarkup(p) : '';

        card.innerHTML =
          '<div class="file-card-header" onclick="TemboTool.FileCards.toggle(this)">' +
            '<span class="fc-icon">' + icon + '</span>' +
            '<span class="fc-path" title="' + tt.esc(p) + '">' + tt.esc(tt.shortPath(p, 60)) + '</span>' +
            '<span class="fc-status ' + statusClass + '">' + statusLabel + '</span>' +
            '<span class="fc-toggle">\u25BC</span>' +
          '</div>' +
          '<div class="fc-body">' +
            (analysisHtml ? '<div style="padding:12px 18px 0">' + analysisHtml + '</div>' : '') +
            '<div class="code-block" style="padding:12px 0">' +
              tt.renderCode(info.content || '', (written || info.isPatched) ? false : !isNew) +
            '</div>' +
            '<div class="fc-actions">' +
              '<button class="btn btn-sm ' + (written ? 'btn-secondary' : 'btn-green') + '" onclick="TemboTool.FileCards.applyFile(\'' + tt.esc(p) + '\')">' +
                (written ? '\u2705 Re-apply' : '\u2705 Apply to Repo') +
              '</button>' +
              (hasUndo ? '<button class="btn btn-sm btn-red" onclick="TemboTool.FileCards.undoFile(\'' + tt.esc(p) + '\')">\u21A9\uFE0F Undo</button>' : '') +
              '<button class="btn btn-sm btn-secondary" onclick="TemboTool.FileCards.markApplied(\'' + tt.esc(p) + '\')">\uD83D\uDCDD Mark</button>' +
              '<button class="btn btn-sm btn-secondary" onclick="TemboTool.copyFromFileMap(\'' + tt.esc(p) + '\')">\uD83D\uDCCB Copy</button>' +
              '<button class="btn btn-sm btn-secondary" onclick="TemboTool.downloadFromFileMap(\'' + tt.esc(p) + '\')">\u2B07\uFE0F Download</button>' +
              '<span style="margin-left:auto;font-size:11px;color:var(--text-muted)">' + info.operations.length + ' op(s)</span>' +
            '</div>' +
          '</div>';

        container.appendChild(card);
      }
    },

    toggle: function(header) {
      var body = header.nextElementSibling;
      var toggle = header.querySelector('.fc-toggle');
      if (body) body.classList.toggle('open');
      if (toggle) toggle.classList.toggle('open');
    },

    applyFile: async function(path) {
      if (!tt.Repo.isConnected()) {
        var ok = await tt.Repo.connect();
        if (!ok) return;
      }
      var state = tt.State.get();
      var info = state.fileMap[path];
      if (!info) return;

      var resolvedPath = (state.pathMapping && state.pathMapping[path]) || path;

      tt.showProgress(true);
      var success;
      if (info.isDeleted) {
        success = await tt.Repo.deleteFile(resolvedPath);
      } else {
        success = await tt.Repo.writeFile(resolvedPath, info.content || '');
      }
      tt.showProgress(false);

      if (success) {
        tt.State.markApplied(path);
        tt.State.markWritten(path);
        if (tt.Repo.isConnected()) {
          await tt.Analyzer.analyzeRepo(tt.Repo.getHandle(), state.fileMap);
        }
        tt.FileCards.render(state.fileMap);
        tt.toast((info.isDeleted ? 'Deleted: ' : 'Written to disk: ') + tt.shortPath(path, 40), 'success');
      }
    },

    undoFile: async function(path) {
      tt.showProgress(true);
      var result = await tt.Repo.restoreBackup(path);
      tt.showProgress(false);

      if (result === 'restored') {
        tt.State.unmarkWritten(path);
        tt.State.unmarkApplied(path);
        if (tt.Repo.isConnected()) {
          await tt.Analyzer.analyzeRepo(tt.Repo.getHandle(), tt.State.get().fileMap);
        }
        tt.FileCards.render(tt.State.get().fileMap);
        tt.toast('Restored original: ' + tt.shortPath(path, 40), 'success');
      } else if (result === 'deleted') {
        tt.State.unmarkWritten(path);
        tt.State.unmarkApplied(path);
        if (tt.Repo.isConnected()) {
          await tt.Analyzer.analyzeRepo(tt.Repo.getHandle(), tt.State.get().fileMap);
        }
        tt.FileCards.render(tt.State.get().fileMap);
        tt.toast('Deleted new file: ' + tt.shortPath(path, 40), 'success');
      } else {
        tt.State.unmarkApplied(path);
        tt.FileCards.render(tt.State.get().fileMap);
        tt.toast('Undone (no backup): ' + tt.shortPath(path, 40), 'success');
      }
    },

    markApplied: function(path) {
      tt.State.markApplied(path);
      tt.FileCards.render(tt.State.get().fileMap);
      tt.toast('Marked: ' + tt.shortPath(path, 40), 'success');
    },

    applyAll: async function() {
      var canWrite = tt.Repo.isConnected();
      if (!canWrite) {
        canWrite = await tt.Repo.connect();
      }
      var state = tt.State.get();
      var paths = Object.keys(state.fileMap);

      if (canWrite) {
        tt.showProgress(true);
        var successCount = 0;
        for (var i = 0; i < paths.length; i++) {
          var resolvedPath = (state.pathMapping && state.pathMapping[paths[i]]) || paths[i];
          var info = state.fileMap[paths[i]];
          var ok;
          if (info.isDeleted) {
            ok = await tt.Repo.deleteFile(resolvedPath);
          } else {
            ok = await tt.Repo.writeFile(resolvedPath, info.content || '');
          }
          if (ok) {
            tt.State.markApplied(paths[i]);
            tt.State.markWritten(paths[i]);
            successCount++;
          }
        }
        if (tt.Repo.isConnected()) {
          await tt.Analyzer.analyzeRepo(tt.Repo.getHandle(), state.fileMap);
        }
        tt.showProgress(false);
        tt.FileCards.render(state.fileMap);
        tt.toast('Applied ' + successCount + '/' + paths.length + ' files to disk', 'success');
      } else {
        for (var j = 0; j < paths.length; j++) {
          tt.State.markApplied(paths[j]);
        }
        tt.FileCards.render(state.fileMap);
        tt.downloadScript();
        tt.toast('Marked all. Use the PowerShell script to apply changes.', 'success');
      }
    },

    syncRepo: async function() {
      if (!tt.Repo.isConnected()) {
        var ok = await tt.Repo.connect();
        if (!ok) return;
      }
      var state = tt.State.get();
      var analysis = state.fileAnalysis || {};
      var paths = Object.keys(state.fileMap);

      var toWrite = paths.filter(function(p) {
        var a = analysis[p];
        return !a || a.repoStatus === 'modified' || a.repoStatus === 'new' || a.repoStatus === 'deleted';
      });

      if (toWrite.length === 0) {
        tt.toast('All files are already up-to-date with the repo', 'success');
        return;
      }

      tt.showProgress(true);
      var successCount = 0;
      for (var i = 0; i < toWrite.length; i++) {
        var p = toWrite[i];
        var resolvedPath = (state.pathMapping && state.pathMapping[p]) || p;
        var info = state.fileMap[p];
        var ok;
        if (info.isDeleted) {
          ok = await tt.Repo.deleteFile(resolvedPath);
        } else {
          ok = await tt.Repo.writeFile(resolvedPath, info.content || '');
        }
        if (ok) {
          tt.State.markApplied(p);
          tt.State.markWritten(p);
          successCount++;
        }
      }

      await tt.Analyzer.analyzeRepo(tt.Repo.getHandle(), state.fileMap);
      tt.showProgress(false);
      tt.FileCards.render(state.fileMap);
      tt.toast('Synced ' + successCount + '/' + toWrite.length + ' changed files to disk', 'success');
    },

    undoAll: async function() {
      var state = tt.State.get();
      var paths = state.writtenPaths.slice();

      if (paths.length > 0 && tt.Repo.isConnected()) {
        tt.showProgress(true);
        for (var i = 0; i < paths.length; i++) {
          await tt.Repo.restoreBackup(paths[i]);
          tt.State.unmarkWritten(paths[i]);
          tt.State.unmarkApplied(paths[i]);
        }
        await tt.Analyzer.analyzeRepo(tt.Repo.getHandle(), state.fileMap);
        tt.showProgress(false);
      } else {
        state.appliedPaths = [];
        state.writtenPaths = [];
      }

      tt.FileCards.render(state.fileMap);
      tt.toast('Undone all applied files', 'success');
    }
  };

})(window.TemboTool);
