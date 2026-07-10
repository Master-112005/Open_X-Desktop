const crypto = require('crypto');
const CommunicationProvider = require('./CommunicationProvider');
const COMMUNICATION_EVENTS = require('./CommunicationEvents');
const WhatsAppSelectors = require('./WhatsAppSelectors');
const WhatsAppSessionManager = require('./WhatsAppSessionManager');
const { duplicateContacts, fail, ok } = require('./CommunicationResult');
const {
  ContactNotFoundError,
  ContactResolutionError,
  MessageDraftError,
  SearchBoxNotFoundError
} = require('./CommunicationErrors');

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalize(value) {
  return cleanText(value).toLowerCase();
}

const CONTACT_TITLE_SELECTORS = [
  '[data-testid="cell-frame-title"]',
  '[data-testid="chat-list-title"]',
  '[data-testid="conversation-title"]',
  'span[title]',
  '[title]'
];

class WhatsAppProvider extends CommunicationProvider {
  constructor(options = {}) {
    super({ ...options, id: 'whatsapp' });
    this.name = 'WhatsApp';
    this.session = options.session || new WhatsAppSessionManager(options);
    this.eventBus = options.eventBus || null;
    this.preparedDrafts = new Map();
    this.session.on?.(COMMUNICATION_EVENTS.QR_CODE_DETECTED, event => this._publish(COMMUNICATION_EVENTS.QR_CODE_DETECTED, event));
    this.session.on?.(COMMUNICATION_EVENTS.CONNECTED, event => this._publish(COMMUNICATION_EVENTS.CONNECTED, event));
    this.session.on?.(COMMUNICATION_EVENTS.DISCONNECTED, event => this._publish(COMMUNICATION_EVENTS.DISCONNECTED, event));
    this.session.on?.(COMMUNICATION_EVENTS.ERROR, event => this._publish(COMMUNICATION_EVENTS.ERROR, event));
  }

  async connect(options = {}) {
    await this.session.connect(options);
    this.session.touch?.();
    return this.health();
  }

  async disconnect() {
    await this.session.disconnect();
    return ok({ provider: this.id, state: 'disconnected' });
  }

  async isConnected() {
    return this.session.isConnected();
  }

  async health() {
    return this.session.health();
  }

  async ensureReady(options = {}) {
    const page = await this.session.ensureReady(options);
    this.session.touch?.();
    return page;
  }

  async searchContacts(recipient, options = {}) {
    const query = cleanText(recipient);
    if (!query) {
      return fail(new ContactResolutionError(this.id, 'Recipient is required'));
    }

    const page = options.page || await this.ensureReady(options.readyOptions || options);
    this.session.touch?.();
    const searchBox = await this._runStep('locate-search-box', () => this._resolveRequired(page, 'searchBox', 'search-box-not-found'));
    if (!searchBox.found) {
      return fail(new SearchBoxNotFoundError(this.id, {
        state: this.session.lastState,
        resolver: searchBox.report,
        diagnostics: searchBox.diagnostics
      }));
    }

    await this._runStep('focus-search-box', () => searchBox.locator.click());
    await this._runStep('clear-search-box', () => this._clearEditable(page));
    await this._runStep('enter-contact-name', () => searchBox.locator.fill(query).catch(() => page.keyboard.type(query)));
    await this._runStep('wait-for-search-results', () => page.waitForTimeout?.(700), 1500);

    const contacts = await this._runStep('read-search-results', () => this._readSearchResults(page, query));
    this.session.touch?.();
    return ok({
      provider: this.id,
      query,
      contacts
    });
  }

  async openConversation(contact, options = {}) {
    const page = options.page || await this._requireReadyPage(options.readyOptions || options);
    const selector = contact?.selector || null;
    const index = Number(contact?.index) || 0;
    let target = contact?.locator || null;
    if (!target && contact?.locatorSpec) {
      const locator = WhatsAppSelectors.locatorFor(page, contact.locatorSpec);
      target = locator?.nth(index) || null;
    } else if (!target && selector) {
      target = page.locator(selector).nth(index);
    } else if (!target) {
      const contacts = await this.searchContacts(contact?.name || contact, options);
      if (!contacts.success || contacts.data.contacts.length === 0) {
        return fail(new ContactNotFoundError(this.id, { contact: cleanText(contact) }));
      }
      return this.openConversation(contacts.data.contacts[0], options);
    }

    await this._runStep('open-conversation', () => target.click());
    const box = await this._runStep('locate-message-box', () => this._waitForMessageBox(page));
    if (!box) {
      const diagnostics = await this._captureDiagnostics('message-input-not-found');
      return fail(new ContactResolutionError(this.id, 'Conversation opened but message box was not found', { diagnostics }));
    }

    return ok({
      provider: this.id,
      contact: {
        id: contact?.id || contact?.name || cleanText(contact),
        name: contact?.name || cleanText(contact)
      }
    });
  }

  async composeMessage(recipient, messageText, options = {}) {
    const message = cleanText(messageText);
    if (!message) {
      return fail(new MessageDraftError(this.id, 'Message text is required'));
    }

    const page = options.page || await this.ensureReady(options.readyOptions || options);
    const operationOptions = { ...options, page };
    const contactsResult = await this.searchContacts(recipient, operationOptions);
    if (!contactsResult.success) return contactsResult;
    const contacts = contactsResult.data.contacts;
    if (contacts.length === 0) {
      return fail(new ContactNotFoundError(this.id, { contact: cleanText(recipient) }));
    }
    if (contacts.length > 1 && options.contactId === undefined) {
      this._publish(COMMUNICATION_EVENTS.DUPLICATE_CONTACTS, {
        provider: this.id,
        count: contacts.length
      });
      return duplicateContacts(this.id, cleanText(recipient), contacts);
    }

    const selected = options.contactId !== undefined
      ? contacts.find(contact => String(contact.id) === String(options.contactId)) || contacts[0]
      : contacts[0];
    const opened = await this.openConversation(selected, operationOptions);
    if (!opened.success) return opened;

    const box = await this._runStep('locate-draft-box', () => this._waitForMessageBox(page));
    if (!box) {
      const diagnostics = await this._captureDiagnostics('message-input-not-found');
      return fail(new MessageDraftError(this.id, 'Message box was not found', { diagnostics }));
    }
    await this._runStep('focus-message-box', () => box.click());
    await this._runStep('clear-message-box', () => this._clearEditable(page));
    await this._runStep('enter-message', () => box.fill(message).catch(() => page.keyboard.type(message)));

    const draftId = `wa_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const draft = {
      id: draftId,
      provider: this.id,
      recipient: selected.name,
      message,
      createdAt: new Date().toISOString(),
      contact: selected
    };
    this.preparedDrafts.set(draftId, draft);
    this._publish(COMMUNICATION_EVENTS.CONTACT_RESOLVED, { provider: this.id });
    this._publish(COMMUNICATION_EVENTS.MESSAGE_PREPARED, {
      provider: this.id,
      draftId
    });
    this._publish(COMMUNICATION_EVENTS.CONFIRMATION_REQUESTED, {
      provider: this.id,
      draftId,
      recipient: this.debug ? selected.name : undefined,
      message: this.debug ? message : undefined
    });
    this.session.touch?.();

    return ok({
      provider: this.id,
      platform: this.id,
      contactName: selected.name,
      messageText: message,
      draftId,
      delivery: 'draft',
      requiresFinalConfirmation: true
    });
  }

  async send(draftId) {
    const draft = this.preparedDrafts.get(draftId);
    if (!draft) return fail(new MessageDraftError(this.id, 'Message draft not found'));
    const needsRestore = this.session.isBrowserRunning?.() === false;
    const page = await this.ensureReady();
    if (needsRestore) {
      await this._restoreDraft(draft, page);
    }
    const sendButton = await this._resolveRequired(page, 'sendButton', 'send-button-not-found');
    if (!sendButton.found) {
      return fail(new MessageDraftError(this.id, 'WhatsApp send button was not found', {
        resolver: sendButton.report,
        diagnostics: sendButton.diagnostics
      }));
    }
    await sendButton.locator.click();
    this.preparedDrafts.delete(draftId);
    this._publish(COMMUNICATION_EVENTS.MESSAGE_SENT, {
      provider: this.id,
      draftId
    });
    await this._releaseSessionAfterTerminalOperation('message-sent');
    return ok({
      provider: this.id,
      draftId,
      delivery: 'sent'
    });
  }

  async cancel(draftId) {
    const draft = this.preparedDrafts.get(draftId);
    if (!draft) return ok({ provider: this.id, draftId, cancelled: true });
    const browserRunning = typeof this.session.isBrowserRunning === 'function'
      ? this.session.isBrowserRunning()
      : true;
    if (browserRunning) {
      const page = await this.session.getPage();
      const box = await this._waitForMessageBox(page);
      if (box) {
        await box.click();
        await this._clearEditable(page);
      }
    }
    this.preparedDrafts.delete(draftId);
    await this._releaseSessionAfterTerminalOperation('message-cancelled');
    return ok({
      provider: this.id,
      draftId,
      cancelled: true
    });
  }

  getDraft(draftId) {
    return this.preparedDrafts.get(draftId) || null;
  }

  hasPersistentSession() {
    return this.session.hasPersistentSession?.() === true;
  }

  async _requireReadyPage(options = {}) {
    return this.ensureReady(options);
  }

  async _restoreDraft(draft, page) {
    const contactsResult = await this.searchContacts(draft.recipient, { page });
    if (!contactsResult.success || contactsResult.data.contacts.length === 0) {
      throw new ContactNotFoundError(this.id, { contact: draft.recipient });
    }
    const selected = contactsResult.data.contacts.find(contact => String(contact.id) === String(draft.contact?.id)) ||
      contactsResult.data.contacts.find(contact => normalize(contact.name) === normalize(draft.recipient)) ||
      contactsResult.data.contacts[0];
    const opened = await this.openConversation(selected, { page });
    if (!opened.success) {
      throw new MessageDraftError(this.id, 'Unable to restore WhatsApp message draft');
    }
    const box = await this._runStep('restore-draft-box', () => this._waitForMessageBox(page));
    if (!box) {
      throw new MessageDraftError(this.id, 'WhatsApp message box was not found while restoring the draft');
    }
    await this._runStep('restore-draft-focus', () => box.click());
    await this._runStep('restore-draft-clear', () => this._clearEditable(page));
    await this._runStep('restore-draft-message', () => box.fill(draft.message).catch(() => page.keyboard.type(draft.message)));
    this.session.touch?.();
  }

  async _releaseSessionAfterTerminalOperation(reason) {
    if (typeof this.session.releaseAfterOperation === 'function') {
      await this.session.releaseAfterOperation(reason);
      return;
    }
    if (typeof this.session.disconnect === 'function') {
      await this.session.disconnect();
    }
  }

  async _readSearchResults(page, query) {
    const matches = [];
    const target = normalize(query);
    const selector = '[role="row"][data-testid^="list-item-"]';
    const rows = page.locator(selector);
    const count = Math.min(await rows.count(), 8);
    for (let index = 0; index < count; index += 1) {
      const row = rows.nth(index);
      if (!await row.isVisible()) continue;
      const raw = await row.textContent().catch(() => '');
      const title = await this._readCanonicalContactTitle(row);
      const name = title || this._extractContactName(raw, query);
      if (!name) continue;
      this._logContactNameExtraction({ raw, name, source: title ? 'title' : 'fallback' });
      const normalizedName = normalize(name);
      if (target && !normalizedName.includes(target) && !target.includes(normalizedName)) continue;
      const cell = row.locator?.('[data-testid="cell-frame-container"]');
      matches.push({
        id: `chat:${index}:${normalizedName}`,
        name,
        selector,
        index,
        locator: cell?.first?.() || cell || row
      });
    }
    return this._dedupeContacts(matches);
  }

  async _readCanonicalContactTitle(row) {
    if (!row || typeof row.locator !== 'function') return '';
    for (const selector of CONTACT_TITLE_SELECTORS) {
      const locator = row.locator(selector);
      const name = await this._readFirstCleanTitle(locator, selector);
      if (name) return name;
    }
    return '';
  }

  async _readFirstCleanTitle(locator, selector) {
    if (!locator) return '';
    const broadSelector = selector === 'span[title]' || selector === '[title]';
    const maxCandidates = broadSelector ? 4 : 1;
    let count = 1;
    if (typeof locator.count === 'function') {
      try {
        count = Math.min(await locator.count(), maxCandidates);
      } catch {
        count = 0;
      }
    }
    if (count <= 0) return '';
    for (let index = 0; index < count; index += 1) {
      const candidate = typeof locator.nth === 'function'
        ? locator.nth(index)
        : (typeof locator.first === 'function' ? locator.first() : locator);
      const title = await this._readSingleTitleValue(candidate);
      if (title) return title;
      if (typeof locator.nth !== 'function') break;
    }
    return '';
  }

  async _readSingleTitleValue(locator) {
    if (!locator) return '';
    if (typeof locator.getAttribute === 'function') {
      const title = cleanText(await locator.getAttribute('title').catch(() => ''));
      const cleanTitle = this._sanitizeContactTitle(title);
      if (cleanTitle) return cleanTitle;
    }
    if (typeof locator.textContent === 'function') {
      const text = cleanText(await locator.textContent().catch(() => ''));
      const cleanTitle = this._sanitizeContactTitle(text);
      if (cleanTitle) return cleanTitle;
    }
    return '';
  }

  _extractContactName(raw, query) {
    const text = String(raw || '');
    if (!text) return '';
    const parts = text
      .split(/\r?\n| {2,}/)
      .map(part => this._sanitizeContactTitle(part))
      .filter(Boolean);
    const whole = this._sanitizeContactTitle(text);
    if (whole) parts.unshift(whole);
    const queryNorm = normalize(query);
    const exact = parts.find(part => normalize(part) === queryNorm);
    if (exact) return exact;
    return parts.find(part => {
      const partNorm = normalize(part);
      return partNorm.includes(queryNorm) || queryNorm.includes(partNorm);
    }) || parts[0] || '';
  }

  _sanitizeContactTitle(value) {
    let text = cleanText(value);
    if (!text) return '';

    text = text
      .replace(/\b(?:wds|ic)(?:-[a-z0-9_]+)+\b/gi, ' ')
      .replace(/\s+(?:Yesterday|Today|Tomorrow).*$/i, '')
      .replace(/\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun),?.*$/i, '')
      .replace(/\s+\d{1,2}:\d{2}(?:\s?[AP]M)?.*$/i, '')
      .replace(/\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?.*$/i, '')
      .replace(/\s+(?:Photo|Image|Video|Audio|Document|Sticker|GIF|Voice message|Contact card|Location).*$/i, '')
      .replace(/\s+(?:Typing|Online|Read|Unread|Delivered|Sent|Seen|Status|Verified).*$/i, '')
      .replace(/\b(?:read|unread|delivered|sent|seen|status|verified|badge|image|photo|icon)\b/gi, ' ');

    return cleanText(text);
  }

  _logContactNameExtraction({ raw, name, source }) {
    if (!this.debug) return;
    this.logger.debug?.('[WhatsAppProvider] contact name extracted', {
      source,
      name,
      rawText: raw
    });
  }

  _dedupeContacts(contacts) {
    const seen = new Set();
    const output = [];
    for (const contact of contacts) {
      const key = normalize(contact.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      output.push(contact);
    }
    return output;
  }

  async _waitForMessageBox(page) {
    const result = await this._resolveRequired(page, 'messageInput', 'message-input-not-found');
    return result.found ? result.locator : null;
  }

  async _resolveRequired(page, name, reason) {
    const report = await WhatsAppSelectors.resolveElement(page, name, { timeoutMs: 250 });
    if (report.found) return report;
    const diagnostics = await this._captureDiagnostics(reason, report);
    return { ...report, diagnostics, report };
  }

  async _captureDiagnostics(reason, resolverReport = null) {
    if (!this.session.captureDiagnostics) return null;
    const snapshot = await this.session.detectState?.({ includeSnapshot: true }).catch(() => null);
    return this.session.captureDiagnostics(reason, snapshot, resolverReport).catch(error => ({
      error: error.message
    }));
  }

  async _clearEditable(page) {
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.press('Backspace');
  }

  async _runStep(step, work, timeoutMs = 3000) {
    const startedAt = Date.now();
    this.logger.info?.('[WhatsAppProvider] step started', { step, timeoutMs });
    let timer = null;
    try {
      const result = await Promise.race([
        Promise.resolve().then(work),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            const error = new Error(`WhatsApp ${step} timed out after ${timeoutMs}ms`);
            error.code = 'WHATSAPP_OPERATION_TIMEOUT';
            error.step = step;
            reject(error);
          }, timeoutMs);
        })
      ]);
      this.logger.info?.('[WhatsAppProvider] step completed', { step, durationMs: Date.now() - startedAt });
      return result;
    } catch (error) {
      this.logger.warn?.('[WhatsAppProvider] step failed', { step, durationMs: Date.now() - startedAt, error: error.message });
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  _publish(event, payload = {}) {
    const safePayload = {
      provider: this.id,
      ...payload
    };
    if (!this.debug) {
      delete safePayload.recipient;
      delete safePayload.message;
      delete safePayload.contactName;
    }
    this.eventBus?.publish?.(event, safePayload);
    this.emit?.(event, safePayload);
  }
}

module.exports = WhatsAppProvider;
