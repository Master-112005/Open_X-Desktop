/**
 * Desktop HTTP client for Phase 8 messaging endpoints.
 */
class MessageClient {
  /**
   * Creates message client.
   * @param {object} options Client options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  /** @param {object} payload Message payload. @returns {Promise<object>} Send result. */
  send(payload) { return this.request('/messages/send', 'POST', payload); }

  /** @param {object} payload ACK payload. @returns {Promise<object>} ACK result. */
  acknowledge(payload) { return this.request('/messages/ack', 'POST', payload); }

  /** @param {object} payload Read payload. @returns {Promise<object>} Read result. */
  markRead(payload) { return this.request('/messages/read', 'POST', payload); }

  /** @param {object} payload Retry payload. @returns {Promise<object>} Retry result. */
  retry(payload) { return this.request('/messages/retry', 'POST', payload); }

  /** @param {object} payload Typing payload. @returns {Promise<object>} Typing result. */
  typingStart(payload) { return this.request('/typing/start', 'POST', payload); }

  /** @param {object} payload Typing payload. @returns {Promise<object>} Typing result. */
  typingStop(payload) { return this.request('/typing/stop', 'POST', payload); }

  /**
   * Executes an HTTP request.
   * @param {string} route Route.
   * @param {string} method HTTP method.
   * @param {object|null} body Body.
   * @returns {Promise<object>} Data.
   */
  async request(route, method, body = null) {
    if (typeof this.fetchImpl !== 'function') throw new Error('Fetch is not available for message client.');
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), this.config.requestTimeoutMs) : null;
    timer?.unref?.();
    try {
      const response = await this.fetchImpl(`${this.config.apiBaseUrl}${route}`, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller?.signal
      });
      const text = typeof response.text === 'function'
        ? await response.text()
        : JSON.stringify(await response.json());
      let json = null;
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        const error = new Error(`OpenX Chat message route returned an unreadable response for ${route}.`);
        error.code = 'message.response_invalid';
        error.statusCode = response.status;
        throw error;
      }
      if (!response.ok || json.ok === false) {
        const error = new Error(json.error?.message || `Message request failed: ${response.status}`);
        error.code = json.error?.code || 'message.http_failed';
        error.statusCode = response.status;
        throw error;
      }
      return json.data;
    } catch (error) {
      if (error.name === 'AbortError') {
        const timeout = new Error('OpenX Chat Server did not respond to the message request in time.');
        timeout.code = 'message.request_timeout';
        throw timeout;
      }
      if (/network request failed|fetch failed/i.test(String(error.message || ''))) {
        const network = new Error(`OpenX Chat Server is not reachable at ${this.config.apiBaseUrl}.`);
        network.code = 'message.server_unreachable';
        throw network;
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

module.exports = MessageClient;
