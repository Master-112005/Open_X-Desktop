const DEVICE_ID_PATTERN = /^[A-Za-z0-9._:-]{3,160}$/;

function cleanString(value, maxLength = 160) {
  return String(value ?? '')
    .replace(/[\r\n\x00-\x1f\x7f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanDeviceId(value) {
  return cleanString(value, 160);
}

function isValidDeviceId(value) {
  return DEVICE_ID_PATTERN.test(cleanDeviceId(value));
}

function safeCapabilities(value) {
  if (Array.isArray(value)) {
    return value.map(item => cleanString(item, 80)).filter(Boolean).slice(0, 50);
  }
  if (!value || typeof value !== 'object') return [];
  return Object.keys(value).map(key => cleanString(key, 80)).filter(Boolean).slice(0, 50);
}

function validateServerAddress(value) {
  const raw = cleanString(value, 240);
  if (!raw) return { valid: false, message: 'OpenX_Server address is required.' };
  try {
    const url = new URL(raw);
    if (!['ws:', 'wss:', 'http:', 'https:'].includes(url.protocol)) {
      return { valid: false, message: 'Use http, https, ws, or wss for the server address.' };
    }
    return { valid: true, value: raw };
  } catch (_) {
    return { valid: false, message: 'OpenX_Server address is not valid.' };
  }
}

function createPublicDevice(device = {}) {
  return {
    deviceId: cleanDeviceId(device.deviceId),
    deviceName: cleanString(device.deviceName || device.name || 'OpenX Home Device', 100),
    firmwareVersion: cleanString(device.firmwareVersion || 'unknown', 80),
    protocolVersion: cleanString(device.protocolVersion || 'openx-home-v1', 40),
    deviceStatus: cleanString(device.deviceStatus || device.status || 'ready_for_setup', 60),
    connectionStatus: cleanString(device.connectionStatus || 'offline', 40),
    pairingStatus: cleanString(device.pairingStatus || device.pairStatus || 'unpaired', 40),
    capabilities: safeCapabilities(device.capabilities || device.supportedCapabilities),
    discoverySource: cleanString(device.discoverySource || device.source || '', 80),
    transport: cleanString(device.transport || '', 40),
    bluetoothDeviceId: cleanString(device.bluetoothDeviceId || '', 160),
    configurationUrl: cleanString(device.configurationUrl || device.setupUrl || '', 240),
    ipAddress: cleanString(device.ipAddress || '', 80),
    discoveredAt: device.discoveredAt || new Date().toISOString(),
    lastSeenAt: device.lastSeenAt || new Date().toISOString(),
    configuredAt: device.configuredAt || '',
    pairedAt: device.pairedAt || ''
  };
}

module.exports = {
  cleanString,
  cleanDeviceId,
  isValidDeviceId,
  safeCapabilities,
  validateServerAddress,
  createPublicDevice
};
