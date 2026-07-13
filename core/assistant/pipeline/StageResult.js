'use strict';

const deepFreeze = require('../utils/ObjectFreeze');
const { serializeError } = require('../utils/ErrorHelpers');

class StageResult {
  constructor({ stageId = '', success = true, skipped = false, cancelled = false, output = null, diagnostics = [], durationMs = 0, error = null, metadata = {} } = {}) {
    this.stageId = String(stageId || '');
    this.success = success === true;
    this.skipped = skipped === true;
    this.cancelled = cancelled === true;
    this.output = output;
    this.diagnostics = Array.isArray(diagnostics) ? diagnostics.slice() : [];
    this.durationMs = Math.max(0, Number(durationMs) || 0);
    this.error = error ? serializeError(error) : null;
    this.metadata = { ...(metadata || {}) };
    deepFreeze(this);
  }

  static ok(stageId, output = null, data = {}) {
    return new StageResult({ ...data, stageId, success: true, output });
  }

  static skipped(stageId, reason = '') {
    return new StageResult({ stageId, success: true, skipped: true, diagnostics: reason ? [{ level: 'info', message: reason }] : [] });
  }

  static failed(stageId, error, data = {}) {
    return new StageResult({ ...data, stageId, success: false, error });
  }

  static cancelled(stageId, reason = '', data = {}) {
    return new StageResult({
      ...data,
      stageId,
      success: false,
      cancelled: true,
      diagnostics: reason ? [{ level: 'warn', message: reason }] : []
    });
  }

  toJSON() {
    return {
      stageId: this.stageId,
      success: this.success,
      skipped: this.skipped,
      cancelled: this.cancelled,
      output: this.output,
      diagnostics: this.diagnostics,
      durationMs: this.durationMs,
      error: this.error,
      metadata: this.metadata
    };
  }
}

module.exports = StageResult;
