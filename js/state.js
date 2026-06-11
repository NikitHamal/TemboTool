window.TemboTool = window.TemboTool || {};

(function(tt) {

  var STORAGE_KEY = 'tembotool_sessions';

  var state = {
    events: [],
    filteredEvents: [],
    fileMap: {},
    activeIdx: -1,
    currentFilter: 'all',
    currentSearch: '',
    appliedPaths: [],
    writtenPaths: [],
    sessions: [],
    logFileName: '',
    repoRoot: '',
    fileAnalysis: {},
    pathMapping: {}
  };

  function loadSessions() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        state.sessions = JSON.parse(raw);
      }
    } catch (e) {
      state.sessions = [];
    }
  }

  function saveSessions() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.sessions));
    } catch (e) {
      // localStorage full or unavailable
    }
  }

  loadSessions();

  tt.State = {
    get: function() { return state; },

    reset: function() {
      state.events = [];
      state.filteredEvents = [];
      state.fileMap = {};
      state.activeIdx = -1;
      state.currentFilter = 'all';
      state.currentSearch = '';
      state.appliedPaths = [];
      state.writtenPaths = [];
      state.fileAnalysis = {};
      state.pathMapping = {};
      state.logFileName = '';
    },

    saveCurrentSession: function() {
      var s = state;
      if (Object.keys(s.fileMap).length === 0) return;
      var session = {
        id: Date.now(),
        fileName: s.logFileName || 'Unnamed session',
        timestamp: new Date().toISOString(),
        eventCount: s.events.length,
        fileCount: Object.keys(s.fileMap).length,
        errorCount: s.events.filter(function(e) { return e.type === 'error'; }).length,
        appliedCount: s.appliedPaths.length,
        writtenCount: s.writtenPaths.length
      };
      state.sessions.unshift(session);
      if (state.sessions.length > 50) state.sessions = state.sessions.slice(0, 50);
      saveSessions();
      return session;
    },

    getSessions: function() {
      return state.sessions;
    },

    clearSessions: function() {
      state.sessions = [];
      saveSessions();
    },

    markApplied: function(path) {
      if (state.appliedPaths.indexOf(path) === -1) {
        state.appliedPaths.push(path);
      }
    },

    unmarkApplied: function(path) {
      var idx = state.appliedPaths.indexOf(path);
      if (idx !== -1) {
        state.appliedPaths.splice(idx, 1);
      }
    },

    isApplied: function(path) {
      return state.appliedPaths.indexOf(path) !== -1;
    },

    getAppliedCount: function() {
      return state.appliedPaths.length;
    },

    setRepoInfo: function(name) {
      state.repoRoot = name;
    },

    getRepoInfo: function() {
      return state.repoRoot;
    },

    markWritten: function(path) {
      if (state.writtenPaths.indexOf(path) === -1) {
        state.writtenPaths.push(path);
      }
    },

    unmarkWritten: function(path) {
      var idx = state.writtenPaths.indexOf(path);
      if (idx !== -1) state.writtenPaths.splice(idx, 1);
    },

    isWritten: function(path) {
      return state.writtenPaths.indexOf(path) !== -1;
    },

    getWrittenCount: function() {
      return state.writtenPaths.length;
    }
  };

})(window.TemboTool);
