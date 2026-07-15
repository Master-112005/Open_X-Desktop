'use strict';

class SearchSessionManager {
  constructor({ limit = 50 } = {}) {
    this.limit = Math.max(0, Number(limit || 50));
    this.sessions = new Map();
  }

  start(context) {
    const id = `memsearch_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const startedAt = Date.now();
    const timeoutMs = Number(context.options.timeoutMs || 0);
    const session = {
      id,
      status: 'running',
      startedAt,
      timeoutMs,
      deadlineAt: timeoutMs > 0 ? startedAt + timeoutMs : null,
      contextSummary: this._summary(context),
      resultCount: 0,
      results: [],
      cancelled: false,
      pagesServed: 0
    };
    this.sessions.set(id, session);
    this._trim();
    return session;
  }

  complete(id, results = []) {
    const session = this.sessions.get(id);
    if (!session) return null;
    session.status = 'completed';
    session.completedAt = Date.now();
    session.durationMs = session.completedAt - session.startedAt;
    session.resultCount = results.length;
    session.results = results.slice();
    return session;
  }

  fail(id, error) {
    const session = this.sessions.get(id);
    if (!session) return null;
    session.status = 'failed';
    session.error = error?.message || String(error || '');
    session.completedAt = Date.now();
    session.durationMs = session.completedAt - session.startedAt;
    return session;
  }

  cancel(id, reason = 'cancelled') {
    const session = this.sessions.get(id);
    if (!session) return null;
    session.status = 'cancelled';
    session.cancelled = true;
    session.cancelReason = reason;
    session.completedAt = Date.now();
    session.durationMs = session.completedAt - session.startedAt;
    return session;
  }

  isCancelled(id) {
    return this.sessions.get(id)?.cancelled === true;
  }

  isTimedOut(id, now = Date.now()) {
    const session = this.sessions.get(id);
    return Boolean(session?.deadlineAt && now > session.deadlineAt);
  }

  paginate(id, results = [], options = {}) {
    const pageSize = Math.max(1, Number(options.pageSize || 25));
    const page = Math.max(1, Number(options.page || 1));
    const start = (page - 1) * pageSize;
    const items = results.slice(start, start + pageSize);
    const hasMore = start + pageSize < results.length;
    const continuationToken = hasMore ? Buffer.from(JSON.stringify({ sessionId: id, page: page + 1, pageSize })).toString('base64') : null;
    const session = this.sessions.get(id);
    if (session) session.pagesServed += 1;
    return { page, pageSize, items, hasMore, continuationToken };
  }

  continue(token) {
    try {
      const parsed = JSON.parse(Buffer.from(String(token || ''), 'base64').toString('utf8'));
      const session = this.sessions.get(parsed.sessionId);
      if (!session) return null;
      return this.paginate(parsed.sessionId, session.results || [], { page: parsed.page, pageSize: parsed.pageSize });
    } catch (_) {
      return null;
    }
  }

  get(id) {
    return this.sessions.get(id) || null;
  }

  recent(limit = 10) {
    return Array.from(this.sessions.values()).slice(-limit);
  }

  _summary(context) {
    return {
      visualIntent: context.visualQuery?.intent || null,
      candidateCount: context.getCandidates().length
    };
  }

  _trim() {
    if (!this.limit) return;
    const keys = Array.from(this.sessions.keys());
    for (const key of keys.slice(0, Math.max(0, keys.length - this.limit))) this.sessions.delete(key);
  }
}

module.exports = SearchSessionManager;
