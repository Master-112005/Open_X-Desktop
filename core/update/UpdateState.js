const UPDATE_STATES = Object.freeze({
  UNINITIALIZED: 'UNINITIALIZED',
  INITIALIZING: 'INITIALIZING',
  READY: 'READY',
  RUNNING: 'RUNNING',
  STOPPING: 'STOPPING',
  STOPPED: 'STOPPED',
  ERROR: 'ERROR'
});

function isValidUpdateState(state) {
  return Object.prototype.hasOwnProperty.call(UPDATE_STATES, String(state || ''));
}

module.exports = {
  UPDATE_STATES,
  isValidUpdateState
};
