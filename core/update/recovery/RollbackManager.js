const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

class RollbackManager {
  constructor(options = {}) {
    this.logger = options.logger || console;
  }

  rollback(input = {}) {
    const startedAt = Date.now();
    const backup = input.backup;
    if (!backup || backup.trusted !== true) {
      throw Object.assign(new Error('Rollback requires a trusted recovery backup.'), { code: 'UNTRUSTED_BACKUP' });
    }
    if (!Array.isArray(backup.files) || backup.files.length === 0) {
      throw Object.assign(new Error('Recovery backup does not contain restorable files.'), { code: 'EMPTY_BACKUP' });
    }
    const restored = [];
    for (const file of backup.files) {
      this._verifyBackupFile(file);
    }
    for (const file of backup.files) {
      const destination = input.restoreRoot
        ? path.join(input.restoreRoot, file.relativePath)
        : file.sourcePath;
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(file.backupPath, destination);
      restored.push({
        relativePath: file.relativePath,
        destination,
        size: file.size
      });
    }
    const result = {
      success: true,
      backupId: backup.backupId,
      previousVersion: backup.currentVersion,
      targetVersion: backup.targetVersion,
      restored,
      durationMs: Date.now() - startedAt
    };
    this.logger.info?.('Recovery rollback completed', { backupId: backup.backupId, files: restored.length, durationMs: result.durationMs });
    return result;
  }

  _verifyBackupFile(file) {
    if (!file?.backupPath || !fs.existsSync(file.backupPath)) {
      throw Object.assign(new Error(`Missing recovery backup file: ${file?.relativePath || 'unknown'}`), { code: 'BACKUP_FILE_MISSING' });
    }
    const actual = sha256(file.backupPath);
    if (actual !== file.sha256) {
      throw Object.assign(new Error(`Recovery backup hash mismatch: ${file.relativePath}`), { code: 'BACKUP_HASH_MISMATCH' });
    }
  }
}

module.exports = RollbackManager;
