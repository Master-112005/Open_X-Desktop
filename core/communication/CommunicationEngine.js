const EventEmitter = require('events');
const { Logger } = require('../assistant/Data');
const COMMUNICATION_EVENTS = require('./CommunicationEvents');
const CommunicationProviderManager = require('./CommunicationProviderManager');
const WhatsAppProvider = require('./WhatsAppProvider');
const { fail } = require('./CommunicationResult');

class CommunicationEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = options.config || options;
    this.logger = options.logger || new Logger(this.config?.logging || { level: 'info' });
    this.eventBus = options.eventBus || this.config?.eventBus || null;
    this.manager = options.manager || new CommunicationProviderManager({ logger: this.logger });
    this.started = false;
    this.defaultProvider = String(this.config?.communication?.defaultProvider || 'whatsapp').toLowerCase();
    if (options.registerDefaultProviders !== false) {
      this.registerProvider(options.whatsAppProvider || new WhatsAppProvider({
        config: this.config,
        logger: this.logger,
        eventBus: this.eventBus,
        debug: this.config?.communication?.debug === true
      }));
    }
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
    if (this.config?.communication?.autoStart === false) {
      return this.health();
    }
    const providerId = this.defaultProvider;
    try {
      const provider = this.manager.get(providerId);
      if (provider.hasPersistentSession?.() !== true) {
        return this.health();
      }
      await provider.connect({ visible: false });
    } catch (error) {
      this._publish(COMMUNICATION_EVENTS.ERROR, {
        provider: providerId,
        code: error.code || 'START_FAILED'
      });
    }
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

  async prepareMessage({ provider, recipient, message, contactId, timeoutMs, background } = {}) {
    const selectedProvider = provider || this.defaultProvider;
    const readyOptions = {
      timeoutMs,
      background: background === true
    };
    try {
      this.logger.info('Communication prepareMessage started', {
        provider: selectedProvider,
        timeoutMs: readyOptions.timeoutMs || null
      });
      this.logger.debug('Communication prepareMessage route', {
        selectedCommunicationProvider: selectedProvider,
        hasRecipient: Boolean(recipient),
        hasMessage: Boolean(message),
        background: readyOptions.background,
        timeoutMs: readyOptions.timeoutMs || null
      });
      const communicationProvider = this.manager.get(selectedProvider);
      const page = await communicationProvider.ensureReady?.(readyOptions);
      this.logger.info('Communication prepareMessage ready', { provider: selectedProvider });
      const result = await communicationProvider.composeMessage(recipient, message, { contactId, readyOptions, page });
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
    }
  }

  async sendPrepared(draftId, providerId = this.defaultProvider) {
    try {
      return await this.manager.get(providerId).send(draftId);
    } catch (error) {
      return fail(error);
    }
  }

  async cancelPrepared(draftId, providerId = this.defaultProvider) {
    try {
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
