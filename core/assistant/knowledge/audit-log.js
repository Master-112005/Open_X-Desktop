'use strict';

const fs = require('fs');
const path = require('path');

const ALLOWED_KEYS = ['ts', 'action', 'domain', 'factId', 'sensitivity'];
const ACTIONS = new Set([
  'create',
  'update',
  'reinforce',
  'decay',
  'expired',
  'delete',
  'wipe-domain',
  'wipe-all',
  'pending-add',
  'pending-promote',
  'pending-reject'
]);

function sanitizeEntry(entry) {
  const output = {};
  ALLOWED_KEYS.forEach(key => {
    if (entry[key] !== undefined && entry[key] !== null) {
      output[key] = entry[key];
    }
  });
  return output;
}

class AuditLog {
  constructor(logPath) {
    this.logPath = logPath;
  }

  ensure() {
    fs.mkdirSync(path.dirname(this.logPath), { recursive: true, mode: 0o700 });
    try { fs.chmodSync(path.dirname(this.logPath), 0o700); } catch (_) {}
    if (!fs.existsSync(this.logPath)) {
      fs.writeFileSync(this.logPath, '', 'utf8');
    }
  }

  append(entry, at = new Date()) {
    const sanitized = sanitizeEntry(entry);
    sanitized.ts = entry.ts || at.toISOString();
    sanitized.action = String(entry.action || '').trim();
    if (!ACTIONS.has(String(sanitized.action || ''))) {
      throw new Error(`Unsupported audit action: ${String(entry.action)}`);
    }
    if (!sanitized.domain) {
      throw new Error('Audit entries require a domain');
    }
    fs.mkdirSync(path.dirname(this.logPath), { recursive: true, mode: 0o700 });
    try { fs.chmodSync(path.dirname(this.logPath), 0o700); } catch (_) {}
    const line = `${JSON.stringify(sanitized)}\n`;
    fs.appendFileSync(this.logPath, line, 'utf8');
  }

  read(limit = 100) {
    if (!fs.existsSync(this.logPath)) {
      return [];
    }
    const lines = fs.readFileSync(this.logPath, 'utf8').split(/\r?\n/).filter(Boolean);
    const start = Math.max(0, lines.length - limit);
    return lines.slice(start).map(line => {
      try {
        return JSON.parse(line);
      } catch (_) {
        return { ts: null, action: 'invalid_entry' };
      }
    });
  }

  readByAction(action) {
    return this.read().filter(entry => entry.action === action);
  }
}

module.exports = AuditLog;