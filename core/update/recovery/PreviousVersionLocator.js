class PreviousVersionLocator {
  constructor(options = {}) {
    this.backupManager = options.backupManager || null;
  }

  locate() {
    const backup = this.backupManager?.getLatestBackup?.() || null;
    if (!backup) return { found: false, backup: null, previousVersion: '' };
    return {
      found: true,
      backup,
      previousVersion: backup.currentVersion || ''
    };
  }
}

module.exports = PreviousVersionLocator;
