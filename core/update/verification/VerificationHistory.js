const fs = require('fs');
const path = require('path');

class VerificationHistory {
  constructor(options = {}) {
    this.historyPath = options.historyPath || '';
    this.maxItems = Math.max(1, Number(options.maxItems || 100));
  }

  ensure() {
    if (!this.historyPath) return;
    fs.mkdirSync(path.dirname(this.historyPath), { recursive: true });
    if (!fs.existsSync(this.historyPath)) fs.writeFileSync(this.historyPath, '[]');
  }

  list() {
    try {
      this.ensure();
      const parsed = JSON.parse(fs.readFileSync(this.historyPath, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  add(record) {
    if (!this.historyPath) return record;
    const next = [record, ...this.list()].slice(0, this.maxItems);
    this.ensure();
    fs.writeFileSync(this.historyPath, JSON.stringify(next, null, 2));
    return record;
  }
}

module.exports = VerificationHistory;
