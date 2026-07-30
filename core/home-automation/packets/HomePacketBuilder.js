const crypto = require('crypto');
const { HOME_PACKET_TYPES } = require('../constants/PacketTypes');
const { createHomePacket } = require('../models/HomePacket');

function createRequestId() {
  if (typeof crypto.randomUUID === 'function') {
    return `home_${crypto.randomUUID()}`;
  }
  return `home_${crypto.randomBytes(16).toString('hex')}`;
}

class HomePacketBuilder {
  constructor(options = {}) {
    this.defaultTtlMs = Number.isSafeInteger(Number(options.defaultTtlMs))
      ? Math.max(1000, Math.min(5 * 60 * 1000, Number(options.defaultTtlMs)))
      : 30 * 1000;
  }

  buildDeviceCommand(command = {}) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.defaultTtlMs);
    return createHomePacket({
      type: HOME_PACKET_TYPES.DEVICE_COMMAND,
      requestId: createRequestId(),
      target: command.target,
      action: command.action,
      timestamp: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    });
  }
}

module.exports = HomePacketBuilder;
