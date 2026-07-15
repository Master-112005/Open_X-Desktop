'use strict';

const PERMISSION_STATUS = Object.freeze({
  GRANTED: 'GRANTED',
  DENIED: 'DENIED',
  PENDING: 'PENDING',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
  UNKNOWN: 'UNKNOWN'
});

const PERMISSION_DECISION = Object.freeze({
  ALLOW: 'ALLOW',
  DENY: 'DENY',
  REQUEST: 'REQUEST',
  BLOCK: 'BLOCK'
});

const PERMISSION_SOURCE = Object.freeze({
  CACHE: 'cache',
  BLOCKCHAIN: 'blockchain',
  LOCAL_POLICY: 'local-policy',
  OS: 'os',
  OFFLINE: 'offline',
  DEFAULT: 'default'
});

const PERMISSION_NAMES = Object.freeze({
  CAMERA: 'camera',
  CLIPBOARD: 'clipboard',
  GALLERY: 'gallery',
  FILE_TRANSFER: 'fileTransfer',
  CONTACTS: 'contacts',
  NOTIFICATIONS: 'notifications',
  MICROPHONE: 'microphone',
  VOICE_COMMANDS: 'voiceCommands',
  LOCATION: 'location',
  CALENDAR: 'calendar',
  SMS: 'sms',
  PHONE_CALLS: 'phoneCalls',
  PLUGINS: 'plugins',
  EXTERNAL_APIS: 'externalApis',
  DESKTOP_AUTOMATION: 'desktopAutomation',
  REMOTE_COMMANDS: 'remoteCommands',
  RECEIVE_FILES: 'receiveFiles',
  SEND_FILES: 'sendFiles'
});

const PERMISSION_VERSION = 'openx-permission-v1';

module.exports = {
  PERMISSION_STATUS,
  PERMISSION_DECISION,
  PERMISSION_SOURCE,
  PERMISSION_NAMES,
  PERMISSION_VERSION
};
