'use strict';

const { sanitizeAcquisitionData } = require('./AcquisitionSanitizer');

class AcquisitionError extends Error {
  constructor(message, options = {}) {
    super(message || 'Input acquisition failed.');
    this.name = this.constructor.name;
    this.code = options.code || 'acquisition-error';
    this.source = options.source || null;
    this.adapterId = options.adapterId || null;
    this.details = sanitizeAcquisitionData(options.details || null);
    if (options.cause) this.cause = options.cause;
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      source: this.source,
      adapterId: this.adapterId,
      details: this.details,
      cause: this.cause ? {
        name: this.cause.name || 'Error',
        message: this.cause.message || String(this.cause),
        code: this.cause.code || null
      } : null
    };
  }
}

class UnsupportedSourceError extends AcquisitionError {
  constructor(message, options = {}) {
    super(message || 'Unsupported input source.', { ...options, code: options.code || 'unsupported-source' });
  }
}

class InvalidInputError extends AcquisitionError {
  constructor(message, options = {}) {
    super(message || 'Invalid input.', { ...options, code: options.code || 'invalid-input' });
  }
}

class MissingMetadataError extends AcquisitionError {
  constructor(message, options = {}) {
    super(message || 'Input metadata is missing.', { ...options, code: options.code || 'missing-metadata' });
  }
}

class AttachmentError extends AcquisitionError {
  constructor(message, options = {}) {
    super(message || 'Attachment acquisition failed.', { ...options, code: options.code || 'attachment-error' });
  }
}

class LanguageDetectionError extends AcquisitionError {
  constructor(message, options = {}) {
    super(message || 'Language detection failed.', { ...options, code: options.code || 'language-detection-error' });
  }
}

class AdapterUnavailableError extends AcquisitionError {
  constructor(message, options = {}) {
    super(message || 'Input adapter is unavailable.', { ...options, code: options.code || 'adapter-unavailable' });
  }
}

module.exports = {
  AcquisitionError,
  AdapterUnavailableError,
  AttachmentError,
  InvalidInputError,
  LanguageDetectionError,
  MissingMetadataError,
  UnsupportedSourceError
};
