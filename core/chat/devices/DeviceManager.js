const DeviceConfiguration = require('./DeviceConfiguration');
const DeviceEvents = require('./DeviceEvents');
const DeviceLifecycle = require('./DeviceLifecycle');
const DeviceLogger = require('./DeviceLogger');
const DeviceRegistry = require('./DeviceRegistry');
const DeviceService = require('./DeviceService');

/**
 * Desktop trusted device composition root.
 */
class DeviceManager {
  /**
   * Creates a device manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.config = options.config instanceof DeviceConfiguration ? options.config : new DeviceConfiguration(options.config || {});
    this.logger = options.logger || new DeviceLogger();
    this.eventBus = options.eventBus;
    this.registry = options.registry || new DeviceRegistry({ statePath: this.config.statePath });
    this.lifecycle = options.lifecycle || new DeviceLifecycle();
    this.service = options.service || new DeviceService({ config: this.config, fetchImpl: options.fetchImpl });
  }

  /**
   * Starts device management and auto-registers when an AccountID is configured.
   * @returns {Promise<object|null>} Device state or null.
   */
  async start() {
    await this.registry.load();
    if (!this.config.autoRegister || !this.config.accountId) {
      this.emit(DeviceEvents.AUTO_REGISTER_SKIPPED, { reason: 'missing-account-or-disabled' });
      return this.registry.getDevice();
    }
    return this.ensureRegistered();
  }

  /**
   * Ensures this desktop installation is registered.
   * @returns {Promise<object>} Device state.
   */
  async ensureRegistered() {
    const existing = await this.registry.getDevice();
    if (this.lifecycle.isTrusted(existing) || existing?.deviceStatus === 'Pending') return existing;
    try {
      const clientDeviceKey = await this.registry.getClientDeviceKey();
      const result = await this.service.registerDevice({
        accountId: this.config.accountId,
        deviceName: this.config.deviceName,
        platform: this.config.platform,
        platformVersion: this.config.platformVersion,
        applicationVersion: this.config.applicationVersion,
        operatingSystem: this.config.operatingSystem,
        deviceType: this.config.deviceType,
        capabilities: this.config.capabilities,
        clientDeviceKey
      });
      await this.registry.setDevice(result.device, result.approval);
      this.emit(DeviceEvents.REGISTERED, { device: result.device, approval: result.approval });
      return result.device;
    } catch (error) {
      this.logger.warn('Desktop device auto-registration failed', { error: error.message });
      this.emit(DeviceEvents.AUTO_REGISTER_FAILED, { error: error.message });
      throw error;
    }
  }

  /**
   * Returns the local device.
   * @returns {Promise<object|null>} Device state.
   */
  getDevice() {
    return this.registry.getDevice();
  }

  /**
   * Emits an event when an event bus is present.
   * @param {string} eventName Event name.
   * @param {object} payload Event payload.
   */
  emit(eventName, payload = {}) {
    this.eventBus?.emit?.(eventName, payload);
  }
}

module.exports = DeviceManager;
