'use strict';

const { serializeError } = require('../../../../utils/ErrorHelpers');

class DiagnosticsManager {
  constructor({ database, logger } = {}) {
    this.database = database;
    this.logger = logger || console;
    this.startedAt = Date.now();
    this.status = 'created';
    this.warnings = 0;
    this.errors = 0;
  }

  async record(event, details = {}) {
    const entry = {
      event,
      details,
      status: this.status,
      timestamp: new Date().toISOString()
    };
    await this.database.appendDiagnostic(entry);
    this.logger.info?.('[VisualMemory]', entry);
    return entry;
  }

  async recordError(event, error) {
    this.errors += 1;
    const serialized = serializeError(error);
    await this.database.appendDiagnostic({ event, error: serialized, level: 'error', timestamp: new Date().toISOString() });
    this.logger.error?.('[VisualMemory]', serialized);
    return serialized;
  }

  setStatus(status) {
    this.status = status;
  }

  getHealth() {
    const data = this.database.snapshot();
    return {
      status: this.status,
      uptimeMs: Date.now() - this.startedAt,
      folders: Object.keys(data.folders || {}).length,
      photos: Object.keys(data.photos || {}).length,
      thumbnails: Object.keys(data.thumbnails || {}).length,
      diagnostics: (data.diagnostics || []).length,
      warnings: this.warnings,
      errors: this.errors,
      database: { open: this.database.opened, schemaVersion: data.schemaVersion }
    };
  }
}

module.exports = DiagnosticsManager;
