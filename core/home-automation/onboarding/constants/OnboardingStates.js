const HOME_ONBOARDING_STATES = Object.freeze({
  DISCOVERY_STARTED: 'discovery_started',
  DEVICE_FOUND: 'device_found',
  CONFIGURATION_STARTED: 'configuration_started',
  CONFIGURATION_SENT: 'configuration_sent',
  WAITING_CONNECTION: 'waiting_connection',
  CONNECTED: 'connected',
  WAITING_APPROVAL: 'waiting_approval',
  PAIRING_COMPLETE: 'pairing_complete',
  FINISHED: 'finished',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
});

const HOME_ONBOARDING_STEPS = Object.freeze([
  'welcome',
  'device',
  'wifi',
  'server',
  'transfer',
  'connecting',
  'approval',
  'complete'
]);

module.exports = {
  HOME_ONBOARDING_STATES,
  HOME_ONBOARDING_STEPS
};
