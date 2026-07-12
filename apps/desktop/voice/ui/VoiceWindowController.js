'use strict';

const VoiceConfiguration = require('./VoiceConfiguration');
const VoiceOverlayIPC = require('./VoiceOverlayIPC');
const { OverlayCreationFailed, RendererUnavailable } = require('./VoiceUIErrors');

/**
 * Purpose: Owns the floating Voice overlay Electron window.
 * Responsibility: Create, position, show, hide, focus, z-order, transparency, and renderer updates.
 * Dependencies: Electron BrowserWindow/screen supplied through dependency injection and VoiceOverlayIPC.
 * Lifecycle: Created lazily, kept lightweight, hidden when not needed, destroyed during runtime cleanup.
 * Future extension notes: Do not add speech recognition, microphone capture, NLP, or command execution here.
 */
class VoiceWindowController {
  /**
   * Create a Voice window controller.
   * @param {{BrowserWindow?: Function, screen?: object, configuration?: object|VoiceConfiguration, ipc?: VoiceOverlayIPC, preloadPath?: string, logger?: object}} dependencies Controller dependencies.
   */
  constructor(dependencies = {}) {
    this.BrowserWindow = dependencies.BrowserWindow || null;
    this.screen = dependencies.screen || null;
    this.configuration = dependencies.configuration instanceof VoiceConfiguration
      ? dependencies.configuration
      : new VoiceConfiguration(dependencies.configuration || {});
    this.ipc = dependencies.ipc || new VoiceOverlayIPC({ logger: dependencies.logger });
    this.preloadPath = dependencies.preloadPath || '';
    this.logger = dependencies.logger || null;
    this.window = null;
    this.visible = false;
    this.lastView = null;
    this.sizeMode = 'compact';
    this.activeSize = { ...this.configuration.size };
    this.resizeTimer = null;
    this.boundsAnimationTimer = null;
    this.resultRevealTimer = null;
    this.resultAutoHideTimer = null;
    this.resultDismissTimer = null;
    this.pendingSizeMode = null;
    this.pendingSize = null;
    this.lastBounds = null;
    this.resultSticky = false;
    this.pendingOverlayOperations = new Map();
    this.overlayFlushAttached = false;
  }

  /**
   * Create the Electron overlay window when needed.
   * @returns {object}
   */
  createWindow() {
    if (this.window && !this._isDestroyed(this.window)) return this.window;
    if (typeof this.BrowserWindow !== 'function') {
      throw new OverlayCreationFailed('Voice overlay window cannot be created without BrowserWindow.');
    }
    const { width, height } = this.configuration.size;
    try {
      this.window = new this.BrowserWindow({
        width,
        height,
        minWidth: width,
        minHeight: height,
        transparent: true,
        frame: false,
        resizable: false,
        maximizable: false,
        minimizable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        focusable: true,
        show: false,
        hasShadow: true,
        backgroundColor: '#00000000',
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          preload: this.preloadPath || undefined
        }
      });
      this.ipc.attach(this.window.webContents);
      this._attachWindowRecovery(this.window);
      this._loadRenderer();
      this._applySizeMode('compact', { snap: true });
      this._log('Overlay Window Created');
      return this.window;
    } catch (error) {
      throw new OverlayCreationFailed('Voice overlay window creation failed.', {
        details: { error: error.message }
      });
    }
  }

  /**
   * Position the overlay centered horizontally and slightly above screen center.
   * @returns {{x: number, y: number, width: number, height: number}}
   */
  position(size = this._currentSize(), options = {}) {
    const win = this.window;
    if (!win || this._isDestroyed(win)) {
      throw new RendererUnavailable('Voice overlay window is unavailable.');
    }
    const { width, height } = size;
    const display = this._getTargetDisplay();
    const area = display.workArea || display.bounds || { x: 0, y: 0, width: 1280, height: 720 };
    const vertical = String(this.configuration.position?.vertical || 'top').toLowerCase();
    const yOffset = Number(this.configuration.position?.yOffset || 0);
    const y = vertical === 'top'
      ? area.y + yOffset
      : area.y + ((area.height - height) / 2) + yOffset;
    const bounds = {
      x: Math.round(area.x + ((area.width - width) / 2)),
      y: Math.round(y),
      width,
      height
    };
    if (this._boundsEqual(this.lastBounds, bounds)) return bounds;
    this._moveToBounds(bounds, options);
    return bounds;
  }

  /**
   * Show the overlay without stealing permanent focus.
   * @param {object} view Renderer view payload.
   * @returns {{visible: boolean, view: object}}
   */
  show(view = {}) {
    const win = this.createWindow();
    this._setSizeMode('compact', { immediate: true, snap: true });
    if (typeof win.setAlwaysOnTop === 'function') win.setAlwaysOnTop(true, 'screen-saver');
    if (typeof win.showInactive === 'function') win.showInactive();
    else if (typeof win.show === 'function') win.show();
    this.visible = true;
    this.updateState(view);
    this._sendOverlayOperation(VoiceOverlayIPC.OPERATIONS.SHOW_OVERLAY, { view });
    this._log('Overlay Shown', { state: view.state });
    return { visible: true, view };
  }

  /**
   * Hide the overlay.
   * @returns {{visible: boolean}}
   */
  hide() {
    if (this.window && !this._isDestroyed(this.window) && typeof this.window.hide === 'function') {
      this.window.hide();
    }
    this.visible = false;
    this._setSizeMode('compact', { immediate: true, snap: true });
    if (this.window && !this._isDestroyed(this.window)) {
      this._sendOverlayOperation(VoiceOverlayIPC.OPERATIONS.HIDE_OVERLAY, {});
    }
    this._log('Overlay Hidden');
    return { visible: false };
  }

  /**
   * Update state payload.
   * @param {object} view Renderer view payload.
   * @returns {{updated: boolean, view: object}}
   */
  updateState(view = {}) {
    this.lastView = view;
    if (this.window && !this._isDestroyed(this.window)) {
      this._sendOverlayOperation(VoiceOverlayIPC.OPERATIONS.UPDATE_STATE, { view });
      if (this._shouldCollapseForState(view?.state)) {
        if (this.resultSticky) {
          return { updated: true, view };
        }
        this._clearResultTimers();
        this._setSizeMode('compact', { delayMs: 140 });
        this._sendOverlayOperation(VoiceOverlayIPC.OPERATIONS.DISPLAY_ASSISTANT_RESULT, {});
      }
    }
    return { updated: true, view };
  }

  /**
   * Update transcript payload.
   * @param {object} transcript Transcript payload.
   * @returns {{updated: boolean, transcript: object}}
   */
  updateTranscript(transcript = {}) {
    if (this.window && !this._isDestroyed(this.window)) {
      if (transcript?.partial || transcript?.transcript) {
        this._setSizeMode('compact', { delayMs: 90 });
      }
      this._sendOverlayOperation(VoiceOverlayIPC.OPERATIONS.UPDATE_TRANSCRIPT, transcript);
    }
    return { updated: true, transcript };
  }

  /**
   * Update assistant result presentation payload.
   * @param {object} payload Renderer-safe assistant result payload.
   * @returns {{updated: boolean, payload: object}}
   */
  updateAssistantResult(payload = {}) {
    const hasPayload = this._hasAssistantResultPayload(payload);
    if (hasPayload && (!this.window || this._isDestroyed(this.window))) {
      this.createWindow();
    }
    if (this.window && !this._isDestroyed(this.window)) {
      this._clearResultTimers();
      if (!hasPayload) {
        this.resultSticky = false;
        this._setSizeMode('compact', { delayMs: 120 });
        this._sendOverlayOperation(VoiceOverlayIPC.OPERATIONS.DISPLAY_ASSISTANT_RESULT, {});
        return { updated: true, payload };
      }
      this.resultSticky = payload.persistUntilAction === true;

      if (!this.visible) {
        if (typeof this.window.setAlwaysOnTop === 'function') this.window.setAlwaysOnTop(true, 'screen-saver');
        if (typeof this.window.showInactive === 'function') this.window.showInactive();
        else if (typeof this.window.show === 'function') this.window.show();
        this.visible = true;
        this._setSizeMode('compact', { immediate: true, snap: true });
      }

      const displayMode = this._sizeModeForAssistantResult(payload);
      const previewStatus = String(payload.previewStatus || payload.heading || 'OpenX');
      const previewState = String(payload.presentationState || this.lastView?.state || 'READY');
      const revealDelayMs = Math.max(0, Math.min(1000, Number(payload.preExpandDelayMs) || 80));
      if (revealDelayMs > 0 && this.sizeMode !== 'compact') {
        this._setSizeMode('compact', { delayMs: 0 });
      }
      this._sendOverlayOperation(VoiceOverlayIPC.OPERATIONS.UPDATE_STATE, {
        view: {
          ...(this.lastView || {}),
          state: previewState,
          title: 'OpenX',
          statusText: previewStatus,
          icon: payload.icon || this.lastView?.icon || 'OX'
        }
      });

      this.resultRevealTimer = setTimeout(() => {
        this.resultRevealTimer = null;
        this._setSizeMode(displayMode, {
          delayMs: 0,
          size: this._sizeForAssistantResult(payload, displayMode)
        });
        this._sendOverlayOperation(VoiceOverlayIPC.OPERATIONS.DISPLAY_ASSISTANT_RESULT, { ...payload, displayMode });
        const autoHideMs = Number(payload.autoHideMs) || 0;
        if (autoHideMs > 0 && !this.resultSticky) {
          this.resultAutoHideTimer = setTimeout(() => {
            this.resultAutoHideTimer = null;
            this._setSizeMode('compact', { delayMs: 120 });
            this._sendOverlayOperation(VoiceOverlayIPC.OPERATIONS.DISPLAY_ASSISTANT_RESULT, {});
          }, Math.max(1200, Math.min(30000, autoHideMs)));
          if (typeof this.resultAutoHideTimer.unref === 'function') this.resultAutoHideTimer.unref();
        }
      }, revealDelayMs);
      if (typeof this.resultRevealTimer.unref === 'function') this.resultRevealTimer.unref();
    }
    return { updated: true, payload };
  }

  collapseAssistantResult(options = {}) {
    if (!this.window || this._isDestroyed(this.window)) return { collapsed: false };
    this._clearResultTimers();
    this.resultSticky = false;
    const statusText = String(options.statusText || 'Done').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Done';
    const icon = String(options.icon || 'OK').replace(/\s+/g, '').trim().slice(0, 3).toUpperCase() || 'OK';
    this._setSizeMode('compact', { delayMs: 0 });
    this._sendOverlayOperation(VoiceOverlayIPC.OPERATIONS.DISPLAY_ASSISTANT_RESULT, {});
    this._sendOverlayOperation(VoiceOverlayIPC.OPERATIONS.UPDATE_STATE, {
      view: {
        ...(this.lastView || {}),
        state: String(options.state || this.lastView?.state || 'READY'),
        title: 'OpenX',
        statusText,
        icon
      }
    });
    const hideAfterMs = Math.max(0, Math.min(30000, Number(options.hideAfterMs) || 0));
    if (hideAfterMs > 0) {
      this.resultDismissTimer = setTimeout(() => {
        this.resultDismissTimer = null;
        this.hide();
      }, hideAfterMs);
      if (typeof this.resultDismissTimer.unref === 'function') this.resultDismissTimer.unref();
    }
    return { collapsed: true, hideAfterMs };
  }

  /**
   * Display an error payload.
   * @param {object} view Error view payload.
   * @returns {{displayed: boolean, view: object}}
   */
  displayError(view = {}) {
    if (!this.window || this._isDestroyed(this.window)) this.createWindow();
    this.visible = true;
    this._setSizeMode('compact', { immediate: true, snap: true });
    if (typeof this.window.showInactive === 'function') this.window.showInactive();
    this._sendOverlayOperation(VoiceOverlayIPC.OPERATIONS.DISPLAY_ERROR, { view });
    return { displayed: true, view };
  }

  /**
   * Destroy the overlay window.
   * @returns {{destroyed: boolean}}
   */
  destroy() {
    if (this.window && !this._isDestroyed(this.window) && typeof this.window.destroy === 'function') {
      this.window.destroy();
    }
    this.window = null;
    this.visible = false;
    this._clearResizeTimer();
    this._clearBoundsAnimation();
    this._clearResultTimers();
    this.pendingOverlayOperations.clear();
    this.overlayFlushAttached = false;
    return { destroyed: true };
  }

  /**
   * Return controller status.
   * @returns {{created: boolean, visible: boolean, bounds: object|null}}
   */
  getStatus() {
    return {
      created: Boolean(this.window && !this._isDestroyed(this.window)),
      visible: this.visible,
      bounds: this.window && typeof this.window.getBounds === 'function' ? this.window.getBounds() : null
    };
  }

  /**
   * Load a lightweight built-in overlay renderer.
   * @returns {void}
   * @private
   */
  _loadRenderer() {
    if (!this.window?.loadURL) return;
    const html = this._createRendererHtml();
    const url = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    this.window.loadURL(url).catch?.(error => {
      this._log('Overlay Renderer Load Failed', { error: error.message });
    });
  }

  /**
   * Keep overlay renderer failures from leaving stale voice UI state behind.
   * @param {object} win Electron BrowserWindow-like object.
   * @returns {void}
   * @private
   */
  _attachWindowRecovery(win) {
    if (!win?.webContents || typeof win.webContents.on !== 'function') return;
    win.webContents.on('render-process-gone', (_event, details = {}) => {
      this._log('Overlay Renderer Exited', { reason: details.reason || 'unknown' });
      this.visible = false;
      this.window = null;
      if (typeof win.destroy === 'function' && !this._isDestroyed(win)) {
        win.destroy();
      }
    });
    if (typeof win.on === 'function') {
      win.on('unresponsive', () => {
        this._log('Overlay Renderer Unresponsive');
        try {
          win.webContents.reloadIgnoringCache?.();
        } catch (error) {
          this._log('Overlay Renderer Reload Failed', { error: error.message });
        }
      });
    }
  }

  /**
   * Create the built-in overlay HTML shell.
   * @returns {string}
   * @private
   */
  _createRendererHtml() {
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'self';">
<style>
:root { --voice-bg: #000; --voice-text: #f7f8fb; --voice-muted: rgba(247,248,251,.66); --voice-accent: #4488ff; --voice-border: rgba(255,255,255,.08); --voice-blur: 0px; --voice-ease: cubic-bezier(.16,1,.3,1); }
html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: transparent; font-family: Segoe UI, system-ui, sans-serif; color: var(--voice-text); -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
body { animation: overlay-in 220ms var(--voice-ease) both; }
#voice-overlay { box-sizing: border-box; height: 100vh; padding: 7px 13px; border: 1px solid var(--voice-border); border-radius: 999px; background: #000; box-shadow: 0 12px 30px rgba(0,0,0,.40), inset 0 1px 1px rgba(255,255,255,.08); display: grid; grid-template-columns: 34px minmax(0,1fr); gap: 9px; align-items: center; contain: layout paint style; transform: translate3d(0,0,0); transition: border-radius 360ms var(--voice-ease), box-shadow 360ms var(--voice-ease), padding 360ms var(--voice-ease), grid-template-columns 360ms var(--voice-ease), gap 360ms var(--voice-ease); will-change: transform, opacity; }
#voice-overlay.expanded { padding: 17px; border-radius: 32px; grid-template-columns: 46px minmax(0,1fr); align-items: start; box-shadow: 0 22px 68px rgba(0,0,0,.48), inset 0 1px 1px rgba(255,255,255,.10); }
#voice-overlay.expanded.medium { padding: 13px 15px; border-radius: 26px; grid-template-columns: 40px minmax(0,1fr); gap: 10px; align-items: center; box-shadow: 0 18px 48px rgba(0,0,0,.42), inset 0 1px 1px rgba(255,255,255,.10); }
#voice-overlay section { min-width: 0; overflow: hidden; }
#icon { width: 32px; height: 32px; border-radius: 999px; display: grid; place-items: center; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.10); font-size: 11px; font-weight: 750; transform: translate3d(0,0,0); transition: width 320ms var(--voice-ease), height 320ms var(--voice-ease), border-radius 320ms var(--voice-ease), transform 320ms var(--voice-ease), opacity 320ms var(--voice-ease), border-color 320ms var(--voice-ease); will-change: transform, opacity; }
#voice-overlay.expanded #icon { width: 48px; height: 48px; border-radius: 18px; background: color-mix(in srgb, var(--voice-accent) 18%, transparent); border-color: color-mix(in srgb, var(--voice-accent) 36%, transparent); font-size: 13px; }
#voice-overlay.expanded.medium #icon { width: 40px; height: 40px; border-radius: 14px; font-size: 12px; }
#title { display: none; font-size: 15px; font-weight: 650; line-height: 1.25; }
#voice-overlay.expanded #title { display: block; }
#voice-overlay.expanded.medium #title { display: none; }
#status { color: var(--voice-text); font-size: 13px; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#voice-overlay.expanded #status { color: var(--voice-muted); margin-top: 3px; }
#voice-overlay.expanded.medium #status { margin-top: 0; color: var(--voice-text); }
#transcript { margin-top: 2px; min-height: 0; max-width: 100%; color: var(--voice-muted); font-size: 12px; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transform: translate3d(0,0,0); transition: opacity 160ms var(--voice-ease), transform 160ms var(--voice-ease); will-change: opacity, transform; }
#voice-overlay.expanded #transcript { margin-top: 10px; min-height: 20px; color: var(--voice-text); font-size: 14px; line-height: 1.35; }
#voice-overlay.expanded.medium #transcript { margin-top: 3px; min-height: 0; color: var(--voice-muted); font-size: 12px; line-height: 1.2; white-space: nowrap; }
#assistant-response { margin-top: 10px; max-height: calc(100vh - 92px); overflow: hidden auto; padding: 0 1px 1px 0; opacity: 0; transform: translate3d(0, 8px, 0) scale(.992); transform-origin: top center; transition: opacity 260ms var(--voice-ease), transform 260ms var(--voice-ease); will-change: opacity, transform; contain: layout paint style; scrollbar-width: none; -ms-overflow-style: none; overscroll-behavior: contain; }
#assistant-response::-webkit-scrollbar { width: 0; height: 0; display: none; }
#assistant-response.visible { opacity: 1; transform: translate3d(0,0,0); }
#voice-overlay.expanded.medium #assistant-response { margin-top: 6px; max-height: 74px; overflow: hidden; padding-right: 0; }
.voice-response-heading { margin-bottom: 6px; color: rgba(247,248,251,.58); font-size: 10.5px; font-weight: 800; letter-spacing: .06em; line-height: 1.1; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#voice-overlay.expanded.medium .voice-response-heading { margin-bottom: 4px; color: rgba(247,248,251,.74); }
#voice-overlay.schedule-due-result section { overflow: visible; }
#voice-overlay.schedule-due-result #assistant-response { width: calc(100vw - 34px); max-width: calc(100vw - 34px); margin-left: -55px; }
#voice-overlay.schedule-due-result .voice-response-heading { max-width: 320px; margin-left: auto; margin-right: auto; text-align: center; }
.voice-response-text { font-size: 13.5px; line-height: 1.42; color: var(--voice-text); overflow-wrap: break-word; }
#voice-overlay.expanded.medium .voice-response-text { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; font-size: 12.7px; line-height: 1.32; }
.voice-content-summary { display: inline-flex; align-items: center; min-height: 22px; margin-top: 10px; padding: 0 9px; border: 1px solid rgba(255,255,255,.10); border-radius: 999px; color: rgba(247,248,251,.72); background: rgba(255,255,255,.06); font-size: 11px; font-weight: 750; }
.voice-card-list { display: grid; gap: 8px; margin: 8px 0 0; padding: 0; list-style: none; }
.voice-card { display: grid; grid-template-columns: 26px minmax(0,1fr); gap: 9px; align-items: start; padding: 9px 10px; border-radius: 15px; border: 1px solid rgba(255,255,255,.13); background: linear-gradient(145deg, rgba(255,255,255,.105), rgba(255,255,255,.055)); box-shadow: inset 0 1px 0 rgba(255,255,255,.08); contain: layout paint style; transform: translateZ(0); }
.voice-card-number { width: 24px; height: 24px; border-radius: 9px; display: grid; place-items: center; color: var(--voice-text); background: color-mix(in srgb, var(--voice-accent) 28%, transparent); border: 1px solid color-mix(in srgb, var(--voice-accent) 45%, transparent); font-size: 12px; font-weight: 700; }
.voice-card-body { min-width: 0; display: block; }
.voice-card strong { display: -webkit-box; min-width: 0; color: rgba(247,248,251,.96); font-size: 13px; line-height: 1.25; overflow: hidden; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.voice-card small { display: -webkit-box; margin-top: 4px; color: var(--voice-muted); font-size: 11px; line-height: 1.28; overflow: hidden; overflow-wrap: anywhere; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.voice-card-path { color: rgba(247,248,251,.52); font-family: Consolas, 'Courier New', monospace; }
.voice-schedule-due { display: grid; gap: 8px; margin-top: 7px; padding: 11px 12px; border-radius: 17px; border: 1px solid rgba(255,255,255,.12); background: linear-gradient(145deg, rgba(255,255,255,.105), rgba(255,255,255,.045)); box-shadow: inset 0 1px 0 rgba(255,255,255,.08); contain: layout paint style; }
#voice-overlay.schedule-due-result .voice-schedule-due { width: min(320px, 100%); margin-left: auto; margin-right: auto; box-sizing: border-box; }
.voice-schedule-due-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-width: 0; }
.voice-schedule-kind { min-width: 0; color: rgba(247,248,251,.62); font-size: 10.5px; font-weight: 850; letter-spacing: .05em; overflow: hidden; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
.voice-schedule-time { flex: 0 0 auto; padding: 3px 8px; border-radius: 999px; color: rgba(247,248,251,.9); background: color-mix(in srgb, var(--voice-accent) 24%, rgba(255,255,255,.06)); border: 1px solid color-mix(in srgb, var(--voice-accent) 36%, transparent); font-size: 11px; font-weight: 800; }
.voice-schedule-title { display: -webkit-box; color: rgba(247,248,251,.98); font-size: 15px; line-height: 1.28; overflow: hidden; overflow-wrap: anywhere; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
.voice-schedule-meta { display: flex; flex-wrap: wrap; gap: 6px; }
.voice-schedule-meta span { min-width: 0; max-width: 100%; padding: 4px 8px; border-radius: 999px; color: rgba(247,248,251,.72); background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.09); font-size: 11px; line-height: 1.1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.voice-action-row { position: sticky; bottom: 0; z-index: 2; display: grid; grid-template-columns: repeat(auto-fit, minmax(104px, 1fr)); gap: 9px; margin-top: 14px; padding: 12px 0 1px; background: linear-gradient(180deg, rgba(0,0,0,0), #000 30%); }
#voice-overlay.schedule-due-result .voice-action-row { width: min(336px, 100%); margin-left: auto; margin-right: auto; }
.voice-action { min-width: 0; height: 40px; border: 1px solid rgba(255,255,255,.16); border-radius: 999px; background: rgba(255,255,255,.092); color: var(--voice-text); font: inherit; font-size: 12px; font-weight: 850; cursor: pointer; transform: translate3d(0,0,0); transition: transform 180ms var(--voice-ease), background 180ms var(--voice-ease), border-color 180ms var(--voice-ease), opacity 180ms var(--voice-ease), filter 180ms var(--voice-ease); touch-action: manipulation; user-select: none; }
.voice-action:hover { background: rgba(255,255,255,.14); border-color: rgba(255,255,255,.24); }
.voice-action:focus-visible { outline: 2px solid color-mix(in srgb, var(--voice-accent) 70%, white); outline-offset: 2px; }
.voice-action:active { transform: translate3d(0,1px,0) scale(.972); }
.voice-action.primary { background: color-mix(in srgb, var(--voice-accent) 34%, rgba(255,255,255,.08)); border-color: color-mix(in srgb, var(--voice-accent) 50%, transparent); }
.voice-action-row.is-resolving .voice-action:not([data-active]) { opacity: .32; filter: saturate(.6); }
.voice-action[disabled] { cursor: default; }
.voice-action[disabled][data-active] { opacity: 1; transform: scale(.985); background: color-mix(in srgb, var(--voice-accent) 42%, rgba(255,255,255,.08)); border-color: color-mix(in srgb, var(--voice-accent) 62%, transparent); }
.listening #icon { animation: pulse 1.4s var(--voice-ease) infinite; }
.processing #icon { animation: pulse 1.7s var(--voice-ease) infinite; }
.error #icon { color: #ffb1b1; border-color: rgba(255,120,120,.45); }
@keyframes overlay-in { from { opacity: 0; transform: translate3d(0, 8px, 0) scale(.985); } to { opacity: 1; transform: none; } }
@keyframes pulse { 0%,100% { transform: translateZ(0) scale(1); opacity: .78; } 50% { transform: translateZ(0) scale(1.055); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style>
</head>
<body>
<main id="voice-overlay" role="status" aria-live="polite">
  <div id="icon">JA</div>
  <section>
    <div id="title">Starting</div>
    <div id="status">Initializing voice...</div>
    <div id="transcript"></div>
    <div id="assistant-response" aria-live="polite"></div>
  </section>
</main>
</body>
</html>`;
  }

  /**
   * Return target display for positioning.
   * @returns {object}
   * @private
   */
  _getTargetDisplay() {
    if (this.screen?.getDisplayNearestPoint && this.screen?.getCursorScreenPoint) {
      return this.screen.getDisplayNearestPoint(this.screen.getCursorScreenPoint());
    }
    if (this.screen?.getPrimaryDisplay) return this.screen.getPrimaryDisplay();
    return { workArea: { x: 0, y: 0, width: 1280, height: 720 } };
  }

  _sendOverlayOperation(operation, payload = {}) {
    const contents = this.window?.webContents;
    if (
      contents &&
      typeof contents.isLoading === 'function' &&
      contents.isLoading() &&
      typeof contents.once === 'function'
    ) {
      this.pendingOverlayOperations.set(operation, payload);
      if (!this.overlayFlushAttached) {
        this.overlayFlushAttached = true;
        contents.once('did-finish-load', () => this._flushPendingOverlayOperations());
      }
      return { sent: false, queued: true, operation };
    }
    return this.ipc.send(operation, payload);
  }

  _flushPendingOverlayOperations() {
    this.overlayFlushAttached = false;
    if (!this.window || this._isDestroyed(this.window) || this.pendingOverlayOperations.size === 0) {
      this.pendingOverlayOperations.clear();
      return;
    }
    const pending = Array.from(this.pendingOverlayOperations.entries());
    this.pendingOverlayOperations.clear();
    for (const [operation, payload] of pending) {
      this.ipc.send(operation, payload);
    }
  }

  _currentSize() {
    if (this.activeSize) return this.activeSize;
    if (this.sizeMode === 'expanded') return { ...this.configuration.expandedSize };
    if (this.sizeMode === 'medium') return { ...this.configuration.mediumSize };
    return this.configuration.size;
  }

  _setSizeMode(mode = 'compact', options = {}) {
    const nextMode = ['medium', 'expanded'].includes(mode) ? mode : 'compact';
    if (!this.window || this._isDestroyed(this.window)) return null;
    const nextSize = this._normalizeSize(options.size || this._defaultSizeForMode(nextMode));
    if (options.immediate) {
      this._clearResizeTimer();
      return this._applySizeMode(nextMode, { size: nextSize, snap: options.snap });
    }
    this._clearResizeTimer();
    this.pendingSizeMode = nextMode;
    this.pendingSize = nextSize;
    this.resizeTimer = setTimeout(() => {
      this.resizeTimer = null;
      const pending = this.pendingSizeMode;
      const pendingSize = this.pendingSize;
      this.pendingSizeMode = null;
      this.pendingSize = null;
      this._applySizeMode(pending, { size: pendingSize, snap: options.snap });
    }, Math.max(0, Number(options.delayMs) || 16));
    if (typeof this.resizeTimer.unref === 'function') this.resizeTimer.unref();
    return null;
  }

  _applySizeMode(mode = 'compact', options = {}) {
    const nextMode = ['medium', 'expanded'].includes(mode) ? mode : 'compact';
    const nextSize = this._normalizeSize(options.size || this._defaultSizeForMode(nextMode));
    this.sizeMode = nextMode;
    this.activeSize = nextSize;
    return this.position(this._currentSize(), { snap: Boolean(options.snap) });
  }

  _clearResizeTimer() {
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }
    this.pendingSizeMode = null;
    this.pendingSize = null;
  }

  _clearBoundsAnimation() {
    if (this.boundsAnimationTimer) {
      clearTimeout(this.boundsAnimationTimer);
      this.boundsAnimationTimer = null;
    }
  }

  _clearResultTimers() {
    if (this.resultRevealTimer) {
      clearTimeout(this.resultRevealTimer);
      this.resultRevealTimer = null;
    }
    if (this.resultAutoHideTimer) {
      clearTimeout(this.resultAutoHideTimer);
      this.resultAutoHideTimer = null;
    }
    if (this.resultDismissTimer) {
      clearTimeout(this.resultDismissTimer);
      this.resultDismissTimer = null;
    }
  }

  _defaultSizeForMode(mode) {
    if (mode === 'expanded') return this.configuration.expandedSize;
    if (mode === 'medium') return this.configuration.mediumSize;
    return this.configuration.size;
  }

  _normalizeSize(size = {}) {
    const compact = this.configuration.size;
    const expanded = this.configuration.expandedSize;
    return {
      width: Math.max(compact.width, Math.min(expanded.width, Math.round(Number(size.width) || compact.width))),
      height: Math.max(compact.height, Math.min(expanded.height, Math.round(Number(size.height) || compact.height)))
    };
  }

  _sameSize(left, right) {
    return Boolean(left && right && left.width === right.width && left.height === right.height);
  }

  _moveToBounds(bounds, options = {}) {
    const win = this.window;
    if (!win || this._isDestroyed(win) || typeof win.setBounds !== 'function') return;
    this._clearBoundsAnimation();
    const start = this.lastBounds || (typeof win.getBounds === 'function' ? win.getBounds() : null);
    if (options.snap || !start || this._boundsEqual(start, bounds)) {
      win.setBounds(bounds, true);
      this.lastBounds = bounds;
      return;
    }

    const duration = Math.max(180, Math.min(420, Number(this.configuration.animationDurationMs) || 320));
    const startedAt = Date.now();
    let lastFrame = null;
    const step = () => {
      if (!this.window || this._isDestroyed(this.window)) {
        this.boundsAnimationTimer = null;
        return;
      }
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const frame = {
        x: Math.round(start.x + ((bounds.x - start.x) * eased)),
        y: Math.round(start.y + ((bounds.y - start.y) * eased)),
        width: Math.round(start.width + ((bounds.width - start.width) * eased)),
        height: Math.round(start.height + ((bounds.height - start.height) * eased))
      };
      if (!this._boundsEqual(lastFrame, frame)) {
        try {
          win.setBounds(frame, false);
        } catch (error) {
          this.boundsAnimationTimer = null;
          this._log('Overlay Bounds Animation Failed', { error: error.message });
          return;
        }
        lastFrame = frame;
      }
      if (progress < 1) {
        this.boundsAnimationTimer = setTimeout(step, 16);
        if (typeof this.boundsAnimationTimer.unref === 'function') this.boundsAnimationTimer.unref();
        return;
      }
      this.boundsAnimationTimer = null;
      try {
        win.setBounds(bounds, true);
      } catch (error) {
        this._log('Overlay Bounds Finalize Failed', { error: error.message });
        return;
      }
      this.lastBounds = bounds;
    };
    step();
  }

  _boundsEqual(left, right) {
    return Boolean(left && right &&
      left.x === right.x &&
      left.y === right.y &&
      left.width === right.width &&
      left.height === right.height);
  }

  _sizeModeForAssistantResult(payload = {}) {
    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const resultEntries = Array.isArray(payload.resultEntries) ? payload.resultEntries : [];
    const response = String(payload.response || '');
    if (payload.intent === 'schedule.due') return 'expanded';
    if (choices.length > 0 || resultEntries.length > 0 || response.length > 220) return 'expanded';
    if (response.length > 0) return 'medium';
    return 'compact';
  }

  _hasAssistantResultPayload(payload = {}) {
    return Boolean(String(payload.response || '').trim()) ||
      Boolean(String(payload.heading || '').trim()) ||
      (Array.isArray(payload.resultEntries) && payload.resultEntries.length > 0) ||
      (Array.isArray(payload.choices) && payload.choices.length > 0) ||
      (Array.isArray(payload.actions) && payload.actions.length > 0);
  }

  _sizeForAssistantResult(payload = {}, mode = this._sizeModeForAssistantResult(payload)) {
    if (mode === 'compact') return this.configuration.size;
    if (mode === 'medium') return this.configuration.mediumSize;

    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const resultEntries = Array.isArray(payload.resultEntries) ? payload.resultEntries : [];
    const responseLength = String(payload.response || '').trim().length;
    const cardCount = Math.min(4, Math.max(0, choices.length || resultEntries.length));
    const actionCount = Array.isArray(payload.actions) ? Math.min(3, payload.actions.length) : 0;
    const hasHeading = String(payload.heading || '').trim().length > 0;
    const hasSummary = cardCount > 0;
    const hasScheduleDue = payload.intent === 'schedule.due';
    const responseLines = Math.min(5, Math.ceil(responseLength / 52));
    const baseHeight = 94 +
      (hasHeading ? 18 : 0) +
      (responseLength > 0 ? Math.max(24, responseLines * 19) : 0) +
      (hasScheduleDue ? 82 : 0) +
      (hasSummary ? 30 : 0) +
      (actionCount > 0 ? 54 : 0);
    if (cardCount > 0) {
      return this._normalizeSize({
        width: 360,
        height: baseHeight + (cardCount * 58)
      });
    }
    return this._normalizeSize({
      width: 360,
      height: baseHeight + (responseLength > 260 ? 44 : 18)
    });
  }

  _shouldCollapseForState(state) {
    return ['LISTENING', 'READY', 'CLOSING', 'CANCELLED', 'IDLE'].includes(String(state || '').toUpperCase());
  }

  /**
   * Check Electron destroyed state.
   * @param {object} win BrowserWindow-like object.
   * @returns {boolean}
   * @private
   */
  _isDestroyed(win) {
    return Boolean(win && typeof win.isDestroyed === 'function' && win.isDestroyed());
  }

  /**
   * Write structured controller logs.
   * @param {string} message Log message.
   * @param {object} metadata Log metadata.
   * @returns {void}
   * @private
   */
  _log(message, metadata = {}) {
    if (this.logger && typeof this.logger.info === 'function') {
      this.logger.info(`[Voice UI] ${message}`, metadata);
    }
  }
}

module.exports = VoiceWindowController;
