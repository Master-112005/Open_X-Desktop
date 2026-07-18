/**
 * Internal Desktop Chat event names reserved for infrastructure and future phases.
 */
const CHAT_EVENTS = Object.freeze({
  LIFECYCLE_STARTING: 'desktop.chat.lifecycle.starting',
  LIFECYCLE_STARTED: 'desktop.chat.lifecycle.started',
  LIFECYCLE_STOPPING: 'desktop.chat.lifecycle.stopping',
  LIFECYCLE_STOPPED: 'desktop.chat.lifecycle.stopped',
  CONNECTION_CONNECTING: 'desktop.chat.connection.connecting',
  CONNECTION_CONNECTED: 'desktop.chat.connection.connected',
  CONNECTION_READY: 'desktop.chat.connection.ready',
  CONNECTION_DISCONNECTED: 'desktop.chat.connection.disconnected',
  CONNECTION_RECONNECTING: 'desktop.chat.connection.reconnecting',
  CONNECTION_ERROR: 'desktop.chat.connection.error',
  CONNECTION_HEARTBEAT: 'desktop.chat.connection.heartbeat',
  CONNECTION_WAKE: 'desktop.chat.connection.wake',
  CONNECTION_BACKGROUND: 'desktop.chat.connection.background',
  CONNECTION_FOREGROUND: 'desktop.chat.connection.foreground',
  CONNECTION_RECOVERY_STARTED: 'desktop.chat.connection.recovery.started',
  CONNECTION_RECOVERY_COMPLETED: 'desktop.chat.connection.recovery.completed',
  PRESENCE_CHANGED: 'desktop.chat.presence.changed',
  HEALTH_CHANGED: 'desktop.chat.health.changed',
  CONFIGURATION_CHANGED: 'desktop.chat.configuration.changed',
  FUTURE_SYNCHRONIZATION: 'desktop.chat.future.synchronization',
  FUTURE_MESSAGING: 'desktop.chat.future.messaging',
  FUTURE_NOTIFICATIONS: 'desktop.chat.future.notifications',
  FUTURE_AUTHENTICATION: 'desktop.chat.future.authentication',
  FUTURE_ENCRYPTION: 'desktop.chat.future.encryption'
});

module.exports = CHAT_EVENTS;
