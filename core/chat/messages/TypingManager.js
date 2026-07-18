/**
 * Desktop ephemeral typing manager.
 */
class TypingManager {
  /**
   * Creates typing manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.client = options.client;
    this.connectionManager = options.connectionManager;
    this.eventBus = options.eventBus;
    this.events = options.events;
  }

  /**
   * Sends typing-start signal.
   * @param {object} input Typing input.
   * @returns {Promise<object|boolean>} Result.
   */
  async start(input = {}) {
    this.eventBus?.emit?.(this.events.TYPING_STARTED, input);
    if (this.connectionManager?.sendMessageEvent?.('typing:start', input)) return true;
    return this.client.typingStart(input);
  }

  /**
   * Sends typing-stop signal.
   * @param {object} input Typing input.
   * @returns {Promise<object|boolean>} Result.
   */
  async stop(input = {}) {
    this.eventBus?.emit?.(this.events.TYPING_STOPPED, input);
    if (this.connectionManager?.sendMessageEvent?.('typing:stop', input)) return true;
    return this.client.typingStop(input);
  }
}

module.exports = TypingManager;
