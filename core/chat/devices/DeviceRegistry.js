const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

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
    try {
      this.state = JSON.parse(await fs.readFile(this.statePath, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.state = {
        clientDeviceKey: crypto.randomBytes(24).toString('hex'),
        device: null,
        approvals: [],
        updatedAt: new Date().toISOString()
      };
      await this.save();
    }
    return this.state;
  }

  /**
   * Saves local state.
   */
  async save() {
    await fs.mkdir(path.dirname(this.statePath), { recursive: true });
    await fs.writeFile(this.statePath, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
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
