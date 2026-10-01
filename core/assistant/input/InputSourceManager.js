'use strict';

const { UnsupportedSourceError } = require('./AcquisitionErrors');
const { sanitizeAcquisitionData, SourceNormalizer } = require('./InputSourceUtilities');
const { InputAdapterRegistry } = require('./InputBuilders');

class InputDiagnostics {
  constructor(options = {}) {
    this.maxRecords = Math.max(1, Number(options.maxDiagnostics) || 500);
    this.records = [];
  }

  record(level, message, data = {}) {
    const entry = {
      level: String(level || 'info'),
      message: String(message || ''),
      data: sanitizeAcquisitionData(data),
      timestamp: Date.now()
    };
    this.records.push(entry);
    if (this.records.length > this.maxRecords) {
      this.records.splice(0, this.records.length - this.maxRecords);
    }
    return entry;
  }

  list(limit = 25) {
    return this.records.slice(-Math.max(1, Number(limit) || 25));
  }

  clear() {
    const count = this.records.length;
    this.records = [];
    return count;
  }
}

class InputSourceManager {
  constructor(options = {}) {
    this.registry = options.registry || new InputAdapterRegistry();
    this.diagnostics = options.diagnostics || new InputDiagnostics(options);
    this.sourceNormalizer = options.sourceNormalizer || new SourceNormalizer(options);
  }

  register(adapter, options = {}) {
    this.registry.register(adapter, options);
    return this;
  }

  unregister(id) {
    return this.registry.unregister(id);
  }

  acquire(input, source = 'chat', options = {}) {
    const payload = this.toPayload(input, this.sourceNormalizer.normalize(source), options);
    const startedAt = Date.now();
    const adapter = this.registry.find(payload);
    if (!adapter) {
      throw new UnsupportedSourceError(`Unsupported input source: ${payload.source}`, { source: payload.source });
    }
    if (!adapter.initialized && typeof adapter.initialize === 'function') adapter.initialize();
    const rawUserInput = adapter.acquire(payload);
    const durationMs = Date.now() - startedAt;
    this.recordDiagnostic('info', 'Input acquired', {
      adapterId: adapter.id,
      source: rawUserInput.source,
      sourceType: rawUserInput.sourceType,
      durationMs,
      confidence: rawUserInput.confidence,
      attachmentCount: rawUserInput.attachments.length
    });
    return rawUserInput;
  }

  toPayload(input, source = 'chat', options = {}) {
    const safeOptions = sanitizeAcquisitionData(options || {});
    if (input && typeof input === 'object' && input.rawText !== undefined) {
      return {
        ...input,
        source: input.source || source,
        metadata: {
          ...(input.metadata || {}),
          ...(safeOptions.metadata || {})
        }
      };
    }
    return {
      input: String(input || ''),
      source: String(source || 'chat'),
      options: safeOptions,
      metadata: {
        ...(safeOptions?.metadata || {}),
        requestId: safeOptions?.requestId || null,
        conversationId: safeOptions?.conversationId || null,
        sessionId: safeOptions?.sessionId || null,
        phoneContext: safeOptions?.phoneContext || null
      },
      attachments: safeOptions?.attachments || [],
      device: safeOptions?.device || safeOptions?.phoneContext || null,
      platform: safeOptions?.platform || null,
      userContext: safeOptions?.userContext || {},
      flags: safeOptions?.flags || {},
      requestId: safeOptions?.requestId || null,
      conversationId: safeOptions?.conversationId || null,
      sessionId: safeOptions?.sessionId || null
    };
  }

  recordDiagnostic(level, message, data = {}) {
    return this.diagnostics.record(level, message, data);
  }

  getStatus() {
    return {
      adapterCount: this.registry.count(),
      adapters: this.registry.enumerate(),
      diagnostics: this.diagnostics.list(25)
    };
  }

  destroy() {
    for (const adapter of this.registry.adapters.values()) {
      adapter.destroy?.();
    }
    this.registry.clear();
    this.diagnostics.clear();
  }
}

module.exports = {
  InputDiagnostics,
  InputSourceManager
};