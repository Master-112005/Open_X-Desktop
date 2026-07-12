const EventEmitter = require('events');
const VersionManager = require('../VersionManager');
const STATES = require('./UpdateNotificationState');
const EVENTS = require('./UpdateNotificationEvents');
const UpdateNotificationDiagnostics = require('./UpdateNotificationDiagnostics');
const UpdateNotificationLogger = require('./UpdateNotificationLogger');
const UpdateEventValidator = require('./UpdateEventValidator');
const UpdateEventQueue = require('./UpdateEventQueue');
const DynamicIslandUpdateCard = require('./DynamicIslandUpdateCard');
const UpdateNotificationResult = require('./UpdateNotificationResult');

class UpdateNotificationManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.state = STATES.UNKNOWN;
    this.versionManager = options.versionManager || new VersionManager(options);
    this.validator = options.validator || new UpdateEventValidator({ versionManager: this.versionManager });
    this.queue = options.queue || new UpdateEventQueue({ maxItems: options.maxQueueItems || 25 });
    this.diagnostics = options.diagnostics || new UpdateNotificationDiagnostics({
      enabled: options.diagnosticsEnabled !== false
    });
    this.logger = options.notificationLogger || new UpdateNotificationLogger({
      logger: options.logger,
      enabled: options.loggingEnabled !== false
    });
    this.displayHandler = options.displayHandler || null;
    this.ackSender = options.ackSender || null;
    this.latestNotification = null;
  }

  setDisplayHandler(handler) {
    this.displayHandler = typeof handler === 'function' ? handler : null;
  }

  setAckSender(sender) {
    this.ackSender = typeof sender === 'function' ? sender : null;
  }

  handleEvent(event = {}) {
    this.state = STATES.CONNECTED;
    this.diagnostics.mark('received');
    this.emit(EVENTS.EVENT_RECEIVED, event);
    this.sendAck(event, 'received', 'ok');

    const validation = this.validator.validate(event);
    if (!validation.success) {
      const error = new Error(validation.error.message);
      error.code = validation.error.code;
      this.state = STATES.ERROR;
      this.diagnostics.recordError(error);
      this.sendAck(event, 'validated', 'error', validation.error);
      this.emit(EVENTS.ERROR, validation.error);
      return UpdateNotificationResult.fail(validation.error);
    }

    const safeEvent = validation.event;
    this.diagnostics.mark('validated');
    this.emit(EVENTS.EVENT_VALIDATED, safeEvent);
    this.sendAck(safeEvent, 'validated', 'ok');

    if (this.queue.has(safeEvent.eventId)) {
      this.state = STATES.DISMISSED;
      this.diagnostics.mark('ignored');
      this.emit(EVENTS.EVENT_IGNORED, { reason: 'duplicate', eventId: safeEvent.eventId });
      return UpdateNotificationResult.ok({ ignored: true, reason: 'duplicate', event: safeEvent });
    }

    const currentVersionResult = this.versionManager.getCurrentVersion();
    const currentVersion = currentVersionResult?.data?.version || currentVersionResult?.version || null;
    if (currentVersion && this.versionManager.isValidVersion(currentVersion) &&
      !this.versionManager.isNewer(safeEvent.latestVersion, currentVersion)) {
      this.state = STATES.UP_TO_DATE;
      this.diagnostics.mark('ignored');
      this.emit(EVENTS.EVENT_IGNORED, { reason: 'up-to-date', eventId: safeEvent.eventId, currentVersion });
      return UpdateNotificationResult.ok({ ignored: true, reason: 'up-to-date', event: safeEvent });
    }

    this.queue.enqueue(safeEvent);
    this.latestNotification = safeEvent;
    this.diagnostics.lastNotificationAt = new Date().toISOString();
    this.state = STATES.UPDATE_AVAILABLE;
    this.emit(EVENTS.UPDATE_STORED, safeEvent);
    this.emit(EVENTS.UPDATE_AVAILABLE, safeEvent);

    const card = DynamicIslandUpdateCard.build(safeEvent);
    const displayed = this.display(card, safeEvent);
    if (displayed) {
      this.state = STATES.DISPLAYING_NOTIFICATION;
      this.diagnostics.mark('displayed');
      this.diagnostics.lastDisplayedAt = new Date().toISOString();
      this.sendAck(safeEvent, 'displayed', 'ok');
      this.emit(EVENTS.NOTIFICATION_DISPLAYED, { event: safeEvent, card });
    } else {
      this.sendAck(safeEvent, 'displayed', 'error', { reason: 'display-handler-unavailable' });
    }
    return UpdateNotificationResult.ok({ event: safeEvent, displayed, card });
  }

  display(card, event) {
    if (typeof this.displayHandler !== 'function') return false;
    try {
      return this.displayHandler(card, event) !== false;
    } catch (error) {
      this.state = STATES.ERROR;
      this.diagnostics.recordError(error);
      this.logger.warn('Dynamic Island update card display failed', { error: error.message });
      return false;
    }
  }

  sendAck(event = {}, stage, status = 'ok', details = {}) {
    if (!String(event?.eventId || '').trim() || typeof this.ackSender !== 'function') return false;
    try {
      const sent = this.ackSender(event, stage, status, details) !== false;
      if (sent) {
        this.diagnostics.mark('acknowledgementsSent');
        this.emit(EVENTS.ACK_SENT, { eventId: event.eventId, stage, status });
      }
      return sent;
    } catch (error) {
      this.diagnostics.recordError(error);
      return false;
    }
  }

  getStatus() {
    const currentVersionResult = this.versionManager.getCurrentVersion();
    const currentLocalVersion = currentVersionResult?.data?.version || currentVersionResult?.version || null;
    const lastNotificationTime = this.diagnostics.lastNotificationAt ? Date.parse(this.diagnostics.lastNotificationAt) : 0;
    const displayTime = this.diagnostics.lastDisplayedAt ? Date.parse(this.diagnostics.lastDisplayedAt) : 0;
    return {
      state: this.state,
      latestNotification: this.latestNotification,
      queued: this.queue.list().length,
      currentLatestVersion: this.latestNotification?.latestVersion || null,
      currentLocalVersion,
      notificationAgeMs: lastNotificationTime ? Math.max(0, Date.now() - lastNotificationTime) : null,
      displayAgeMs: displayTime ? Math.max(0, Date.now() - displayTime) : null
    };
  }

  getDiagnostics() {
    return this.diagnostics.snapshot(this.getStatus());
  }
}

module.exports = UpdateNotificationManager;
