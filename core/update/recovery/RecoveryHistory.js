const fs = require('fs');
const path = require('path');

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

class RecoveryHistory {
  constructor(options = {}) {
    this.historyPath = options.historyPath || '';
    this.limit = Number.isInteger(options.limit) ? options.limit : 50;
  }

  ensure() {
    if (!this.historyPath) return;
    fs.mkdirSync(path.dirname(this.historyPath), { recursive: true });
    if (!fs.existsSync(this.historyPath)) writeJson(this.historyPath, []);
  }

  add(entry = {}) {
    const items = this.list();
    const next = [{ ...entry, recordedAt: entry.recordedAt || new Date().toISOString() }, ...items]
      .slice(0, this.limit);
    writeJson(this.historyPath, next);
    return next;
  }

  list() {
    const data = readJson(this.historyPath, []);
    return Array.isArray(data) ? data.slice(0, this.limit) : [];
  }
}

module.exports = RecoveryHistory;
