const { HOME_ACTION_VALUES } = require('../constants/HomeActions');
const { HOME_PACKET_TYPES, HOME_PACKET_TYPE_VALUES } = require('../constants/PacketTypes');

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function issue(code, field, message) {
  return { code, field, message };
}

class HomePacketValidator {
  validate(packet = {}) {
    const errors = [];
    if (!packet || typeof packet !== 'object' || Array.isArray(packet)) {
      return {
        valid: false,
        status: 'failed',
        errors: [issue('home.packet.malformed', 'packet', 'Packet must be an object.')]
      };
    }

    ['type', 'requestId', 'target', 'action', 'timestamp', 'expiresAt'].forEach(field => {
      if (!hasValue(packet[field])) {
        errors.push(issue('home.packet.required', field, `${field} is required.`));
      }
    });

    if (hasValue(packet.type) && !HOME_PACKET_TYPE_VALUES.includes(packet.type)) {
      errors.push(issue('home.packet.unknownType', 'type', `Unsupported packet type: ${packet.type}`));
    }

    if (packet.type === HOME_PACKET_TYPES.DEVICE_COMMAND && hasValue(packet.action) && !HOME_ACTION_VALUES.includes(packet.action)) {
      errors.push(issue('home.packet.invalidAction', 'action', `Unsupported home action: ${packet.action}`));
    }

    if (hasValue(packet.timestamp) && !Number.isFinite(Date.parse(packet.timestamp))) {
      errors.push(issue('home.packet.invalidTimestamp', 'timestamp', 'timestamp must be an ISO date string.'));
    }

    if (hasValue(packet.expiresAt) && !Number.isFinite(Date.parse(packet.expiresAt))) {
      errors.push(issue('home.packet.invalidExpiration', 'expiresAt', 'expiresAt must be an ISO date string.'));
    }

    if (Number.isFinite(Date.parse(packet.timestamp)) &&
      Number.isFinite(Date.parse(packet.expiresAt)) &&
      Date.parse(packet.expiresAt) <= Date.parse(packet.timestamp)) {
      errors.push(issue('home.packet.expiredWindow', 'expiresAt', 'expiresAt must be after timestamp.'));
    }

    return {
      valid: errors.length === 0,
      status: errors.length === 0 ? 'passed' : 'failed',
      errors
    };
  }
}

module.exports = HomePacketValidator;
