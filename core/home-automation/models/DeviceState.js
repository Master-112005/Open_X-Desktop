function createDeviceState(input = {}) {
  return Object.freeze({
    deviceId: String(input.deviceId || '').trim(),
    online: input.online === true,
    power: input.power === true ? 'on' : input.power === false ? 'off' : 'unknown',
    level: Number.isFinite(Number(input.level)) ? Number(input.level) : null,
    updatedAt: input.updatedAt || new Date().toISOString()
  });
}

module.exports = {
  createDeviceState
};
