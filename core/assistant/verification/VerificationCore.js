'use strict';

/*
 * Merged (file-count-reduction) module.
 * Previous standalone files concatenated verbatim (byte-for-byte), in dependency order:
 *   BaseVerifier.js
 *   ExecutionVerifier.js
 *   TransferVerifier.js
 *   ApplicationVerifier.js
 *   BrowserVerifier.js
 *   CloudVerifier.js
 *   ReminderVerifier.js
 *   WindowVerifier.js
 *   VerificationGraphBuilder.js
 *   VerificationResult.js
 *   VerificationDiagnostics.js
 *   VerificationContext.js
 *   VerificationConfiguration.js
 *   VerificationLogger.js
 *   VerificationErrors.js
 *   VerificationRegistry.js
 *   VerificationPipeline.js
 *   VerificationManager.js
 *   VerificationResponseManager.js
 *   VerificationResponseStage.js
 */

const { deepFreeze } = require('../utils');

const PipelineStage = require('../pipeline/PipelineStage');
const StageResult = require('../pipeline/StageResult');

const { createDefaultResponseManager } = require('../response');

const DEFAULT_VERIFIER_OPTIONS = Object.freeze({ enabled: true, priority: 100 });

const MAX_DIAGNOSTIC_ITEMS = 100;

function pushBounded(list, item) {
  list.push(item);
  if (list.length > MAX_DIAGNOSTIC_ITEMS) list.splice(0, list.length - MAX_DIAGNOSTIC_ITEMS);
}

class VerificationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = details.context || null;
    this.diagnostics = details.diagnostics || [];
    this.code = details.code || this.constructor.name;
    this.timestamp = Date.now();
    if (details.cause) this.cause = details.cause;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      diagnostics: this.diagnostics,
      timestamp: this.timestamp
    };
  }
}

class ConfigurationError extends VerificationError {}
class PipelineError extends VerificationError {}

class BaseVerifier {
  constructor(options = {}) {
    this.id = String(options.id || this.constructor.name);
    this.name = String(options.name || this.id);
    this.priority = Number.isFinite(options.priority) ? Number(options.priority) : 100;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.options = { ...(options || {}) };
    this.initialized = false;
  }

  initialize() { this.initialized = true; return true; }
  supports(context) { return this.enabled && !!context; }
  actions(context) {
    return [
      ...(context?.successfulActions || []),
      ...(context?.failedActions || []),
      ...(context?.skippedActions || [])
    ];
  }

  completedAndFailed(context) {
    return [
      ...(context?.successfulActions || []),
      ...(context?.failedActions || [])
    ];
  }

  addActionEvidence(context, type, action, successMessage, failureMessage, extra = {}) {
    const success = action?.success !== false && !context.failedActions.includes(action);
    return context.addEvidence(type, success ? successMessage : failureMessage, {
      taskId: action?.taskId || null,
      action: action?.action || null,
      route: action?.route || null,
      ...extra
    }, {
      status: success ? 'verified' : 'failed',
      confidence: success ? 0.86 : 0.28,
      source: this.id
    });
  }

  routeMatches(action, pattern) {
    return pattern.test(String(action?.route || action?.action || ''));
  }

  verify(context) { return context; }
  cleanup() { return true; }
  destroy() { this.initialized = false; return true; }
}

class ExecutionVerifier extends BaseVerifier {
  verify(context) {
    const result = context.automationResult || {};
    context.successfulActions = (result.completedActions || []).slice();
    context.failedActions = (result.failedActions || []).slice();
    context.skippedActions = (result.skippedActions || []).slice();
    context.executionStatus = result.executionStatus || 'unknown';
    const status = context.failedActions.length > 0
      ? 'failed'
      : context.executionStatus === 'COMPLETED'
        ? 'verified'
        : context.skippedActions.length > 0
          ? 'skipped'
          : 'unknown';
    context.addEvidence('execution-status', context.executionStatus, {
      completed: context.successfulActions.length,
      failed: context.failedActions.length,
      skipped: context.skippedActions.length,
      controllerResults: Array.isArray(result.controllerResults) ? result.controllerResults.length : 0
    }, {
      status,
      confidence: status === 'verified' ? 0.92 : status === 'failed' ? 0.18 : 0.55,
      source: this.id
    });
    for (const action of context.successfulActions) {
      context.addEvidence('action-completed', action.action || action.route || action.taskId, {
        taskId: action.taskId,
        route: action.route
      }, { status: 'verified', confidence: 0.88, source: this.id });
    }
    for (const action of context.failedActions) {
      context.addEvidence('action-failed', action.action || action.route || action.taskId, {
        taskId: action.taskId,
        route: action.route,
        error: action.error || null
      }, { status: 'failed', confidence: 0.2, source: this.id });
    }
    return context;
  }
}

class TransferVerifier extends BaseVerifier {
  verify(context) {
    for (const action of this.completedAndFailed(context)) {
      if (!/transfer|phone\.sendFile|cloud/i.test(String(action.route || action.action || ''))) continue;
      this.addActionEvidence(context, 'transfer', action, 'transfer action reported success', 'transfer action reported failure');
    }
    return context;
  }
}

class ApplicationVerifier extends BaseVerifier {
  verify(context) {
    for (const action of this.completedAndFailed(context)) {
      if (!/APPLICATION/.test(String(action.action || '')) && !/app\./i.test(String(action.route || ''))) continue;
      this.addActionEvidence(context, 'application', action, 'application action reported success', 'application action reported failure', {
        expectedRoute: action.route || null
      });
    }
    return context;
  }
}

class BrowserVerifier extends BaseVerifier {
  verify(context) {
    for (const action of this.completedAndFailed(context)) {
      if (!/browser\./i.test(String(action.route || ''))) continue;
      this.addActionEvidence(context, 'browser', action, 'browser action reported success', 'browser action reported failure');
    }
    return context;
  }
}

class CloudVerifier extends BaseVerifier {
  verify(context) {
    for (const action of this.completedAndFailed(context)) {
      if (!/cloud/i.test(String(action.route || action.action || ''))) continue;
      this.addActionEvidence(context, 'cloud', action, 'cloud action reported success', 'cloud action reported failure');
    }
    return context;
  }
}

class ReminderVerifier extends BaseVerifier {
  verify(context) {
    for (const action of this.completedAndFailed(context)) {
      if (!/reminder|alarm|timer/i.test(String(action.route || action.action || ''))) continue;
      this.addActionEvidence(context, 'schedule', action, 'schedule action reported success', 'schedule action reported failure');
    }
    return context;
  }
}

class WindowVerifier extends BaseVerifier {
  verify(context) {
    for (const action of this.completedAndFailed(context)) {
      if (!/WINDOW/.test(String(action.action || '')) && !/window\./i.test(String(action.route || ''))) continue;
      this.addActionEvidence(context, 'window', action, 'window action reported success', 'window action reported failure');
    }
    return context;
  }
}

class VerificationGraphBuilder extends BaseVerifier {
  verify(context) {
    const planned = context.automationResult?.executionGraph?.nodes || [];
    const nodes = planned.map(node => ({
      id: node.id,
      type: 'planned-action',
      status: node.status,
      action: node.action || null
    }));
    context.evidence.forEach((evidence, index) => {
      nodes.push({
        id: `evidence:${index + 1}`,
        type: 'evidence',
        value: evidence.value,
        status: evidence.status,
        confidence: evidence.confidence,
        evidenceType: evidence.type
      });
    });
    const evidenceEdges = context.evidence
      .map((evidence, index) => evidence.data?.taskId
        ? { from: evidence.data.taskId, to: `evidence:${index + 1}`, type: 'verified-by' }
        : null)
      .filter(Boolean);
    context.verificationGraph = deepFreeze({
      nodes,
      edges: (context.automationResult?.executionGraph?.edges || []).concat(evidenceEdges),
      timing: context.automationResult?.timing || {},
      diagnostics: {
        successfulActions: context.successfulActions.length,
        failedActions: context.failedActions.length,
        skippedActions: context.skippedActions.length,
        evidenceCount: context.evidence.length
      }
    });
    return context;
  }
}

class VerificationResult {
  constructor(input = {}) {
    this.verified = input.verified === true;
    this.confidence = Math.max(0, Math.min(1, Number(input.confidence) || 0));
    this.executionStatus = String(input.executionStatus || 'unknown');
    this.verificationGraph = input.verificationGraph || { nodes: [], edges: [] };
    this.successfulActions = Array.isArray(input.successfulActions) ? input.successfulActions.slice() : [];
    this.failedActions = Array.isArray(input.failedActions) ? input.failedActions.slice() : [];
    this.skippedActions = Array.isArray(input.skippedActions) ? input.skippedActions.slice() : [];
    this.evidence = Array.isArray(input.evidence) ? input.evidence.slice() : [];
    this.summary = { ...(input.summary || {}) };
    this.diagnostics = input.diagnostics || {};
    this.metadata = { ...(input.metadata || {}) };
    this.timing = { ...(input.timing || {}) };
    this.version = String(input.version || '11.0.0');
    this.futureExtensions = { ...(input.futureExtensions || {}) };
    deepFreeze(this);
  }
}

class VerificationDiagnostics {
  constructor() {
    this.startedAt = Date.now();
    this.finishedAt = null;
    this.verificationTime = {};
    this.verificationEvidence = [];
    this.warnings = [];
    this.errors = [];
    this.pipelineOrder = [];
    this.memoryUsage = this._memoryUsage();
  }

  time(id, durationMs) { this.verificationTime[String(id || '')] = Math.max(0, Number(durationMs) || 0); }
  evidence(item) { pushBounded(this.verificationEvidence, item); }
  warn(message, data = {}) { pushBounded(this.warnings, { message: String(message || ''), data, timestamp: Date.now() }); }
  error(error, data = {}) {
    pushBounded(this.errors, {
      name: error?.name || 'Error',
      message: String(error?.message || error || ''),
      stack: error?.stack || '',
      data,
      timestamp: Date.now()
    });
  }

  _memoryUsage() {
    return typeof process !== 'undefined' && typeof process.memoryUsage === 'function'
      ? process.memoryUsage()
      : null;
  }

  finish() {
    this.finishedAt = Date.now();
    this.memoryUsage = this._memoryUsage();
    return this;
  }

  toJSON() {
    this.finish();
    return {
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      durationMs: Math.max(0, (this.finishedAt || Date.now()) - this.startedAt),
      verificationTime: { ...this.verificationTime },
      verificationEvidence: this.verificationEvidence.slice(),
      warnings: this.warnings.slice(),
      errors: this.errors.slice(),
      pipelineOrder: this.pipelineOrder.slice(),
      memoryUsage: this.memoryUsage
    };
  }
}

class VerificationContext {
  constructor({ automationResult = null, configuration = null, metadata = {} } = {}) {
    this.automationResult = automationResult || null;
    this.configuration = configuration || null;
    this.metadata = { ...(metadata || {}) };
    this.executionStatus = automationResult?.executionStatus || 'unknown';
    this.successfulActions = [];
    this.failedActions = [];
    this.skippedActions = [];
    this.evidence = [];
    this.verificationGraph = { nodes: [], edges: [] };
    this.diagnostics = new VerificationDiagnostics();
    this.timing = { startedAt: Date.now(), finishedAt: null, durationMs: 0 };
    this.futureExtensions = {};
  }

  addEvidence(type, value, data = {}, options = {}) {
    const confidence = Math.max(0, Math.min(1, Number(options.confidence ?? 0.7)));
    const status = String(options.status || (confidence >= (this.configuration?.minVerifiedConfidence || 0.6) ? 'verified' : 'unknown'));
    const evidence = {
      type: String(type || 'evidence'),
      value: String(value || ''),
      status,
      confidence,
      source: String(options.source || ''),
      data: { ...(data || {}) }
    };
    this.evidence.push(evidence);
    if (this.configuration?.maxEvidence && this.evidence.length > this.configuration.maxEvidence) {
      this.evidence.splice(0, this.evidence.length - this.configuration.maxEvidence);
    }
    this.diagnostics.evidence(evidence);
    return evidence;
  }

  warn(message, data = {}) {
    this.diagnostics.warn(message, data);
  }

  error(error, data = {}) {
    this.diagnostics.error(error, data);
  }

  summary() {
    const verifiedEvidence = this.evidence.filter(item => item.status === 'verified').length;
    const failedEvidence = this.evidence.filter(item => item.status === 'failed').length;
    const confidence = this.evidence.length === 0
      ? 0
      : this.evidence.reduce((sum, item) => sum + item.confidence, 0) / this.evidence.length;
    const verified = this.failedActions.length === 0 &&
      failedEvidence === 0 &&
      (this.executionStatus === 'COMPLETED' || verifiedEvidence > 0);
    return {
      verified,
      confidence: Math.round(confidence * 1000) / 1000,
      evidenceCount: this.evidence.length,
      verifiedEvidence,
      failedEvidence,
      completed: this.successfulActions.length,
      failed: this.failedActions.length,
      skipped: this.skippedActions.length
    };
  }

  toVerificationResult() {
    this.timing.finishedAt = this.timing.finishedAt || Date.now();
    this.timing.durationMs = Math.max(0, this.timing.finishedAt - this.timing.startedAt);
    return new VerificationResult({
      verified: this.summary().verified,
      confidence: this.summary().confidence,
      executionStatus: this.executionStatus,
      verificationGraph: this.verificationGraph,
      successfulActions: this.successfulActions,
      failedActions: this.failedActions,
      skippedActions: this.skippedActions,
      evidence: this.evidence,
      summary: this.summary(),
      diagnostics: this.diagnostics.toJSON(),
      metadata: this.metadata,
      timing: this.timing,
      version: this.configuration?.version || '11.0.0',
      futureExtensions: this.futureExtensions
    });
  }
}

class VerificationConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || '11.0.0');
    this.strict = input.strict === true;
    this.maxEvidence = Number.isFinite(input.maxEvidence) ? Math.max(25, Number(input.maxEvidence)) : 500;
    this.minVerifiedConfidence = Number.isFinite(input.minVerifiedConfidence)
      ? Math.max(0, Math.min(1, Number(input.minVerifiedConfidence)))
      : 0.6;
    this.verifiers = { ...(input.verifiers || {}) };
  }

  getVerifierOptions(id, defaults = {}) {
    return {
      ...DEFAULT_VERIFIER_OPTIONS,
      ...(defaults || {}),
      ...(this.verifiers[String(id || '')] || {})
    };
  }

  toJSON() {
    return {
      enabled: this.enabled,
      version: this.version,
      strict: this.strict,
      maxEvidence: this.maxEvidence,
      minVerifiedConfidence: this.minVerifiedConfidence,
      verifiers: { ...this.verifiers }
    };
  }
}

class VerificationLogger {
  constructor(logger = null) {
    this.logger = logger || null;
  }

  _safe(data) {
    if (!data || typeof data !== 'object') return data;
    const copy = { ...data };
    for (const key of Object.keys(copy)) {
      if (/(password|token|secret|key|email|phone|messageText)/i.test(key)) copy[key] = '[REDACTED]';
    }
    return copy;
  }

  debug(message, data) { this.logger?.debug?.(`[Verification] ${message}`, this._safe(data)); }
  info(message, data) { this.logger?.info?.(`[Verification] ${message}`, this._safe(data)); }
  warn(message, data) { this.logger?.warn?.(`[Verification] ${message}`, this._safe(data)); }
  error(message, data) { this.logger?.error?.(`[Verification] ${message}`, this._safe(data)); }
}

class VerificationRegistry {
  constructor() {
    this.verifiers = new Map();
  }

  register(verifier, options = {}) {
    if (!verifier || typeof verifier.verify !== 'function') {
      throw new ConfigurationError('Verifier must provide verify(context).');
    }
    const id = String(options.id || verifier.id || verifier.constructor?.name || '').trim();
    if (!id) throw new ConfigurationError('Verifier id is required.');
    verifier.id = id;
    if (Number.isFinite(options.priority)) verifier.priority = Number(options.priority);
    if (options.enabled !== undefined) verifier.enabled = options.enabled !== false;
    this.verifiers.set(id, verifier);
    return this;
  }

  list({ includeDisabled = true } = {}) {
    return [...this.verifiers.values()]
      .filter(verifier => includeDisabled || verifier.enabled !== false)
      .sort((left, right) => (Number(left.priority) || 0) - (Number(right.priority) || 0) || String(left.id).localeCompare(String(right.id)));
  }

  get(id) {
    return this.verifiers.get(String(id || '').trim()) || null;
  }

  unregister(id) {
    return this.verifiers.delete(String(id || '').trim());
  }

  count({ includeDisabled = true } = {}) {
    return this.list({ includeDisabled }).length;
  }

  health() {
    return this.list().map(verifier => ({
      id: verifier.id,
      version: verifier.version,
      priority: verifier.priority,
      enabled: verifier.enabled !== false,
      initialized: verifier.initialized === true
    }));
  }

  clear() {
    const count = this.verifiers.size;
    this.verifiers.clear();
    return count;
  }
}

class VerificationPipeline {
  constructor(options = {}) {
    this.registry = options.registry || new VerificationRegistry();
    this.configuration = options.configuration instanceof VerificationConfiguration
      ? options.configuration
      : new VerificationConfiguration(options.configuration || {});
    this.logger = options.logger instanceof VerificationLogger ? options.logger : new VerificationLogger(options.logger || null);
  }

  async run(automationResult, options = {}) {
    const context = new VerificationContext({
      automationResult,
      configuration: this.configuration,
      metadata: options.metadata || {}
    });
    if (this.configuration.enabled === false) return context.toVerificationResult();

    for (const verifier of this.registry.list({ includeDisabled: false })) {
      const started = Date.now();
      context.diagnostics.pipelineOrder.push(verifier.id);
      try {
        if (!verifier.initialized && typeof verifier.initialize === 'function') await verifier.initialize();
        if (verifier.supports(context)) await verifier.verify(context);
      } catch (error) {
        const wrapped = new PipelineError(`Verifier failed: ${verifier.id}`, { cause: error, context: { verifierId: verifier.id } });
        context.diagnostics.error(wrapped);
        context.addEvidence('verifier-error', wrapped.message, { verifierId: verifier.id }, {
          status: 'failed',
          confidence: 0.1,
          source: verifier.id
        });
        this.logger.warn(wrapped.message, { verifierId: verifier.id });
        if (this.configuration.strict) throw wrapped;
      } finally {
        context.diagnostics.time(verifier.id, Date.now() - started);
        if (typeof verifier.cleanup === 'function') await verifier.cleanup(context);
      }
    }

    return context.toVerificationResult();
  }
}

class VerificationManager {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof VerificationConfiguration
      ? options.configuration
      : new VerificationConfiguration(options.configuration || options);
    this.registry = options.registry || new VerificationRegistry();
    this.pipeline = options.pipeline || null;
    this.logger = options.logger instanceof VerificationLogger ? options.logger : new VerificationLogger(options.logger || null);
    if (options.defaultVerifiers !== false) this._registerDefaults();
  }

  _registerDefaults() {
    [
      [ExecutionVerifier, 'verification.execution', 10],
      [ApplicationVerifier, 'verification.application', 20],
      [BrowserVerifier, 'verification.browser', 30],
      [WindowVerifier, 'verification.window', 40],
      [ReminderVerifier, 'verification.reminder', 50],
      [TransferVerifier, 'verification.transfer', 60],
      [CloudVerifier, 'verification.cloud', 70],
      [VerificationGraphBuilder, 'verification.graphBuilder', 80]
    ].forEach(([Ctor, id, priority]) => {
      const configured = this.configuration.getVerifierOptions(id, { priority });
      this.registry.register(new Ctor({ id, ...configured }), { id, priority: configured.priority, enabled: configured.enabled });
    });
  }

  registerVerifier(verifier, options = {}) {
    this.registry.register(verifier, options);
    return this;
  }

  async verify(automationResult, options = {}) {
    if (!this.pipeline) {
      this.pipeline = new VerificationPipeline({
        registry: this.registry,
        configuration: this.configuration,
        logger: this.logger
      });
    }
    return this.pipeline.run(automationResult, options);
  }

  getStatus() {
    return {
      enabled: this.configuration.enabled,
      version: this.configuration.version,
      pipelineReady: Boolean(this.pipeline),
      verifierCount: this.registry.count(),
      verifiers: this.registry.health()
    };
  }

  destroy() {
    for (const verifier of this.registry.list()) verifier.destroy?.();
    this.registry.clear();
    this.pipeline = null;
  }
}

function createDefaultVerificationManager(options = {}) {
  return new VerificationManager(options);
}

class VerificationResponseManager {
  constructor(options = {}) {
    this.verificationManager = options.verificationManager || createDefaultVerificationManager({
      configuration: options.verification || options.configuration?.verification || {}
    });
    this.responseManager = options.responseManager || createDefaultResponseManager({
      configuration: options.response || options.configuration?.response || {}
    });
  }

  async run(automationResult, options = {}) {
    const verificationResult = await this.verificationManager.verify(automationResult, {
      metadata: options.metadata || {}
    });
    const assistantResponse = await this.responseManager.generate(verificationResult, {
      metadata: {
        ...(options.metadata || {}),
        verificationSummary: verificationResult.summary || {}
      }
    });
    return { verificationResult, assistantResponse };
  }

  getStatus() {
    return {
      verification: this.verificationManager.getStatus(),
      response: this.responseManager.getStatus()
    };
  }

  destroy() {
    this.verificationManager.destroy?.();
    this.responseManager.destroy?.();
  }
}

function createDefaultVerificationResponseManager(options = {}) {
  return new VerificationResponseManager(options);
}

class VerificationResponseStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.verification.response',
      name: options.name || 'Assistant Verification and Response',
      order: Number.isFinite(options.order) ? options.order : -0.25,
      enabled: options.enabled !== false
    });
    this.manager = options.manager || createDefaultVerificationResponseManager({
      configuration: options.configuration || {}
    });
  }

  async execute(context) {
    if (!context.automationResult) {
      return StageResult.skipped(this.id, 'No AutomationResult available.');
    }
    const { verificationResult, assistantResponse } = await this.manager.run(context.automationResult, {
      metadata: {
        ...(context.metadata || {}),
        rawInput: context.rawInput,
        source: context.source
      }
    });
    context.verificationResult = verificationResult;
    context.assistantResponse = assistantResponse;
    context.set('assistant.verificationResult', verificationResult);
    context.set('assistant.assistantResponse', assistantResponse);
    return StageResult.ok(this.id, {
      executionStatus: verificationResult.executionStatus,
      verified: verificationResult.verified,
      confidence: verificationResult.confidence,
      evidenceCount: verificationResult.evidence.length,
      responseType: assistantResponse.responseType,
      version: assistantResponse.version
    });
  }

  async destroy() {
    this.manager.destroy?.();
    return super.destroy();
  }
}

const VERIFICATION_VERSION = '11.1.0';

module.exports = {
  VERIFICATION_VERSION,
  VerificationResponseManager,
  createDefaultVerificationResponseManager,
  VerificationResponseStage,
  VerificationPipeline,
  VerificationManager,
  createDefaultVerificationManager,
  VerificationContext,
  VerificationRegistry,
  BaseVerifier,
  ExecutionVerifier,
  ApplicationVerifier,
  BrowserVerifier,
  WindowVerifier,
  ReminderVerifier,
  TransferVerifier,
  CloudVerifier,
  VerificationGraphBuilder,
  VerificationResult,
  VerificationConfiguration,
  VerificationDiagnostics,
  VerificationLogger,
  VerificationError,
  ConfigurationError,
  PipelineError
};