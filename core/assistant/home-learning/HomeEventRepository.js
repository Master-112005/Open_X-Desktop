'use strict';

const fs = require('fs');
const path = require('path');
const { ensureDataRoot } = require('../Data');

function line(value) {
  return `${JSON.stringify(value).replace(/\r?\n/g, ' ')}\n`;
}

class HomeEventRepository {
  constructor(options = {}) {
    this.config = options.config || {};
    const paths = ensureDataRoot(this.config);
    this.filePath = path.resolve(options.filePath || paths.homeLearningDatabasePath);
    this.duplicateWindowMs = Math.max(1000, Number(options.duplicateWindowMs || 5000));
    this.maxRecentRead = Math.max(50, Number(options.maxRecentRead || 1000));
  }

  append(event) {
    if (this.isDuplicate(event)) {
      return { stored: false, duplicate: true, event };
    }
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    fs.appendFileSync(this.filePath, line(event), { mode: 0o600 });
    return { stored: true, duplicate: false, event };
  }

  isDuplicate(event) {
    const timestamp = Date.parse(event.timestamp);
    return this.readRecent(100).some(existing => {
      if (event.eventId && existing.eventId && event.eventId === existing.eventId) return true;
      if (existing.deviceId !== event.deviceId || existing.action !== event.action) return false;
      if (String(existing.state ?? '') !== String(event.state ?? '')) return false;
      return Math.abs(Date.parse(existing.timestamp) - timestamp) <= this.duplicateWindowMs;
    });
  }

  readRecent(limit = this.maxRecentRead) {
    if (!fs.existsSync(this.filePath)) return [];
    return fs.readFileSync(this.filePath, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-Math.max(1, limit))
      .map(item => {
        try { return JSON.parse(item); } catch (_) { return null; }
      })
      .filter(Boolean);
  }
}

module.exports = HomeEventRepository;
