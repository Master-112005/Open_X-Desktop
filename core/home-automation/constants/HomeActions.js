const HOME_ACTIONS = Object.freeze({
  TURN_ON: 'turn_on',
  TURN_OFF: 'turn_off',
  TOGGLE: 'toggle',
  OPEN: 'open',
  CLOSE: 'close',
  SET_LEVEL: 'set_level'
});

const HOME_ACTION_VALUES = Object.freeze(Object.values(HOME_ACTIONS));

const HOME_DEVICE_TYPES = Object.freeze([
  'light',
  'lights',
  'lamp',
  'bulb',
  'fan',
  'switch',
  'plug',
  'socket',
  'ac',
  'air conditioner',
  'heater',
  'tv',
  'curtain',
  'curtains',
  'door',
  'gate',
  'garage door'
]);

const HOME_ROOM_WORDS = Object.freeze([
  'bedroom',
  'kitchen',
  'living room',
  'hall',
  'bathroom',
  'garage',
  'balcony',
  'office',
  'study',
  'dining room'
]);

module.exports = {
  HOME_ACTIONS,
  HOME_ACTION_VALUES,
  HOME_DEVICE_TYPES,
  HOME_ROOM_WORDS
};
