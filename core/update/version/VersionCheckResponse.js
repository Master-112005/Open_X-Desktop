const VALID_STATUSES = new Set([
  'UP_TO_DATE',
  'UPDATE_AVAILABLE',
  'UNSUPPORTED_VERSION',
  'INVALID_VERSION',
  'MANIFEST_UNAVAILABLE',
  'ERROR'
]);

const FORBIDDEN_FIELDS = new Set([
  'downloadUrl',
  'sha256',
  'checksum',
  'installerName',
  'installerType',
  'assets',
  'releaseAssets'
]);

function hasForbiddenField(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(value).some(key => FORBIDDEN_FIELDS.has(key));
}

class VersionCheckResponse {
  constructor(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Version response must be an object.');
    if (hasForbiddenField(input)) throw new TypeError('Version response must not include download or installer metadata.');
    const status = String(input.status || '').trim().toUpperCase();
    if (!VALID_STATUSES.has(status)) throw new TypeError('Version response status is invalid.');
    const checkedAt = String(input.checkedAt || '').trim();
    if (!checkedAt || !Number.isFinite(Date.parse(checkedAt))) throw new TypeError('Version response checkedAt is invalid.');
    this.status = status;
    this.currentVersion = input.currentVersion ? String(input.currentVersion).trim() : null;
    this.latestVersion = input.latestVersion ? String(input.latestVersion).trim() : null;
    this.minimumVersion = input.minimumVersion ? String(input.minimumVersion).trim() : null;
    this.releaseDate = input.releaseDate ? String(input.releaseDate).trim() : null;
    this.mandatory = input.mandatory === true;
    this.channel = String(input.channel || 'stable').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'stable';
    this.checkedAt = checkedAt;
    this.responseTimeMs = Number.isFinite(Number(input.responseTimeMs)) ? Math.max(0, Number(input.responseTimeMs)) : null;
    this.errorCode = input.errorCode ? String(input.errorCode).trim().slice(0, 80) : null;
    this.message = input.message ? String(input.message).trim().slice(0, 500) : null;
    Object.freeze(this);
  }

  toJSON() {
    return {
      status: this.status,
      currentVersion: this.currentVersion,
      latestVersion: this.latestVersion,
      minimumVersion: this.minimumVersion,
      releaseDate: this.releaseDate,
      mandatory: this.mandatory,
      channel: this.channel,
      checkedAt: this.checkedAt,
      responseTimeMs: this.responseTimeMs,
      errorCode: this.errorCode,
      message: this.message
    };
  }
}

module.exports = {
  VersionCheckResponse,
  VALID_VERSION_RESPONSE_STATUSES: VALID_STATUSES
};
