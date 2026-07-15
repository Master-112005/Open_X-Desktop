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
    this.logger.info?.(this._formatEventMessage(event, details), this._compactEventDetails(entry));
    return entry;
  }

  async recordError(event, error) {
    this.errors += 1;
    const serialized = serializeError(error);
    await this.database.appendDiagnostic({ event, error: serialized, level: 'error', timestamp: new Date().toISOString() });
    this.logger.error?.(`[Visual Memory] ${this._title(event)} failed.`, serialized);
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

  _formatEventMessage(event, details = {}) {
    const title = this._title(event);
    if (event === 'initialized') return '[Visual Memory] Runtime initialized and local photo memory is ready.';
    if (event === 'started') return '[Visual Memory] Runtime started for gallery and memory search.';
    if (event === 'gallery-refreshed') {
      const indexed = Number(details.indexed || 0);
      const failed = Number(details.failed || 0);
      return `[Visual Memory] Gallery indexing finished: ${indexed} photo${indexed === 1 ? '' : 's'} indexed, ${failed} failed.`;
    }
    if (event === 'candidate-pool-built') {
      return `[Visual Memory] Search candidate pool built with ${Number(details.total || 0)} possible memory result${Number(details.total || 0) === 1 ? '' : 's'}.`;
    }
    if (event === 'memory-intelligence-search') {
      return `[Visual Memory] Memory search completed with ${Number(details.total || 0)} result${Number(details.total || 0) === 1 ? '' : 's'}.`;
    }
    return `[Visual Memory] ${title}.`;
  }

  _compactEventDetails(entry = {}) {
    const details = entry.details && typeof entry.details === 'object' ? entry.details : {};
    return {
      event: entry.event,
      status: entry.status,
      state: details.lifecycle?.state || details.state || undefined,
      ready: details.lifecycle?.ready ?? details.ready,
      indexed: details.indexed,
      failed: details.failed,
      total: details.total,
      rejected: details.rejected,
      filters: details.filters,
      strategies: Array.isArray(details.strategies) ? details.strategies.join(',') : undefined,
      dataDir: details.dataDir,
      databasePath: details.databasePath,
      localOnly: details.localOnly,
      timestamp: entry.timestamp
    };
  }

  _title(event) {
    return String(event || 'event')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, letter => letter.toUpperCase());
  }
}

module.exports = DiagnosticsManager;
