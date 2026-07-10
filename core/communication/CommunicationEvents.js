const COMMUNICATION_EVENTS = Object.freeze({
  CONNECTED: 'communication.connected',
  DISCONNECTED: 'communication.disconnected',
  LOGGED_OUT: 'communication.loggedOut',
  QR_CODE_DETECTED: 'communication.qrCodeDetected',
  CONTACT_RESOLVED: 'communication.contactResolved',
  DUPLICATE_CONTACTS: 'communication.duplicateContacts',
  MESSAGE_PREPARED: 'communication.messagePrepared',
  MESSAGE_SENT: 'communication.messageSent',
  CONFIRMATION_REQUESTED: 'communication.confirmationRequested',
  ERROR: 'communication.error',
  HEALTH_CHANGED: 'communication.healthChanged'
});

module.exports = COMMUNICATION_EVENTS;
