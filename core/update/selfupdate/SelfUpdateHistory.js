const fs = require('fs');
const path = require('path');

class SelfUpdateHistory {
  constructor(options = {}) {
    this.historyPath = options.historyPath || '';
    this.limit = Math.max(1, Math.min(500, Number(options.limit) || 50));
    this.records = [];
  }

  ensure() {
    if (!this.historyPath) return;
    fs.mkdirSync(path.dirname(this.historyPath), { recursive: true });
    if (!fs.existsSync(this.historyPath)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.historyPath, 'utf8'));
      this.records = Array.isArray(parsed) ? parsed.slice(0, this.limit) : [];
    } catch (_) {
      this.records = [];
    }
  }

  add(record = {}) {
    this.records.unshift({ ...record, recordedAt: new Date().toISOString() });
    this.records = this.records.slice(0, this.limit);
    this.save();
  }

  list() {
    return this.records.slice();
  }

  save() {
    if (!this.historyPath) return;
    fs.mkdirSync(path.dirname(this.historyPath), { recursive: true });
    fs.writeFileSync(this.historyPath, JSON.stringify(this.records, null, 2));
  }
}

module.exports = SelfUpdateHistory;
