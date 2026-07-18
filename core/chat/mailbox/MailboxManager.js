const MailboxClient = require('./MailboxClient');
const MailboxConfiguration = require('./MailboxConfiguration');
const MailboxEvents = require('./MailboxEvents');
const MailboxLogger = require('./MailboxLogger');
const SequenceManager = require('./SequenceManager');
const AcknowledgementManager = require('./AcknowledgementManager');
const MailboxSyncManager = require('./MailboxSyncManager');

/**
 * Desktop mailbox facade for opaque encrypted envelopes.
 */
class MailboxManager {
  /**
   * Creates mailbox manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.config = options.config instanceof MailboxConfiguration ? options.config : new MailboxConfiguration(options.config || {});
    this.eventBus = options.eventBus;
    this.logger = options.logger || new MailboxLogger();
    this.client = options.client || new MailboxClient({ config: this.config, fetchImpl: options.fetchImpl });
    this.sequenceManager = options.sequenceManager || new SequenceManager({ config: this.config, eventBus: this.eventBus });
    this.acknowledgementManager = options.acknowledgementManager || new AcknowledgementManager({ client: this.client, sequenceManager: this.sequenceManager, eventBus: this.eventBus });
    this.syncManager = options.syncManager || new MailboxSyncManager({ client: this.client, sequenceManager: this.sequenceManager, eventBus: this.eventBus });
  }

  /**
   * Stores an encrypted envelope.
   * @param {object} input Envelope input.
   * @returns {Promise<object>} Stored envelope.
   */
  async storeEnvelope(input = {}) {
    const result = await this.client.storeEnvelope(input);
    this.eventBus?.emit?.(MailboxEvents.ENVELOPE_STORED, { envelopeId: result.envelopeId, sequence: result.mailboxSequence });
    return result;
  }

  /**
   * Synchronizes mailbox envelopes.
   * @param {object} input Sync input.
   * @returns {Promise<object>} Sync payload.
   */
  sync(input = {}) {
    return this.syncManager.sync(input);
  }

  /**
   * Acknowledges highest contiguous sequence.
   * @param {object} input ACK input.
   * @returns {Promise<object>} ACK result.
   */
  acknowledge(input = {}) {
    return this.acknowledgementManager.acknowledge(input);
  }

  /**
   * Gets mailbox status.
   * @param {string} deviceId DeviceID.
   * @returns {Promise<object>} Status.
   */
  async status(deviceId) {
    const result = await this.client.status(deviceId);
    this.eventBus?.emit?.(MailboxEvents.MAILBOX_STATUS_UPDATED, { deviceId, sequence: result.mailbox?.currentSequence || 0 });
    return result;
  }

  /**
   * Deletes an envelope from server transient storage.
   * @param {string} envelopeId EnvelopeID.
   * @returns {Promise<object>} Delete result.
   */
  async deleteEnvelope(envelopeId) {
    const result = await this.client.deleteEnvelope(envelopeId);
    this.eventBus?.emit?.(MailboxEvents.ENVELOPE_DELETED, { envelopeId });
    return result;
  }
}

module.exports = MailboxManager;
