const fs = require('fs');
const path = require('path');

class CloudLogger {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.logPath = options.logPath || null;
  }

  info(message, data) {
    this.write('info', message, data);
  }

  warn(message, data) {
    this.write('warn', message, data);
  }

  error(message, data) {
    this.write('error', message, data);
  }

  write(level, message, data = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      scope: 'cloud',
      message,
      data: this.redact(data)
    };

    try {
      if (typeof this.logger[level] === 'function') {
        this.logger[level](`[CLOUD] ${message}`, entry.data);
      }
    } catch (_) {}

    if (!this.logPath) return;
    try {
      fs.mkdirSync(path.dirname(this.logPath), { recursive: true });
      fs.appendFileSync(this.logPath, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch (_) {
      // Cloud logging must never affect local assistant behavior.
    }
  }

  redact(value, depth = 0) {
    if (value === null || value === undefined) return value;
    if (depth > 4) return '[MaxDepth]';
    if (Array.isArray(value)) return value.slice(0, 20).map(item => this.redact(item, depth + 1));
    if (typeof value !== 'object') return value;

    const output = {};
    for (const [key, child] of Object.entries(value)) {
      if (/(token|secret|password|authorization|cookie|credential|api[_-]?key)/i.test(key)) {
        output[key] = '[REDACTED]';
      } else {
        output[key] = this.redact(child, depth + 1);
      }
    }
    return output;
  }
}

module.exports = CloudLogger;
