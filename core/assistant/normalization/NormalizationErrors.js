'use strict';

class NormalizationError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = { ...(context || {}) };
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }
}

class InvalidUnicodeError extends NormalizationError {}
class SpellRepairError extends NormalizationError {}
class LanguageDetectionError extends NormalizationError {}
class ConfigurationError extends NormalizationError {}
class NormalizerExecutionError extends NormalizationError {}

module.exports = {
  NormalizationError,
  InvalidUnicodeError,
  SpellRepairError,
  LanguageDetectionError,
  ConfigurationError,
  NormalizerExecutionError
};
