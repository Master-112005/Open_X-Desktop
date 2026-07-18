/**
 * HTTP client for privacy-safe history synchronization coordination endpoints.
 */
class HistorySynchronizationClient {
  /**
   * Creates client.
   * @param {object} options Client options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  /** @param {object} payload Request payload. @returns {Promise<object>} Request result. */
  requestSynchronization(payload) {
    return this.request('/history-sync/request', 'POST', payload);
  }

  /** @param {object} input Availability input. @returns {Promise<object>} Availability. */
  availability(input = {}) {
    const query = new URLSearchParams({
      accountId: String(input.accountId || ''),
      deviceId: String(input.deviceId || '')
    });
    return this.request(`/history-sync/availability?${query.toString()}`, 'GET');
  }

  /** @param {object} payload Negotiation payload. @returns {Promise<object>} Negotiation result. */
  negotiate(payload) {
    return this.request('/history-sync/negotiate', 'POST', payload);
  }

  /** @param {string} syncRequestId Sync request id. @returns {Promise<object>} Status. */
  status(syncRequestId) {
    return this.request(`/history-sync/status/${encodeURIComponent(String(syncRequestId || ''))}`, 'GET');
  }

  /** @param {object} payload Completion payload. @returns {Promise<object>} Completion result. */
  complete(payload) {
    return this.request('/history-sync/complete', 'POST', payload);
  }

  /** @param {object} payload Failure payload. @returns {Promise<object>} Failure result. */
  fail(payload) {
    return this.request('/history-sync/fail', 'POST', payload);
  }

  /** @param {object} payload Cancel payload. @returns {Promise<object>} Cancel result. */
  cancel(payload) {
    return this.request('/history-sync/cancel', 'POST', payload);
  }

  /**
   * Executes HTTP request.
   * @param {string} route Route.
   * @param {string} method HTTP method.
   * @param {object|null} body Request body.
   * @returns {Promise<object>} Data payload.
   */
  async request(route, method, body = null) {
    if (typeof this.fetchImpl !== 'function') throw new Error('Fetch is not available for history synchronization client.');
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), this.config.requestTimeoutMs) : null;
    try {
      const response = await this.fetchImpl(`${this.config.apiBaseUrl}${route}`, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller?.signal
      });
      const json = await response.json();
      if (!response.ok || json.ok === false) {
        const error = new Error(json.error?.message || `History synchronization request failed: ${response.status}`);
        error.code = json.error?.code || 'history_sync.http_failed';
        error.statusCode = response.status;
        throw error;
      }
      return json.data;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

module.exports = HistorySynchronizationClient;
