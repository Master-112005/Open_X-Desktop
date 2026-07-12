const EventEmitter = require('events');
const { Logger } = require('../assistant/Data');
const COMMUNICATION_EVENTS = require('./CommunicationEvents');
const CommunicationProviderManager = require('./CommunicationProviderManager');
const { fail } = require('./CommunicationResult');
const { createOperationScheduler } = require('./OperationScheduler');
const {
  abortController,
  createTimeoutError,
  deadlineFromTimeout,
  linkAbortSignal,
  remainingTimeMs,
  throwIfAborted
} = require('../assistant/utils/Cancellation');

class CommunicationEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = options.config || options;
    this.logger = options.logger || new Logger(this.config?.logging || { level: 'info' });
    this.eventBus = options.eventBus || this.config?.eventBus || null;
    this.manager = options.manager || new CommunicationProviderManager({ logger: this.logger });
    this.started = false;
    this.defaultProvider = String(this.config?.communication?.defaultProvider || '').toLowerCase();
  }

  registerProvider(provider) {
    this.manager.register(provider);
    this.logger.debug('Communication provider registered', {
      provider: provider.id,
      providers: this.manager.list().map(entry => entry.id)
    });
    for (const event of Object.values(COMMUNICATION_EVENTS)) {
      provider.on?.(event, payload => this._publish(event, payload));
    }
    return provider;
  }

  async start() {
    this.started = true;
    // Providers are registered during startup, but browser-backed providers
    // must stay dormant until an actual communication operation needs them.
    return this.health();
  }

  async stop() {
    this.started = false;
    await this.manager.disconnectAll();
  }

  async connect(providerId = this.defaultProvider, options = {}) {
    return this.manager.get(providerId).connect(options);
  }

  async disconnect(providerId = this.defaultProvider) {
    return this.manager.get(providerId).disconnect();
  }

  async isConnected(providerId = this.defaultProvider) {
    return this.manager.get(providerId).isConnected();
  }

  async ensureReady(providerId = this.defaultProvider, options = {}) {
    this.logger.debug('Communication ensureReady requested', {
      provider: providerId,
      started: this.started
    });
    return this.manager.get(providerId).ensureReady?.(options);
  }

  async prepareMessage({ provider, recipient, message, contactId, timeoutMs, background, signal, operationContext } = {}) {
    const selectedProvider = provider || this.defaultProvider;
    const configuredTimeoutMs = Math.max(1000, Number(timeoutMs) || Number(this.config?.communication?.operationTimeoutMs) || 8000);
    const parentSignal = operationContext?.signal || signal || null;
    const controller = new AbortController();
    const unlinkParentAbort = linkAbortSignal(parentSignal, controller);
    const operation = {
      ...(operationContext || {}),
      owner: operationContext?.owner || 'communication-engine',
      operationId: operationContext?.operationId || `communication_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      startedAt: operationContext?.startedAt || Date.now(),
      deadlineAt: Number(operationContext?.deadlineAt) || deadlineFromTimeout(configuredTimeoutMs),
      signal: controller.signal,
      controller
    };
    operation.scheduler = createOperationScheduler(operation, { logger: this.logger });
    const operationTimeoutMs = remainingTimeMs(operation, configuredTimeoutMs);
    const readyOptions = {
      background: background === true,
      timeoutMs: operationTimeoutMs,
      signal: operation.signal,
      operationContext: operation
    };
    let deadlineTimer = null;
    let communicationProvider = null;
    let ownsProviderOperation = false;
    try {
      if (operation.deadlineAt) {
        deadlineTimer = setTimeout(() => {
          abortController(controller, createTimeoutError(
            'Communication operation timed out.',
            'operation_timeout',
            { provider: selectedProvider, operationId: operation.operationId }
          ));
        }, remainingTimeMs(operation, configuredTimeoutMs));
        deadlineTimer.unref?.();
      }
      throwIfAborted(operation.signal);
      this.logger.info('Communication prepareMessage started', {
        provider: selectedProvider,
        operationTimeoutMs,
        operationId: operation.operationId,
        deadlineAt: operation.deadlineAt || null
      });
      this.logger.debug('Communication prepareMessage route', {
        selectedCommunicationProvider: selectedProvider,
        hasRecipient: Boolean(recipient),
        hasMessage: Boolean(message),
        background: readyOptions.background,
        operationTimeoutMs,
        remainingMs: remainingTimeMs(operation, operationTimeoutMs)
      });
      communicationProvider = this.manager.get(selectedProvider);
      ownsProviderOperation = communicationProvider.beginOperation?.(operation, 'communication-prepare-message') === true;
      const page = await communicationProvider.ensureReady?.(readyOptions);
      throwIfAborted(operation.signal);
      this.logger.info('Communication prepareMessage ready', { provider: selectedProvider });
      const result = await communicationProvider.composeMessage(recipient, message, {
        contactId,
        readyOptions,
        page,
        timeoutMs: remainingTimeMs(operation, operationTimeoutMs),
        signal: operation.signal,
        operationContext: operation
      });
      throwIfAborted(operation.signal);
      this.logger.info('Communication prepareMessage completed', {
        provider: selectedProvider,
        success: Boolean(result?.success)
      });
      this.logger.debug('Communication prepareMessage result', {
        selectedCommunicationProvider: selectedProvider,
        success: Boolean(result?.success),
        code: result?.error?.code || result?.code || null
      });
      return result;
    } catch (error) {
      this._publish(COMMUNICATION_EVENTS.ERROR, {
        provider: selectedProvider,
        code: error.code || 'PREPARE_FAILED'
      });
      this.logger.debug('Communication prepareMessage result', {
        selectedCommunicationProvider: selectedProvider,
        success: false,
        code: error.code || 'PREPARE_FAILED'
      });
      return fail(error);
    } finally {
      if (ownsProviderOperation) {
        communicationProvider?.endOperation?.(operation, 'communication-prepare-message-complete');
      }
      if (deadlineTimer) clearTimeout(deadlineTimer);
      unlinkParentAbort();
    }
  }

  async sendPrepared(draftId, providerId = this.defaultProvider, options = {}) {
    try {
      throwIfAborted(options.signal || null);
      return await this.manager.get(providerId).send(draftId, options);
    } catch (error) {
      return fail(error);
    }
  }

  async cancelPrepared(draftId, providerId = this.defaultProvider, options = {}) {
    try {
      throwIfAborted(options.signal || null);
      return await this.manager.get(providerId).cancel(draftId);
    } catch (error) {
      return fail(error);
    }
  }

  async health(providerId = null) {
    if (providerId) {
      return this.manager.get(providerId).health();
    }
    const providers = {};
    for (const provider of this.manager.providers.values()) {
      providers[provider.id] = await provider.health();
    }
    return {
      started: this.started,
      defaultProvider: this.defaultProvider,
      providers
    };
  }

  listProviders() {
    return this.manager.list();
  }

  _publish(event, payload = {}) {
    const safePayload = {
      ...payload,
      timestamp: new Date().toISOString()
    };
    this.emit(event, safePayload);
    this.eventBus?.publish?.(event, safePayload);
  }
}

module.exports = CommunicationEngine;
