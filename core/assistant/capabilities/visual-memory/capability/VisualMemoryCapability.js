'use strict';

const VisualMemoryCapabilityConfiguration = require('../configuration/VisualMemoryCapabilityConfiguration');
const VisualMemoryCapabilityDiagnostics = require('../diagnostics/VisualMemoryCapabilityDiagnostics');
const { VisualMemoryCapabilityEventBus, VISUAL_MEMORY_CAPABILITY_EVENTS } = require('../events/VisualMemoryCapabilityEvents');
const VisualMemoryCapabilityLifecycle = require('../lifecycle/VisualMemoryCapabilityLifecycle');
const VisualMemoryCapabilityValidator = require('../validation/VisualMemoryCapabilityValidator');
const VisualMemorySessionManager = require('../sessions/VisualMemorySessionManager');
const VisualMemoryCapabilityRouter = require('../routing/VisualMemoryCapabilityRouter');
const VisualMemoryVerificationManager = require('../verification/VisualMemoryVerificationManager');
const VisualMemoryContextContributor = require('../context/VisualMemoryContextContributor');
const VisualMemoryStructuredResponse = require('../responses/VisualMemoryStructuredResponse');
const VisualMemoryActionRegistry = require('../actions/VisualMemoryActionRegistry');
const VisualMemoryCapabilityExecutor = require('../execution/VisualMemoryCapabilityExecutor');
const { VisualMemoryCapabilityContract } = require('../contracts/VisualMemoryCapabilityContracts');

class VisualMemoryCapability {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof VisualMemoryCapabilityConfiguration
      ? options.configuration
      : new VisualMemoryCapabilityConfiguration(options.configuration || options);
    this.visualMemoryApi = options.visualMemoryApi || options.api || null;
    this.events = options.events || new VisualMemoryCapabilityEventBus();
    this.diagnostics = options.diagnostics || new VisualMemoryCapabilityDiagnostics({ logger: options.logger || null });
    this.lifecycle = new VisualMemoryCapabilityLifecycle({ events: this.events, diagnostics: this.diagnostics });
    this.validator = options.validator || new VisualMemoryCapabilityValidator();
    this.sessions = new VisualMemorySessionManager({ configuration: this.configuration, diagnostics: this.diagnostics, events: this.events });
    this.router = new VisualMemoryCapabilityRouter();
    this.verification = new VisualMemoryVerificationManager({ configuration: this.configuration });
    this.context = new VisualMemoryContextContributor();
    this.responses = new VisualMemoryStructuredResponse();
    this.actions = new VisualMemoryActionRegistry();
    this.executor = new VisualMemoryCapabilityExecutor({
      visualMemoryApi: this.visualMemoryApi,
      verification: this.verification,
      diagnostics: this.diagnostics
    });
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return this;
    this.initialized = true;
    this.lifecycle.transition('ready');
    this.events.emit(VISUAL_MEMORY_CAPABILITY_EVENTS.INITIALIZED, this.getStatus());
    return this;
  }

  register(registry = null) {
    const metadata = this.getMetadata();
    if (registry?.registerCapability) registry.registerCapability(metadata);
    this.lifecycle.transition('registered');
    this.events.emit(VISUAL_MEMORY_CAPABILITY_EVENTS.REGISTERED, metadata);
    return metadata;
  }

  route(context) {
    if (!this.configuration.enabled) return null;
    const session = this.sessions.current(context?.conversationId || '');
    const request = this.router.route(context, session);
    if (request) {
      this.events.emit(VISUAL_MEMORY_CAPABILITY_EVENTS.ROUTED, { action: request.action, sessionId: session.id });
      this.diagnostics.record('routed', { action: request.action, sessionId: session.id });
    }
    return request;
  }

  async execute(request, context) {
    await this.initialize();
    const apiValidation = this.validator.validateApi(this.visualMemoryApi);
    if (!apiValidation.valid) return this._failed(request, context, apiValidation.reason);
    const validation = this.validator.validateRequest(request);
    if (!validation.valid) return this._failed(request, context, validation.reason);
    const session = this.sessions.getOrCreate(context?.conversationId || '');
    const result = await this.executor.execute(request, session, context);
    const nextSession = this.sessions.update(context?.conversationId || '', result.sessionPatch || {});
    const contextPatch = this.context.contribute(nextSession, result);
    this.context.writeToPipeline(context, contextPatch);
    const structuredResponse = this.responses.build(result, nextSession);
    const output = {
      capability: 'visual-memory',
      request,
      result,
      response: structuredResponse,
      session: nextSession,
      context: contextPatch,
      metadata: this.getMetadata()
    };
    this.events.emit(result.requiresVerification ? VISUAL_MEMORY_CAPABILITY_EVENTS.VERIFICATION_REQUIRED : VISUAL_MEMORY_CAPABILITY_EVENTS.EXECUTED, {
      action: request.action,
      sessionId: nextSession.id,
      success: result.success === true
    });
    this.diagnostics.record('executed', { action: request.action, success: result.success === true });
    return output;
  }

  async handlePipelineContext(context) {
    const request = this.route(context);
    if (!request) return null;
    return this.execute(request, context);
  }

  getMetadata() {
    return {
      ...VisualMemoryCapabilityContract,
      enabled: this.configuration.enabled,
      actions: this.actions.list(),
      permissions: { ...this.configuration.permissions }
    };
  }

  getStatus() {
    return {
      initialized: this.initialized,
      lifecycle: this.lifecycle.getState(),
      configuration: this.configuration.toJSON(),
      diagnostics: this.diagnostics.summary(),
      metadata: this.getMetadata()
    };
  }

  async shutdown() {
    this.initialized = false;
    this.lifecycle.transition('shutdown');
    this.events.emit(VISUAL_MEMORY_CAPABILITY_EVENTS.SHUTDOWN, this.getStatus());
    return this.getStatus();
  }

  _failed(request, context, reason) {
    const session = this.sessions.getOrCreate(context?.conversationId || '');
    const result = {
      capability: 'visual-memory',
      request,
      result: { type: 'error', action: request?.action || '', success: false, data: { reason } },
      response: {
        capability: 'visual-memory',
        type: 'error',
        success: false,
        resultCount: 0,
        topResults: [],
        confidence: 0,
        requiresVerification: false,
        session: { id: session.id, currentImage: session.currentImage, selectionCount: session.currentSelection?.length || 0 }
      },
      session,
      context: this.context.contribute(session),
      metadata: this.getMetadata()
    };
    this.diagnostics.record('failed', { reason });
    return result;
  }
}

module.exports = VisualMemoryCapability;
