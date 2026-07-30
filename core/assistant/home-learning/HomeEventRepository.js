'use strict';

const fs = require('fs');
const path = require('path');
const { appendSecureJsonLine, ensureDataRoot, readSecureJsonLines } = require('../Data');

class HomeEventRepository {
  constructor(options = {}) {
    this.config = options.config || {};
    const paths = ensureDataRoot(this.config);
    this.filePath = path.resolve(options.filePath || paths.homeLearningDatabasePath);
    this.keyPath = options.keyPath || paths.dataEncryptionKeyPath;
    this.duplicateWindowMs = Math.max(1000, Number(options.duplicateWindowMs || 5000));
    this.maxRecentRead = Math.max(50, Number(options.maxRecentRead || 1000));
  }

  append(event) {
    if (this.isDuplicate(event)) {
      return { stored: false, duplicate: true, event };
    }
    appendSecureJsonLine(this.filePath, event, {
      config: this.config,
      keyPath: this.keyPath
    });
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
    return readSecureJsonLines(this.filePath, {
      config: this.config,
      keyPath: this.keyPath,
      validate: value => Boolean(value) && typeof value === 'object'
    }).slice(-Math.max(1, limit));
  }
}

module.exports = HomeEventRepository;
