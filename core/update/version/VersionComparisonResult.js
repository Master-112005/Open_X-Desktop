const VERSION_COMPARISON_STATUS = Object.freeze({
  UP_TO_DATE: 'UP_TO_DATE',
  UPDATE_AVAILABLE: 'UPDATE_AVAILABLE',
  UNSUPPORTED_VERSION: 'UNSUPPORTED_VERSION',
  INVALID_VERSION: 'INVALID_VERSION',
  UNKNOWN: 'UNKNOWN'
});

class VersionComparisonResult {
  constructor(input = {}) {
    this.status = input.status || VERSION_COMPARISON_STATUS.UNKNOWN;
    this.currentVersion = input.currentVersion || null;
    this.latestVersion = input.latestVersion || null;
    this.minimumVersion = input.minimumVersion || null;
    this.comparison = Number.isFinite(input.comparison) ? input.comparison : null;
    this.checkedAt = input.checkedAt || new Date().toISOString();
    Object.freeze(this);
  }
}

module.exports = {
  VERSION_COMPARISON_STATUS,
  VersionComparisonResult
};
