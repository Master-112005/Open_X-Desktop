/**
 * Desktop local connection session tracker.
 */
class SessionManager {
  /** Creates session manager. */
  constructor() {
    this.session = null;
  }

  /** @param {object} session Session state. @returns {object} Session. */
  setSession(session = {}) {
    this.session = {
      sessionId: session.sessionId || null,
      expiresAt: session.sessionExpiresAt || session.expiresAt || null,
      updatedAt: new Date().toISOString(),
      status: session.sessionId ? 'Active' : 'Pending'
    };
    return this.session;
  }

  /** Clears local session. */
  clear() {
    this.session = null;
  }

  /** @returns {object|null} Session. */
  getSession() {
    return this.session;
  }
}

module.exports = SessionManager;
