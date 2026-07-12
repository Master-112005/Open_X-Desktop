class VersionCheckRequest {
  constructor(input = {}) {
    this.application = 'openx';
    this.currentVersion = String(input.currentVersion || '').trim();
    this.platform = String(input.platform || process.platform).trim();
    this.architecture = String(input.architecture || process.arch).trim();
    this.channel = String(input.channel || 'stable').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'stable';
    this.build = String(input.build || '').trim();
    this.applicationId = String(input.applicationId || 'openx').trim();
    this.protocolVersion = String(input.protocolVersion || '1').trim();
    this.capabilities = Object.freeze({
      versionOnly: true,
      download: false,
      install: false,
      notifications: false,
      ...(input.capabilities && typeof input.capabilities === 'object' && !Array.isArray(input.capabilities) ? input.capabilities : {})
    });
    this.timestamp = input.timestamp || new Date().toISOString();
    Object.freeze(this);
  }

  toJSON() {
    return {
      application: this.application,
      currentVersion: this.currentVersion,
      platform: this.platform,
      architecture: this.architecture,
      channel: this.channel,
      build: this.build,
      applicationId: this.applicationId,
      protocolVersion: this.protocolVersion,
      capabilities: { ...this.capabilities },
      timestamp: this.timestamp
    };
  }
}

module.exports = VersionCheckRequest;
