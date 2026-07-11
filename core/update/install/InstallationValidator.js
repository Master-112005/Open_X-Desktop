const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const VersionManager = require('../VersionManager');

function error(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function isPathInside(filePath, rootPath) {
  if (!filePath || !rootPath) return false;
  const resolvedFile = path.resolve(filePath);
  const resolvedRoot = path.resolve(rootPath);
  const relative = path.relative(resolvedRoot, resolvedFile);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

class InstallationValidator {
  constructor(options = {}) {
    this.configuration = options.configuration || {};
    this.versionManager = options.versionManager || new VersionManager(options);
    this.directories = options.directories || {};
  }

  validate(input = {}) {
    const verification = input.verificationResult;
    if (!verification || verification.success !== true || verification.status !== 'PASSED') {
      throw error('VERIFICATION_REQUIRED', 'Installer must pass verification before installation.');
    }
    const installerCandidate = String(input.installerPath || verification.data?.filePath || '').trim();
    if (!installerCandidate) throw error('INSTALLER_REQUIRED', 'Installer path is required.');
    const installerPath = path.resolve(installerCandidate);
    if (!fs.existsSync(installerPath)) throw error('INSTALLER_MISSING', 'Verified installer does not exist.');
    if (!fs.statSync(installerPath).isFile()) throw error('INSTALLER_NOT_FILE', 'Verified installer is not a file.');
    const extension = path.extname(installerPath).toLowerCase();
    if (!this.configuration.allowedExtensions.includes(extension)) {
      throw error('INSTALLER_EXTENSION_REJECTED', 'Installer extension is not allowed.');
    }
    const allowedRoot = this.directories.downloadsDir || this.directories.rootDir || '';
    if (allowedRoot && !isPathInside(installerPath, allowedRoot)) {
      throw error('INSTALLER_LOCATION_REJECTED', 'Installer is outside the trusted update downloads directory.');
    }
    const verifiedPath = path.resolve(String(verification.data?.filePath || ''));
    if (verifiedPath && verifiedPath !== installerPath) {
      throw error('INSTALLER_PATH_MISMATCH', 'Installer path does not match the verified file.');
    }
    const calculated = crypto.createHash('sha256').update(fs.readFileSync(installerPath)).digest('hex');
    const expected = String(verification.data?.hash?.expected || verification.data?.hash?.calculated || '').toLowerCase();
    if (!expected || calculated !== expected) {
      throw error('INSTALLER_HASH_MISMATCH', 'Verified installer hash no longer matches.');
    }
    const currentVersion = String(input.currentVersion || '').trim();
    const installerVersion = String(
      input.installerVersion ||
      verification.data?.manifest?.version ||
      verification.data?.manifest?.latestVersion ||
      verification.data?.metadata?.productVersion ||
      ''
    ).trim();
    if (!installerVersion || !this.versionManager.isValidVersion(installerVersion)) {
      throw error('INSTALLER_VERSION_INVALID', 'Installer version is missing or invalid.');
    }
    if (currentVersion && !this.versionManager.isNewer(installerVersion, currentVersion)) {
      throw error('INSTALLER_VERSION_NOT_NEWER', 'Installer version must be newer than the current version.');
    }
    return {
      installerPath,
      installerVersion,
      currentVersion,
      hash: calculated,
      workingDirectory: path.dirname(installerPath)
    };
  }
}

module.exports = InstallationValidator;
