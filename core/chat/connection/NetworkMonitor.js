/**
 * Desktop network monitor abstraction for reconnect decisions.
 */
class NetworkMonitor {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.provider = options.provider || (() => ({ online: true, type: 'desktop', quality: 'usable' }));
  }

  /** @returns {object} Current network state. */
  getStatus() {
    const status = this.provider() || {};
    return {
      online: status.online !== false,
      type: status.type || 'desktop',
      quality: status.online === false ? 'offline' : status.quality || 'usable',
      shouldReconnect: status.online !== false
    };
  }
}

module.exports = NetworkMonitor;
