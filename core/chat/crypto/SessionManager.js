const CryptoError = require('./CryptoErrors');

/**
 * Creates and validates local secure session metadata.
 */
class SessionManager {
  /**
   * Creates a session manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.random = options.random;
    this.sessions = new Map();
    this.logger = options.logger;
  }

  /**
   * Creates a local session framework record.
   * @param {object} input Session input.
   * @returns {object} Session metadata.
   */
  createSession(input = {}) {
    const now = Date.now();
    const session = {
      sessionId: this.random.sessionId(),
      localDeviceId: input.localDeviceId || null,
      remoteDeviceId: input.remoteDeviceId || null,
      sessionKey: this.random.key(),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + (input.ttlMs || this.config.sessionTtlMs)).toISOString(),
      state: 'active',
      metadata: input.metadata || {},
      futureRatcheting: { enabled: false },
      futureMultiDevice: { enabled: false }
    };
    this.sessions.set(session.sessionId, session);
    this.logger.info('Crypto session created', { sessionId: session.sessionId });
    return this.toPublic(session);
  }

  /**
   * Validates an active session.
   * @param {string} sessionId Session id.
   * @returns {object} Internal session.
   */
  validateSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== 'active') throw new CryptoError('crypto.session_invalid', 'Session is invalid.');
    if (Date.now() >= Date.parse(session.expiresAt)) {
      session.state = 'expired';
      throw new CryptoError('crypto.session_expired', 'Session expired.');
    }
    return session;
  }

  /**
   * Renews a session.
   * @param {string} sessionId Session id.
   * @param {number} ttlMs TTL.
   * @returns {object} Public session.
   */
  renewSession(sessionId, ttlMs = this.config.sessionTtlMs) {
    const session = this.validateSession(sessionId);
    session.expiresAt = new Date(Date.now() + ttlMs).toISOString();
    return this.toPublic(session);
  }

  /**
   * Destroys a session.
   * @param {string} sessionId Session id.
   */
  destroySession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) session.state = 'destroyed';
    this.sessions.delete(sessionId);
  }

  /**
   * Returns public session metadata without key material.
   * @param {object} session Internal session.
   * @returns {object} Public metadata.
   */
  toPublic(session) {
    return {
      sessionId: session.sessionId,
      localDeviceId: session.localDeviceId,
      remoteDeviceId: session.remoteDeviceId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      state: session.state,
      metadata: session.metadata,
      futureRatcheting: session.futureRatcheting,
      futureMultiDevice: session.futureMultiDevice
    };
  }
}

module.exports = SessionManager;
