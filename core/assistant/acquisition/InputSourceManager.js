'use strict';

const InputAdapterRegistry = require('./InputAdapterRegistry');
const { UnsupportedSourceError } = require('./AcquisitionErrors');

class InputSourceManager {
  constructor(options = {}) {
    this.registry = options.registry || new InputAdapterRegistry();
    this.diagnostics = [];
  }

  register(adapter, options = {}) {
    this.registry.register(adapter, options);
    return this;
  }

  unregister(id) {
    return this.registry.unregister(id);
  }

  acquire(input, source = 'chat', options = {}) {
    const payload = this.toPayload(input, source, options);
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
    if (input && typeof input === 'object' && input.rawText !== undefined) {
      return {
        ...input,
        source: input.source || source,
        metadata: {
          ...(input.metadata || {}),
          ...(options.metadata || {})
        }
      };
    }
    return {
      input: String(input || ''),
      source: String(source || 'chat'),
      options: { ...(options || {}) },
      metadata: {
        ...(options?.metadata || {}),
        requestId: options?.requestId || null,
        conversationId: options?.conversationId || null,
        sessionId: options?.sessionId || null,
        phoneContext: options?.phoneContext || null
      },
      attachments: options?.attachments || [],
      device: options?.device || options?.phoneContext || null,
      platform: options?.platform || null,
      userContext: options?.userContext || {},
      flags: options?.flags || {},
      requestId: options?.requestId || null,
      conversationId: options?.conversationId || null,
      sessionId: options?.sessionId || null
    };
  }

  recordDiagnostic(level, message, data = {}) {
    const record = { level, message, data, timestamp: Date.now() };
    this.diagnostics.push(record);
    this.diagnostics = this.diagnostics.slice(-500);
    return record;
  }

  getStatus() {
    return {
      adapters: this.registry.enumerate(),
      diagnostics: this.diagnostics.slice(-25)
    };
  }

  destroy() {
    for (const adapter of this.registry.adapters.values()) {
      adapter.destroy?.();
    }
  }
}

module.exports = InputSourceManager;
