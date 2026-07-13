'use strict';

class LinguisticError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = { ...(context || {}) };
    this.code = context.code || this.constructor.name;
    this.timestamp = Date.now();
    if (context.cause) this.cause = context.cause;
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp
    };
  }
}

class TokenizerError extends LinguisticError {}
class SentenceSplitError extends LinguisticError {}
class DependencyParseError extends LinguisticError {}
class POSTaggingError extends LinguisticError {}
class PronounResolutionError extends LinguisticError {}
class ConfigurationError extends LinguisticError {}
class AnalyzerExecutionError extends LinguisticError {}

module.exports = {
  LinguisticError,
  TokenizerError,
  SentenceSplitError,
  DependencyParseError,
  POSTaggingError,
  PronounResolutionError,
  ConfigurationError,
  AnalyzerExecutionError
};
