/**
 * Desktop message acknowledgement and read-state manager.
 */
class AcknowledgementManager {
  /**
   * Creates acknowledgement manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.client = options.client;
    this.mailboxManager = options.mailboxManager;
    this.storage = options.storage;
    this.eventBus = options.eventBus;
    this.events = options.events;
  }

  /**
   * Sends message ACK through the Phase 8 endpoint.
   * @param {object} input ACK input.
   * @returns {Promise<object>} ACK result.
   */
  acknowledge(input = {}) {
    return this.client.acknowledge(input);
  }

  /**
   * Acknowledges mailbox sequence after sync.
   * @param {object} input Mailbox ACK input.
   * @returns {Promise<object>} ACK result.
   */
  acknowledgeMailbox(input = {}) {
    return this.mailboxManager.acknowledge(input);
  }

  /**
   * Marks messages as read locally and routes read state.
   * @param {object} input Read input.
   * @returns {Promise<object>} Read result.
   */
  async markRead(input = {}) {
    for (const messageId of input.messageIds || []) await this.storage.markRead(messageId, input.readAt || null);
    const result = await this.client.markRead(input);
    this.eventBus?.emit?.(this.events.MESSAGE_READ, { messageIds: input.messageIds || [] });
    return result;
  }
}

module.exports = AcknowledgementManager;
