const crypto = require('crypto');
const { readSecureJsonFile, writeSecureJsonAtomic } = require('../../assistant/Data');

/**
 * Persists local desktop device registration state.
 */
class DeviceRegistry {
  /**
   * Creates a device registry.
   * @param {object} options Registry options.
   */
  constructor(options = {}) {
    this.statePath = options.statePath;
    this.state = null;
  }

  /**
   * Loads local state.
   * @returns {Promise<object>} State.
   */
  async load() {
    if (this.state) return this.state;
    this.state = readSecureJsonFile(this.statePath, () => ({
      clientDeviceKey: crypto.randomBytes(24).toString('hex'),
      device: null,
      approvals: [],
      updatedAt: new Date().toISOString()
    }), {
      createIfMissing: true,
      validate: value => value && typeof value === 'object'
    });
    return this.state;
  }

  /**
   * Saves local state.
   */
  async save() {
    writeSecureJsonAtomic(this.statePath, this.state, { backup: true });
  }

  /**
   * Stores registered device data.
   * @param {object} device Device.
   * @param {object|null} approval Approval.
   */
  async setDevice(device, approval = null) {
    await this.load();
    this.state.device = device;
    if (approval) this.state.approvals.push(approval);
    this.state.updatedAt = new Date().toISOString();
    await this.save();
  }

  /**
   * Returns current device.
   * @returns {Promise<object|null>} Device.
   */
  async getDevice() {
    return (await this.load()).device || null;
  }

  /**
   * Returns stable local client key.
   * @returns {Promise<string>} Client key.
   */
  async getClientDeviceKey() {
    return (await this.load()).clientDeviceKey;
  }
}

module.exports = DeviceRegistry;
