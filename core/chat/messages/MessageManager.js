const { CryptoManager } = require('../crypto');
const MessageConfiguration = require('./MessageConfiguration');
const MessageEvents = require('./MessageEvents');
const MessageLogger = require('./MessageLogger');
const MessageClient = require('./MessageClient');
const MessageValidation = require('./MessageValidation');
const CompressionManager = require('./CompressionManager');
const MessageStorage = require('./MessageStorage');
const MessagePipeline = require('./MessagePipeline');
const MessageRouter = require('./MessageRouter');
const AcknowledgementManager = require('./AcknowledgementManager');
const RetryManager = require('./RetryManager');
const TypingManager = require('./TypingManager');

/**
 * Desktop Phase 8 encrypted one-to-one messaging facade.
 */
class MessageManager {
  /**
   * Creates message manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.config = options.config instanceof MessageConfiguration ? options.config : new MessageConfiguration(options.config || {});
    this.eventBus = options.eventBus;
    this.logger = options.logger || new MessageLogger();
    this.crypto = options.crypto || new CryptoManager({ config: options.cryptoConfig || {} });
    this.client = options.client || new MessageClient({ config: this.config, fetchImpl: options.fetchImpl });
    this.validation = options.validation || new MessageValidation({ config: this.config });
    this.compression = options.compression || new CompressionManager({ config: this.config });
    this.storage = options.storage || new MessageStorage({ config: this.config });
    this.pipeline = options.pipeline || new MessagePipeline({
      config: this.config,
      crypto: this.crypto,
      validation: this.validation,
      compression: this.compression,
      sessionResolver: options.sessionResolver
    });
    this.router = options.router || new MessageRouter({
      client: this.client,
      connectionManager: options.connectionManager,
      storage: this.storage,
      eventBus: this.eventBus
    });
    this.acknowledgement = options.acknowledgement || new AcknowledgementManager({
      client: this.client,
      mailboxManager: options.mailboxManager,
      storage: this.storage,
      eventBus: this.eventBus,
      events: MessageEvents
    });
    this.retry = options.retry || new RetryManager({
      config: this.config,
      client: this.client,
      router: this.router,
      storage: this.storage,
      eventBus: this.eventBus,
      events: MessageEvents
    });
    this.typing = options.typing || new TypingManager({
      client: this.client,
      connectionManager: options.connectionManager,
      eventBus: this.eventBus,
      events: MessageEvents
    });
    this.synchronizationManager = options.synchronizationManager;
  }

  /**
   * Initializes crypto and local storage.
   */
  async initialize() {
    await this.crypto.initialize?.();
    await this.storage.initialize();
  }

  /**
   * Sends a text message.
   * @param {object} input Text message input.
   * @returns {Promise<object>} Send result.
   */
  sendText(input = {}) {
    return this.send({ ...input, messageType: 'Text' });
  }

  /**
   * Sends an emoji message.
   * @param {object} input Emoji message input.
   * @returns {Promise<object>} Send result.
   */
  sendEmoji(input = {}) {
    return this.send({ ...input, messageType: 'Emoji' });
  }

  /**
   * Sends an encrypted message.
   * @param {object} input Message input.
   * @returns {Promise<object>} Send result.
   */
  async send(input = {}) {
    await this.initialize();
    const message = await this.pipeline.createEncryptedMessage(input);
    await this.storage.upsertMessage(message);
    this.eventBus?.emit?.(MessageEvents.MESSAGE_ENCRYPTED, { messageId: message.messageId });
    const delivery = await this.router.route(message);
    this.eventBus?.emit?.(MessageEvents.MESSAGE_SENT, { messageId: message.messageId, delivery });
    return { message, delivery };
  }

  /**
   * Processes one incoming encrypted envelope.
   * @param {object} input Envelope input.
   * @returns {Promise<object>} Receive result.
   */
  async receiveEnvelope(input = {}) {
    await this.initialize();
    const result = await this.pipeline.receiveEncryptedEnvelope(input);
    await this.storage.upsertMessage(result.message);
    this.eventBus?.emit?.(MessageEvents.MESSAGE_RECEIVED, { messageId: result.message.messageId });
    return result;
  }

  /**
   * Synchronizes mailbox envelopes and stores received messages.
   * @param {object} input Sync input.
   * @returns {Promise<object>} Sync result.
   */
  async syncMailbox(input = {}) {
    const synchronizationManager = input.synchronizationManager || this.synchronizationManager;
    if (synchronizationManager?.synchronize) return synchronizationManager.synchronize(input);
    const sync = await input.mailboxManager?.sync?.(input) || await this.acknowledgement.mailboxManager.sync(input);
    const received = [];
    for (const envelope of sync.envelopes || []) {
      received.push(await this.receiveEnvelope({ ...input, envelope }));
    }
    if (sync.envelopes?.length) {
      await this.acknowledgement.acknowledgeMailbox({
        deviceId: input.deviceId,
        highestContiguousSequence: Math.max(...sync.envelopes.map(envelope => envelope.mailboxSequence))
      });
    }
    return { sync, received };
  }

  /**
   * Sends message ACK.
   * @param {object} input ACK input.
   * @returns {Promise<object>} ACK result.
   */
  acknowledge(input = {}) {
    return this.acknowledgement.acknowledge(input);
  }

  /**
   * Marks messages as read locally and remotely.
   * @param {object} input Read input.
   * @returns {Promise<object>} Read result.
   */
  markRead(input = {}) {
    return this.acknowledgement.markRead(input);
  }

  /** @param {object} input Typing input. @returns {Promise<object|boolean>} Result. */
  typingStart(input = {}) { return this.typing.start(input); }

  /** @param {object} input Typing input. @returns {Promise<object|boolean>} Result. */
  typingStop(input = {}) { return this.typing.stop(input); }
}

module.exports = MessageManager;
