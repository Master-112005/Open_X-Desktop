class VerificationPolicy {
  constructor(input = {}) {
    this.requireSignature = input.requireSignature === true;
    this.allowedArchitectures = Array.isArray(input.allowedArchitectures) ? input.allowedArchitectures : null;
    this.allowedChannels = Array.isArray(input.allowedChannels) ? input.allowedChannels : null;
    this.minimumSupportedVersion = input.minimumSupportedVersion || '';
    this.maximumSupportedVersion = input.maximumSupportedVersion || '';
    this.futureCertificatePins = Array.isArray(input.futureCertificatePins) ? input.futureCertificatePins.slice() : [];
    this.futurePublisherAllowlist = Array.isArray(input.futurePublisherAllowlist) ? input.futurePublisherAllowlist.slice() : [];
    this.futureRevocationEnabled = input.futureRevocationEnabled === true;
    Object.freeze(this);
  }
}

module.exports = VerificationPolicy;
