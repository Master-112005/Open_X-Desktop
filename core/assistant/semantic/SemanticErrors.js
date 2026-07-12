'use strict';

class SemanticError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = { ...(context || {}) };
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }
}

class DictionaryError extends SemanticError {}
class MeaningResolutionError extends SemanticError {}
class RelationshipError extends SemanticError {}
class SimilarityError extends SemanticError {}
class GraphBuilderError extends SemanticError {}
class ConfigurationError extends SemanticError {}
class AnalyzerExecutionError extends SemanticError {}

module.exports = {
  SemanticError,
  DictionaryError,
  MeaningResolutionError,
  RelationshipError,
  SimilarityError,
  GraphBuilderError,
  ConfigurationError,
  AnalyzerExecutionError
};
