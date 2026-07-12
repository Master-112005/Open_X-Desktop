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
    super('Communication browser is not running', {
      code: 'BROWSER_NOT_RUNNING',
      provider,
      context
    });
  }
}

class BrowserStartingError extends CommunicationError {
  constructor(provider, context = {}) {
    super('Communication browser is still starting', {
      code: 'BROWSER_STARTING',
      provider,
      context
    });
  }
}

class QRLoginRequiredError extends CommunicationError {
  constructor(provider, context = {}) {
    super('QR login is required', {
      code: 'QR_LOGIN_REQUIRED',
      provider,
      context
    });
  }
}

class DeadlineExceededError extends CommunicationError {
  constructor(provider, context = {}) {
    super('Communication operation deadline was exceeded', {
      code: 'DEADLINE_EXCEEDED',
      provider,
      context,
      cause: context.cause
    });
  }
}

class InsufficientRemainingTimeError extends CommunicationError {
  constructor(provider, context = {}) {
    super('Insufficient remaining deadline to start communication stage', {
      code: 'INSUFFICIENT_REMAINING_TIME',
      provider,
      context,
      cause: context.cause
    });
  }
}

class DuplicateStageExecutionError extends CommunicationError {
  constructor(provider, context = {}) {
    super('Communication stage is already executing in this operation', {
      code: 'DUPLICATE_STAGE_EXECUTION',
      provider,
      context,
      cause: context.cause
    });
  }
}

class MissingPreconditionError extends CommunicationError {
  constructor(provider, context = {}) {
    super('Communication stage precondition is missing', {
      code: 'MISSING_PRECONDITION',
      provider,
      context,
      cause: context.cause
    });
  }
}

class StageCancelledError extends CommunicationError {
  constructor(provider, context = {}) {
    super('Communication stage was cancelled', {
      code: 'STAGE_CANCELLED',
      provider,
      context,
      cause: context.cause
    });
  }
}

class StageDependencyFailedError extends CommunicationError {
  constructor(provider, context = {}) {
    super('Communication stage dependency failed', {
      code: 'STAGE_DEPENDENCY_FAILED',
      provider,
      context,
      cause: context.cause
    });
  }
}

class OperationCancelledError extends CommunicationError {
  constructor(provider, context = {}) {
    super('Communication operation was cancelled', {
      code: 'OPERATION_CANCELLED',
      provider,
      context,
      cause: context.cause
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
  return `Communication provider unsupported layout. Layout: ${layout}. Found: ${found}. Missing: ${missing}. URL: ${url}.${diagnostics ? ` Diagnostics saved: ${diagnostics}` : ''}`;
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
    super('Communication search box was not found', {
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
  DeadlineExceededError,
  InsufficientRemainingTimeError,
  DuplicateStageExecutionError,
  MissingPreconditionError,
  StageCancelledError,
  StageDependencyFailedError,
  OperationCancelledError,
  DomSelectorChangedError,
  ContactResolutionError,
  SearchBoxNotFoundError,
  ContactNotFoundError,
  MessageDraftError
};
