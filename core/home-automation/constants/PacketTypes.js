const HOME_PACKET_TYPES = Object.freeze({
  DEVICE_REGISTER: 'home:device-register',
  DEVICE_PAIR_REQUEST: 'home:device-pair-request',
  DEVICE_PAIR_APPROVE: 'home:device-pair-approve',
  DEVICE_COMMAND: 'home:device-command',
  COMMAND_RESULT: 'home:command-result',
  HEARTBEAT: 'home:heartbeat',
  DEVICE_ONLINE: 'home:device-online',
  DEVICE_OFFLINE: 'home:device-offline'
});

const HOME_PACKET_TYPE_VALUES = Object.freeze(Object.values(HOME_PACKET_TYPES));

module.exports = {
  HOME_PACKET_TYPES,
  HOME_PACKET_TYPE_VALUES
};
