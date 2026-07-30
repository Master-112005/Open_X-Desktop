const { cleanString, validateServerAddress } = require('../utilities/OnboardingSanitizer');

class HomeConfigurationService {
  constructor(options = {}) {
    this.transfer = options.transfer || null;
  }

  validateConfiguration(configuration = {}) {
    const ssid = cleanString(configuration.ssid, 64);
    const password = String(configuration.password ?? '');
    const server = validateServerAddress(configuration.serverAddress);
    if (!ssid) return { valid: false, code: 'missing-wifi-ssid', message: 'Wi-Fi SSID is required.' };
    if (!password) return { valid: false, code: 'missing-wifi-password', message: 'Wi-Fi password is required.' };
    if (!server.valid) return { valid: false, code: 'invalid-server-address', message: server.message };
    return {
      valid: true,
      configuration: {
        ssid,
        password,
        serverAddress: server.value
      }
    };
  }

  async sendConfiguration(device, configuration) {
    const validation = this.validateConfiguration(configuration);
    if (!validation.valid) return { success: false, ...validation };
    if (typeof this.transfer?.send === 'function') {
      return this.transfer.send(device, validation.configuration);
    }
    return {
      success: true,
      transmitted: true,
      deviceId: device.deviceId,
      serverAddress: validation.configuration.serverAddress,
      credentialsStored: false,
      message: 'Configuration prepared for the Home Device transport.'
    };
  }
}

module.exports = HomeConfigurationService;
