const EventEmitter = require('events');
const EVENTS = require('./UpdatePresentationEvents');
const UpdatePresentationService = require('./UpdatePresentationService');
const UpdatePresentationLogger = require('./UpdatePresentationLogger');
const UpdatePresentationDiagnostics = require('./UpdatePresentationDiagnostics');

class UpdatePresentationManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.provider = options.provider || {};
    this.service = options.service || new UpdatePresentationService();
    this.logger = options.presentationLogger || new UpdatePresentationLogger({ logger: options.logger });
    this.diagnostics = options.diagnostics || new UpdatePresentationDiagnostics();
    this.latest = null;
  }

  getPresentation(context = {}) {
    if (context.source === 'settings') {
      this.diagnostics.mark('uiOpenCount');
      this.diagnostics.mark('settingsVisits');
      this.emit(EVENTS.UI_OPENED, context);
    }
    const snapshot = this.provider.getSnapshot?.() || {};
    this.latest = this.service.build(snapshot);
    this.emit(EVENTS.UPDATE_CARD_CREATED, this.latest.card);
    return this.latest;
  }

  getReleaseNotes() {
    return this.getPresentation({ source: 'release-notes' }).model.releaseNotes;
  }

  getProgress() {
    const progress = this.getPresentation({ source: 'progress' }).model.progress;
    this.emit(EVENTS.PROGRESS_UPDATED, progress);
    return progress;
  }

  getActions() {
    return this.getPresentation({ source: 'actions' }).model.actions;
  }

  getStatus() {
    return {
      latest: this.latest,
      diagnostics: this.diagnostics.snapshot()
    };
  }

  getDiagnostics() {
    return this.diagnostics.snapshot();
  }

  async executeAction(actionId, payload = {}) {
    const id = String(actionId || payload.actionId || '').trim();
    this.diagnostics.mark('buttonUsage', id);
    this.emit(EVENTS.ACTION_CLICKED, { actionId: id, payload });
    try {
      const result = await this.provider.executeAction?.(id, payload);
      return {
        success: result?.success !== false,
        actionId: id,
        result,
        presentation: this.getPresentation({ source: 'action' })
      };
    } catch (error) {
      this.diagnostics.recordError(error);
      this.emit(EVENTS.ERROR, { actionId: id, error: error.message });
      return { success: false, actionId: id, error: error.message };
    }
  }

  assistantRequest(command = '', source = 'assistant') {
    this.diagnostics.mark(source === 'voice' ? 'voiceRequests' : 'assistantRequests');
    this.emit(source === 'voice' ? EVENTS.VOICE_REQUEST : EVENTS.ASSISTANT_REQUEST, { command });
    return this.getPresentation({ source });
  }
}

module.exports = UpdatePresentationManager;
