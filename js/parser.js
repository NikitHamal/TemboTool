window.TemboTool = window.TemboTool || {};

(function(tt) {

  tt.parseLog = function(text) {
    var sections = text.split('\n---\n');
    var events = [];
    var startTime = null;
    var endTime = null;
    var diffText = '';

    for (var i = 0; i < sections.length; i++) {
      var ev = parseEvent(sections[i].trim());
      if (!ev) continue;
      events.push(ev);
      if (!startTime) startTime = ev.ts;
      endTime = ev.ts;
      if (ev.type === 'success' && ev.command && ev.command.indexOf('git diff --cached') !== -1 && ev.stdout) {
        diffText = ev.stdout;
      }
    }

    var fileMap = {};
    if (diffText) {
      parseGitDiff(diffText, fileMap);
    } else {
      for (var j = 0; j < events.length; j++) {
        var e = events[j];
        if ((e.type === 'write' || e.type === 'edit') && e.path && e.content !== undefined) {
          var p = e.path;
          if (!fileMap[p]) {
            fileMap[p] = { path: p, content: e.content, timestamp: e.ts, operations: [], isNew: e.type === 'write' };
          } else {
            fileMap[p].content = e.content;
          }
          fileMap[p].operations.push({ type: e.type, ts: e.ts, content: e.content });
        }
      }
    }

    return { events: events, fileMap: fileMap, startTime: startTime, endTime: endTime };
  };

  function parseEvent(text) {
    if (!text) return null;
    var header = text.match(/\[(\d{4}-\d{2}-\d{2}T[\d:.Z]+)\]\s+\[(\w+)\]\s*([\s\S]*?)(?:\s+Details:|$)/);
    if (!header) return null;

    var ts = header[1];
    var type = header[2].toLowerCase();
    var label = header[3].trim().replace(/\n/g, ' ').slice(0, 120);

    var detailsMatch = text.match(/Details:\s*(\{[\s\S]*\})/);
    var details = {};
    if (detailsMatch) {
      try { details = JSON.parse(detailsMatch[1]); } catch (e) { /* invalid JSON */ }
    }

    var ev = { ts: ts, type: type, label: label, details: details, raw: text };
    if (details.path) ev.path = details.path;
    else if (details.command) ev.command = details.command;
    else if (details.cwd) ev.cwd = details.cwd;

    if (details.content !== undefined) ev.content = details.content;
    if (details.result) {
      ev.result = details.result;
      if (details.result.stdout) ev.stdout = details.result.stdout;
      if (details.result.stderr) ev.stderr = details.result.stderr;
      if (details.result.exitCode !== undefined) ev.exitCode = details.result.exitCode;
    }

    return ev;
  }

  function parseGitDiff(diffText, fileMap) {
    var fileDiffs = diffText.split(/^diff --git /m);
    for (var d = 0; d < fileDiffs.length; d++) {
      var part = fileDiffs[d].trim();
      if (!part) continue;
      var lines = part.split('\n');
      var headerMatch = lines[0].match(/^a\/(.*?) b\/(.*?)$/);
      if (!headerMatch) continue;
      var path = headerMatch[2];
      var isNew = false;
      var isDeleted = false;
      var hunks = [];
      var currentHunk = null;
      var lineIdx = 1;

      while (lineIdx < lines.length) {
        var l = lines[lineIdx];
        if (l.startsWith('@@')) break;
        if (l.startsWith('new file mode')) isNew = true;
        if (l.startsWith('deleted file mode')) isDeleted = true;
        lineIdx++;
      }

      for (var idx = lineIdx; idx < lines.length; idx++) {
        var l2 = lines[idx];
        if (l2.startsWith('@@')) {
          if (currentHunk) hunks.push(currentHunk);
          currentHunk = { header: l2, lines: [] };
        } else if (currentHunk) {
          currentHunk.lines.push(l2);
        }
      }
      if (currentHunk) hunks.push(currentHunk);

      var content = '';
      if (isNew) {
        var addedLines = [];
        for (var h = 0; h < hunks.length; h++) {
          for (var hl = 0; hl < hunks[h].lines.length; hl++) {
            if (hunks[h].lines[hl].startsWith('+')) {
              addedLines.push(hunks[h].lines[hl].slice(1));
            }
          }
        }
        content = addedLines.join('\n');
      } else {
        var diffLines = [];
        for (var h2 = 0; h2 < hunks.length; h2++) {
          diffLines.push(hunks[h2].header);
          for (var hl2 = 0; hl2 < hunks[h2].lines.length; hl2++) {
            diffLines.push(hunks[h2].lines[hl2]);
          }
        }
        content = diffLines.join('\n');
      }

      fileMap[path] = {
        path: path,
        content: content,
        isNew: isNew,
        isDeleted: isDeleted,
        operations: isNew ? [{ type: 'write' }] : [{ type: 'edit' }],
        hunks: hunks
      };
    }
  }

})(window.TemboTool);
