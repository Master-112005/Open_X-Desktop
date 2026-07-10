class CommunicationError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code || 'COMMUNICATION_ERROR';
    this.provider = options.provider || null;
    this.context = options.context || null;
    this.diagnostics = options.diagnostics || null;
    if (options.cause) this.cause = options.cause;
  }
}

class ProviderNotFoundError extends CommunicationError {
  constructor(provider) {
    super(`Communication provider not found: ${provider}`, {
      code: 'PROVIDER_NOT_FOUND',
      provider
    });
  }
}

class ProviderUnavailableError extends CommunicationError {
  constructor(provider, message) {
    super(message || `Communication provider unavailable: ${provider}`, {
      code: 'PROVIDER_UNAVAILABLE',
      provider
    });
  }
}

class SessionStateError extends CommunicationError {
  constructor(provider, state, message) {
    super(message || `Communication session is not ready: ${state}`, {
      code: 'SESSION_NOT_READY',
      provider,
      context: { state }
    });
  }
}

class BrowserNotRunningError extends CommunicationError {
  constructor(provider, context = {}) {
    super('WhatsApp browser is not running', {
      code: 'BROWSER_NOT_RUNNING',
      provider,
      context
    });
  }
}

class BrowserStartingError extends CommunicationError {
  constructor(provider, context = {}) {
    super('WhatsApp browser is still starting', {
      code: 'BROWSER_STARTING',
      provider,
      context
    });
  }
}

class QRLoginRequiredError extends CommunicationError {
  constructor(provider, context = {}) {
    super('WhatsApp QR login is required', {
      code: 'QR_LOGIN_REQUIRED',
      provider,
      context
    });
  }
}

class WhatsAppLoadingError extends CommunicationError {
  constructor(provider, context = {}) {
    super('WhatsApp Web is still loading', {
      code: 'WHATSAPP_LOADING',
      provider,
      context
    });
  }
}

function summarizeRequiredElements(context = {}) {
  const report = context.requiredElements || null;
  const found = report?.found?.length ? report.found.join(', ') : 'none';
  const missing = report?.missing?.length ? report.missing.join(', ') : 'unknown';
  const layout = context.layout || context.state || 'unknown';
  const url = context.pageUrl || 'unknown';
  const diagnostics = context.diagnostics?.files?.report || context.diagnostics?.files?.html || null;
  return `WhatsApp unsupported layout. Layout: ${layout}. Found: ${found}. Missing: ${missing}. URL: ${url}.${diagnostics ? ` Diagnostics saved: ${diagnostics}` : ''}`;
}

class DomSelectorChangedError extends CommunicationError {
  constructor(provider, context = {}) {
    super(summarizeRequiredElements(context), {
      code: 'DOM_SELECTOR_CHANGED',
      provider,
      context
    });
  }
}

class ContactResolutionError extends CommunicationError {
  constructor(provider, message, context = {}) {
    super(message, {
      code: 'CONTACT_RESOLUTION_FAILED',
      provider,
      context
    });
  }
}

class SearchBoxNotFoundError extends CommunicationError {
  constructor(provider, context = {}) {
    super('WhatsApp search box was not found', {
      code: 'SEARCH_BOX_NOT_FOUND',
      provider,
      context
    });
  }
}

class ContactNotFoundError extends CommunicationError {
  constructor(provider, context = {}) {
    super('Contact not found', {
      code: 'CONTACT_NOT_FOUND',
      provider,
      context
    });
  }
}

class MessageDraftError extends CommunicationError {
  constructor(provider, message, context = {}) {
    super(message, {
      code: 'MESSAGE_DRAFT_FAILED',
      provider,
      context
    });
  }
}

module.exports = {
  CommunicationError,
  BrowserNotRunningError,
  BrowserStartingError,
  ProviderNotFoundError,
  ProviderUnavailableError,
  QRLoginRequiredError,
  SessionStateError,
  WhatsAppLoadingError,
  DomSelectorChangedError,
  ContactResolutionError,
  SearchBoxNotFoundError,
  ContactNotFoundError,
  MessageDraftError
};
