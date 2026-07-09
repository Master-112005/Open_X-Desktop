'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

class LinguisticGraph {
  constructor({
    originalSentence = '',
    normalizedSentence = '',
    tokens = [],
    sentences = [],
    clauses = [],
    dependencies = [],
    posTags = [],
    subjects = [],
    verbs = [],
    objects = [],
    modifiers = [],
    negations = [],
    pronouns = [],
    questions = [],
    grammaticalRelationships = [],
    diagnostics = [],
    confidence = 1,
    timing = {},
    futureExtensions = {},
    linguisticVersion = '4.0.0'
  } = {}) {
    this.originalSentence = String(originalSentence || '');
    this.normalizedSentence = String(normalizedSentence || '');
    this.tokens = Array.isArray(tokens) ? tokens.slice() : [];
    this.sentences = Array.isArray(sentences) ? sentences.slice() : [];
    this.clauses = Array.isArray(clauses) ? clauses.slice() : [];
    this.dependencies = Array.isArray(dependencies) ? dependencies.slice() : [];
    this.posTags = Array.isArray(posTags) ? posTags.slice() : [];
    this.subjects = Array.isArray(subjects) ? subjects.slice() : [];
    this.verbs = Array.isArray(verbs) ? verbs.slice() : [];
    this.objects = Array.isArray(objects) ? objects.slice() : [];
    this.modifiers = Array.isArray(modifiers) ? modifiers.slice() : [];
    this.negations = Array.isArray(negations) ? negations.slice() : [];
    this.pronouns = Array.isArray(pronouns) ? pronouns.slice() : [];
    this.questions = Array.isArray(questions) ? questions.slice() : [];
    this.grammaticalRelationships = Array.isArray(grammaticalRelationships) ? grammaticalRelationships.slice() : [];
    this.diagnostics = Array.isArray(diagnostics) ? diagnostics.slice() : [];
    this.confidence = Math.max(0, Math.min(1, Number(confidence) || 0));
    this.timing = { ...(timing || {}) };
    this.futureExtensions = { ...(futureExtensions || {}) };
    this.linguisticVersion = String(linguisticVersion || '4.0.0');
    deepFreeze(this);
  }
}

module.exports = LinguisticGraph;
