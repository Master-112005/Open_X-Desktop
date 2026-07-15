'use strict';

const { CONSENT_STATES } = require('../contracts/FaceMemoryContracts');

class ConsentManager {
  constructor({ state, events, diagnostics } = {}) {
    this.state = state;
    this.events = events;
    this.diagnostics = diagnostics;
  }

  getConsent() {
    return {
      status: this.state.consent?.status || CONSENT_STATES.UNKNOWN,
      enabled: this.state.consent?.status === CONSENT_STATES.ENABLED,
      acceptedAt: this.state.consent?.acceptedAt || null,
      disabledAt: this.state.consent?.disabledAt || null,
      explanationVersion: this.state.consent?.explanationVersion || '6.0.0'
    };
  }

  enable({ acceptedBy = 'user', explanationVersion = '6.0.0' } = {}) {
    this.state.consent = { status: CONSENT_STATES.ENABLED, acceptedAt: new Date().toISOString(), acceptedBy, explanationVersion };
    this.events?.emit?.('visual-memory.faces.consent.changed', this.getConsent());
    this.diagnostics?.record?.('consent-enabled', this.getConsent());
    return this.getConsent();
  }

  disable(reason = 'user-disabled') {
    this.state.consent = { ...(this.state.consent || {}), status: CONSENT_STATES.DISABLED, disabledAt: new Date().toISOString(), reason };
    this.events?.emit?.('visual-memory.faces.consent.changed', this.getConsent());
    this.diagnostics?.record?.('consent-disabled', { reason });
    return this.getConsent();
  }

  revoke(reason = 'user-revoked') {
    this.state.consent = { status: CONSENT_STATES.REVOKED, disabledAt: new Date().toISOString(), reason };
    this.events?.emit?.('visual-memory.faces.consent.changed', this.getConsent());
    this.diagnostics?.record?.('consent-revoked', { reason });
    return this.getConsent();
  }

  reviewPermissions() {
    return {
      consent: this.getConsent(),
      explanation: [
        'Face Memory groups AI Vision face embeddings locally.',
        'OpenX never creates names automatically.',
        'Only you can enable, disable, enroll, export, or delete face data.',
        'Cloud synchronization is disabled by default.'
      ]
    };
  }
}

module.exports = ConsentManager;
