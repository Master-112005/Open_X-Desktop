/**
 * Desktop API client for trusted device endpoints.
 */
class DeviceService {
  /**
   * Creates a device service.
   * @param {object} options Service options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  /**
   * Registers this installation as a device.
   * @param {object} payload Device registration payload.
   * @returns {Promise<object>} Registration response data.
   */
  async registerDevice(payload) {
    return this.request('/device/register', 'POST', payload);
  }

  /**
   * Approves a pending device.
   * @param {object} payload Approval payload.
   * @returns {Promise<object>} Device response.
   */
  async approveDevice(payload) {
    return this.request('/device/approve', 'POST', payload);
  }

  /**
   * Revokes a device.
   * @param {object} payload Revoke payload.
   * @returns {Promise<object>} Device response.
   */
  async revokeDevice(payload) {
    return this.request('/device/revoke', 'POST', payload);
  }

  /**
   * Removes a device.
   * @param {object} payload Remove payload.
   * @returns {Promise<object>} Device response.
   */
  async removeDevice(payload) {
    return this.request('/device/remove', 'DELETE', payload);
  }

  /**
   * Gets a device.
   * @param {string} deviceId DeviceID.
   * @returns {Promise<object>} Device response.
   */
  async getDevice(deviceId) {
    return this.request(`/device/${encodeURIComponent(deviceId)}`, 'GET');
  }

  /**
   * Executes an HTTP request.
   * @param {string} route API route.
   * @param {string} method HTTP method.
   * @param {object|null} body Request body.
   * @returns {Promise<object>} Response data.
   */
  async request(route, method, body = null) {
    if (typeof this.fetchImpl !== 'function') throw new Error('Fetch is not available for device service.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    try {
      const response = await this.fetchImpl(`${this.config.apiBaseUrl}${route}`, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
      const json = await response.json();
      if (!response.ok || json.ok === false) throw new Error(json.error?.message || `Device request failed: ${response.status}`);
      return json.data;
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = DeviceService;
