const { MESSAGE_STATUS } = require('./MessageConstants');

/**
 * Desktop message router for WebSocket primary delivery and HTTP fallback.
 */
class MessageRouter {
  /**
   * Creates message router.
   * @param {object} options Router options.
   */
  constructor(options = {}) {
    this.client = options.client;
    this.connectionManager = options.connectionManager;
    this.storage = options.storage;
    this.eventBus = options.eventBus;
  }

  /**
   * Routes an encrypted message.
   * @param {object} message Message.
   * @returns {Promise<object>} Route result.
   */
  async route(message) {
    if (this.connectionManager?.sendMessageEvent?.('message:send', message)) {
      await this.storage.setStatus(message.messageId, MESSAGE_STATUS.SENT);
      return { transport: 'websocket', queued: false, messageId: message.messageId };
    }
    try {
      const result = await this.client.send(message);
      await this.storage.setStatus(message.messageId, MESSAGE_STATUS.SENT);
      return { transport: 'http', queued: false, serverQueued: Number(result.queuedCount || 0) > 0, result };
    } catch (error) {
      await this.storage.setStatus(message.messageId, MESSAGE_STATUS.QUEUED);
      await this.storage.upsertRetry({
        messageId: message.messageId,
        payload: message,
        retryCount: message.retryCount || 0,
        status: MESSAGE_STATUS.QUEUED,
        reason: error.code || 'message.route_failed',
        nextRetryAt: new Date(Date.now() + 1000).toISOString(),
        updatedAt: new Date().toISOString()
      });
      return { transport: 'local-queue', queued: true, error: error.message };
    }
  }
}

module.exports = MessageRouter;
