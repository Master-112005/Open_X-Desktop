const fs = require('fs');
const path = require('path');
const RecoveryHistory = require('./RecoveryHistory');

function readJson(filePath, fallback) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  if (!filePath) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(temp, filePath);
}

class RecoveryStorage {
  constructor(options = {}) {
    this.rootDir = options.rootDir || '';
    this.statePath = options.statePath || (this.rootDir ? path.join(this.rootDir, 'state.json') : '');
    this.history = options.history || new RecoveryHistory({
      historyPath: options.historyPath || (this.rootDir ? path.join(this.rootDir, 'history.json') : ''),
      limit: options.historyLimit || 50
    });
    this.rollbackHistory = options.rollbackHistory || new RecoveryHistory({
      historyPath: options.rollbackHistoryPath || (this.rootDir ? path.join(this.rootDir, 'rollback-history.json') : ''),
      limit: options.historyLimit || 50
    });
  }

  ensure() {
    if (this.rootDir) fs.mkdirSync(this.rootDir, { recursive: true });
    this.history.ensure();
    this.rollbackHistory.ensure();
  }

  savePendingSession(session) {
    writeJson(this.statePath, session?.snapshot?.() || session || null);
  }

  readPendingSession() {
    return readJson(this.statePath, null);
  }

  clearPendingSession() {
    if (this.statePath && fs.existsSync(this.statePath)) fs.unlinkSync(this.statePath);
  }

  addHistory(entry) {
    return this.history.add(entry);
  }

  listHistory() {
    return this.history.list();
  }

  addRollback(entry) {
    return this.rollbackHistory.add(entry);
  }

  listRollbacks() {
    return this.rollbackHistory.list();
  }
}

module.exports = RecoveryStorage;
