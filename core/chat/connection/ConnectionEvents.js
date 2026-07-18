/**
 * Desktop Phase 11 connection event names.
 */
module.exports = Object.freeze({
  CONNECTED: 'desktop.chat.phase11.connected',
  DISCONNECTED: 'desktop.chat.phase11.disconnected',
  RECONNECT: 'desktop.chat.phase11.reconnect',
  HEARTBEAT: 'desktop.chat.phase11.heartbeat',
  WAKE: 'desktop.chat.phase11.wake',
  BACKGROUND: 'desktop.chat.phase11.background',
  FOREGROUND: 'desktop.chat.phase11.foreground',
  PUSH_RECEIVED: 'desktop.chat.phase11.push.received',
  SYNCHRONIZATION_REQUIRED: 'desktop.chat.phase11.sync.required',
  SYNCHRONIZATION_COMPLETED: 'desktop.chat.phase11.sync.completed',
  RECOVERY_STARTED: 'desktop.chat.phase11.recovery.started',
  RECOVERY_COMPLETED: 'desktop.chat.phase11.recovery.completed',
  PRESENCE_CHANGED: 'desktop.chat.phase11.presence.changed'
});
