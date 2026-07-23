'use strict';

class FacePrivacyManager {
  constructor({ state, configuration, consent, diagnostics } = {}) {
    this.state = state;
    this.configuration = configuration;
    this.consent = consent;
    this.diagnostics = diagnostics;
  }

  getPrivacyState() {
    return { ...this.configuration.privacy, consent: this.consent.getConsent() };
  }

  disableMatching() {
    this.configuration.privacy.matchingEnabled = false;
    return this.getPrivacyState();
  }

  disableGrouping() {
    this.configuration.privacy.groupingEnabled = false;
    return this.getPrivacyState();
  }

  disableEnrollment() {
    this.configuration.privacy.enrollmentEnabled = false;
    return this.getPrivacyState();
  }

  disableSuggestions() {
    this.configuration.privacy.suggestionsEnabled = false;
    return this.getPrivacyState();
  }

  deleteEverything() {
    this.state.identities = {};
    this.state.profiles = {};
    this.state.embeddings = {};
    this.state.unknownClusters = {};
    this.state.rejectedFaces = {};
    this.state.relationships = {};
    this.state.history = [];
    this.consent.revoke('delete-everything');
    this.diagnostics?.record?.('privacy-delete-everything');
    return { deleted: true, privacy: this.getPrivacyState() };
  }
}

module.exports = FacePrivacyManager;
