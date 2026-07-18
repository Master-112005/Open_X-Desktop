const MailboxEvents = require('./MailboxEvents');

/**
 * Desktop acknowledgement manager.
 */
class AcknowledgementManager {
  /**
   * Creates acknowledgement manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.client = options.client;
    this.sequenceManager = options.sequenceManager;
    this.eventBus = options.eventBus;
  }

  /**
   * Acknowledges a mailbox sequence and records it locally.
   * @param {object} input ACK input.
   * @returns {Promise<object>} ACK result.
   */
  async acknowledge(input = {}) {
    const result = await this.client.acknowledge({
      deviceId: input.deviceId,
      highestContiguousSequence: Number(input.highestContiguousSequence || 0)
    });
    await this.sequenceManager.updateLastAcknowledgedSequence(input.deviceId, result.acknowledgement.highestContiguousSequence);
    this.eventBus?.emit?.(MailboxEvents.ENVELOPE_ACKNOWLEDGED, { deviceId: input.deviceId, sequence: result.acknowledgement.highestContiguousSequence });
    return result;
  }
}

module.exports = AcknowledgementManager;
