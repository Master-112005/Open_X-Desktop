module.exports = Object.freeze({
  INITIALIZED: 'update.initialized',
  STARTED: 'update.started',
  STOPPED: 'update.stopped',
  STATE_CHANGED: 'update.stateChanged',
  CONFIG_CHANGED: 'update.configChanged',
  VERSION_READ: 'update.versionRead',
  VERSION_CHANGED: 'update.versionChanged',
  VERSION_CHECK_STARTED: 'update.versionCheck.started',
  VERSION_CHECK_COMPLETED: 'update.versionCheck.completed',
  VERSION_CHECK_FAILED: 'update.versionCheck.failed',
  UPDATE_AVAILABLE: 'update.versionCheck.updateAvailable',
  ALREADY_UP_TO_DATE: 'update.versionCheck.alreadyUpToDate',
  SERVER_UNAVAILABLE: 'update.versionCheck.serverUnavailable',
  INVALID_RESPONSE: 'update.versionCheck.invalidResponse',
  ERROR: 'update.error',
  DIAGNOSTIC: 'update.diagnostic'
});
