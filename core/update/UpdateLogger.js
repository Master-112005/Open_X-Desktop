class UpdateLogger {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.enabled = options.enabled !== false;
    this.prefix = options.prefix || '[Update]';
  }

  info(message, data = {}) {
    this._write('info', message, data);
  }

  debug(message, data = {}) {
    this._write('debug', message, data);
  }

  warn(message, data = {}) {
    this._write('warn', message, data);
  }

  error(message, data = {}) {
    this._write('error', message, data);
  }

  _write(level, message, data) {
    if (!this.enabled) return;
    const target = typeof this.logger[level] === 'function' ? this.logger[level] : this.logger.info || console.log;
    target.call(this.logger, `${this.prefix} ${message}`, data);
  }
}

module.exports = UpdateLogger;
