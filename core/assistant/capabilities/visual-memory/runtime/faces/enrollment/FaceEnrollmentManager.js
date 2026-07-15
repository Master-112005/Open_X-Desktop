'use strict';

class FaceEnrollmentManager {
  constructor({ consent, grouping, identities, privacy, validator } = {}) {
    this.consent = consent;
    this.grouping = grouping;
    this.identities = identities;
    this.privacy = privacy;
    this.validator = validator;
  }

  ingestUnknownFace(input = {}) {
    const consentValidation = this.validator.validateConsent(this.consent.getConsent());
    if (!consentValidation.valid) return { skipped: true, reason: consentValidation.reason };
    if (!this.privacy.getPrivacyState().groupingEnabled) return { skipped: true, reason: 'grouping-disabled' };
    return this.grouping.groupUnknownFace(input);
  }

  getSuggestions() {
    const consentValidation = this.validator.validateConsent(this.consent.getConsent());
    if (!consentValidation.valid) return [];
    return this.grouping.getEnrollmentSuggestions();
  }

  enrollCluster({ clusterId, name, relationship = '', notes = '' } = {}) {
    const consentValidation = this.validator.validateConsent(this.consent.getConsent());
    if (!consentValidation.valid) throw new Error(consentValidation.reason);
    const cluster = this.grouping.state.unknownClusters[clusterId];
    if (!cluster) throw new Error('Unknown face cluster not found.');
    const result = this.identities.createIdentity({ name, relationship, clusterId, notes, confirmedBy: 'user-enrollment' });
    cluster.status = 'enrolled';
    cluster.identityId = result.identity.id;
    return result;
  }

  ignoreCluster(clusterId) {
    const cluster = this.grouping.state.unknownClusters[clusterId];
    if (cluster) cluster.ignoredAt = new Date().toISOString();
    return cluster || null;
  }

  neverAskAgain(clusterId) {
    return this.grouping.markNeverAskAgain(clusterId);
  }

  deleteCluster(clusterId) {
    return this.grouping.deleteCluster(clusterId);
  }
}

module.exports = FaceEnrollmentManager;
