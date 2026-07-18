const crypto = require('crypto');
const SecurityEvents = require('./SecurityEvents');

/**
 * Desktop local security session manager.
 */
class SessionManager {
  /**
   * Creates session manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.sessions = new Map();
    this.timeoutMs = Number(options.timeoutMs || 3600000);
  }

  /** @param {object} input Input. @returns {object} Session. */
  createLocalSession(input = {}) {
    const now = Date.now();
    const session = {
      sessionId: `local_sec_sess_${crypto.randomBytes(16).toString('hex')}`,
      accountId: input.accountId,
      deviceId: input.deviceId,
      status: 'Active',
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.timeoutMs).toISOString()
    };
    this.sessions.set(session.sessionId, session);
    this.eventBus?.emit?.(SecurityEvents.SESSION_CHANGED, { sessionId: session.sessionId, status: session.status });
    return session;
  }

  /** @param {string} sessionId SessionID. @returns {object} Validation result. */
  validateLocalSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return { valid: false, reason: 'not_found' };
    if (Date.now() >= Date.parse(session.expiresAt)) {
      session.status = 'Expired';
      return { valid: false, reason: 'expired', session };
    }
    return { valid: session.status === 'Active', session };
  }

  /** @param {string} sessionId SessionID. @returns {object|null} Session. */
  revokeLocalSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    session.status = 'Revoked';
    session.revokedAt = new Date().toISOString();
    this.eventBus?.emit?.(SecurityEvents.SESSION_CHANGED, { sessionId, status: session.status });
    return session;
  }
}

module.exports = SessionManager;
