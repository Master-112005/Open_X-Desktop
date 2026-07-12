const fs = require('fs');
const path = require('path');
const { VersionResult } = require('./UpdateResult');

const SEMVER_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;

function parseVersion(value) {
  const source = String(value || '').trim();
  const match = source.match(SEMVER_PATTERN);
  if (!match) {
    const error = new Error(`Invalid semantic version: ${source || '<empty>'}`);
    error.code = 'INVALID_VERSION';
    throw error;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] || '',
    build: match[5] || '',
    normalized: `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}${match[4] ? `-${match[4]}` : ''}${match[5] ? `+${match[5]}` : ''}`
  };
}

class VersionManager {
  constructor(options = {}) {
    this.packagePath = options.packagePath || path.resolve(__dirname, '..', '..', 'package.json');
    this.metadata = options.metadata || null;
    this.logger = options.logger || null;
    this.cachedVersion = null;
  }

  getCurrentVersion(options = {}) {
    if (this.cachedVersion && options.refresh !== true) {
      return new VersionResult({ data: { version: this.cachedVersion, cached: true } });
    }
    try {
      const version = this.normalize(this._readVersionSource());
      this.cachedVersion = version;
      this.logger?.info?.('Version read', { version });
      return new VersionResult({ data: { version, cached: false } });
    } catch (error) {
      this.logger?.error?.('Version read failed', { error: error.message });
      return new VersionResult({ success: false, error, data: { version: null } });
    }
  }

  _readVersionSource() {
    if (this.metadata?.version) return this.metadata.version;
    const packageJson = JSON.parse(fs.readFileSync(this.packagePath, 'utf8'));
    return packageJson.version;
  }

  normalize(version) {
    return parseVersion(version).normalized;
  }

  isValidVersion(version) {
    try {
      parseVersion(version);
      return true;
    } catch (_) {
      return false;
    }
  }

  compareVersions(left, right) {
    const a = parseVersion(left);
    const b = parseVersion(right);
    for (const key of ['major', 'minor', 'patch']) {
      if (a[key] > b[key]) return 1;
      if (a[key] < b[key]) return -1;
    }
    if (a.prerelease && !b.prerelease) return -1;
    if (!a.prerelease && b.prerelease) return 1;
    if (a.prerelease !== b.prerelease) return a.prerelease.localeCompare(b.prerelease);
    return 0;
  }

  compareVersionResult(left, right) {
    try {
      return VersionResult.ok('update.version.compare', {
        left: this.normalize(left),
        right: this.normalize(right),
        comparison: this.compareVersions(left, right)
      });
    } catch (error) {
      return new VersionResult({ success: false, error, data: { left: String(left || ''), right: String(right || '') } });
    }
  }

  isNewer(candidate, current) {
    return this.compareVersions(candidate, current) > 0;
  }

  isOlder(candidate, current) {
    return this.compareVersions(candidate, current) < 0;
  }

  isEqual(left, right) {
    return this.compareVersions(left, right) === 0;
  }
}

module.exports = VersionManager;
