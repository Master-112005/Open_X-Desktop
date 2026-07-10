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
    return this.session.ensureReady(options);
  }

  async searchContacts(recipient, options = {}) {
    const query = cleanText(recipient);
    if (!query) {
      return fail(new ContactResolutionError(this.id, 'Recipient is required'));
    }

    const page = options.page || await this.ensureReady(options.readyOptions || options);
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
    const page = await this.ensureReady();
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
    return ok({
      provider: this.id,
      draftId,
      delivery: 'sent'
    });
  }

  async cancel(draftId) {
    const draft = this.preparedDrafts.get(draftId);
    if (!draft) return ok({ provider: this.id, draftId, cancelled: true });
    const page = await this.session.getPage();
    const box = await this._waitForMessageBox(page);
    if (box) {
      await box.click();
      await this._clearEditable(page);
    }
    this.preparedDrafts.delete(draftId);
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

  async _readSearchResults(page, query) {
    const matches = [];
    const target = normalize(query);
    const selector = '[role="row"][data-testid^="list-item-"]';
    const rows = page.locator(selector);
    const count = Math.min(await rows.count(), 8);
    for (let index = 0; index < count; index += 1) {
      const row = rows.nth(index);
      if (!await row.isVisible()) continue;
      const raw = cleanText(await row.textContent().catch(() => ''));
      const name = this._extractContactName(raw, query);
      if (!name) continue;
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

  _extractContactName(raw, query) {
    const text = cleanText(raw);
    if (!text) return '';
    const parts = text
      .split(/\n| {2,}/)
      .map(cleanText)
      .filter(Boolean);
    const queryNorm = normalize(query);
    const exact = parts.find(part => normalize(part) === queryNorm);
    if (exact) return exact;
    return parts.find(part => normalize(part).includes(queryNorm)) || parts[0] || '';
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
