'use strict';

const { id, nowIso } = require('../utils/visual-memory-capability-utils');

function createSession(conversationId = '') {
  const timestamp = nowIso();
  return {
    id: id('vmsession'),
    conversationId,
    currentSearch: null,
    currentMemory: null,
    currentImage: null,
    currentViewer: null,
    currentSelection: [],
    currentFilters: {},
    undoHistory: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

class VisualMemorySessionManager {
  constructor({ configuration, diagnostics, events } = {}) {
    this.configuration = configuration;
    this.diagnostics = diagnostics;
    this.events = events;
    this.sessions = new Map();
  }

  getOrCreate(conversationId = '') {
    const key = conversationId || 'default';
    let session = this.sessions.get(key);
    if (!session || this._expired(session)) {
      session = createSession(key);
      this.sessions.set(key, session);
      this._prune();
      this.diagnostics?.record?.('session-created', { sessionId: session.id, conversationId: key });
    }
    return session;
  }

  update(conversationId, patch = {}) {
    const session = this.getOrCreate(conversationId);
    const next = {
      ...session,
      ...patch,
      undoHistory: patch.undoHistory || session.undoHistory,
      updatedAt: nowIso()
    };
    this.sessions.set(session.conversationId || 'default', next);
    this.events?.emit?.('assistant.capability.visualMemory.session.updated', { sessionId: next.id });
    return next;
  }

  current(conversationId = '') {
    return this.getOrCreate(conversationId);
  }

  restore(snapshot = {}) {
    if (!snapshot.conversationId) return null;
    this.sessions.set(snapshot.conversationId, { ...createSession(snapshot.conversationId), ...snapshot, updatedAt: nowIso() });
    return this.sessions.get(snapshot.conversationId);
  }

  _expired(session) {
    return Date.now() - Date.parse(session.updatedAt || session.createdAt || 0) > this.configuration.conversation.sessionTtlMs;
  }

  _prune() {
    while (this.sessions.size > this.configuration.conversation.maxSessions) {
      this.sessions.delete(this.sessions.keys().next().value);
    }
  }
}

module.exports = VisualMemorySessionManager;
