'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

class LearningResult {
  constructor(input = {}) {
    this.completed = input.completed === true;
    this.itemsLearned = Array.isArray(input.itemsLearned) ? input.itemsLearned.slice() : [];
    this.itemsRejected = Array.isArray(input.itemsRejected) ? input.itemsRejected.slice() : [];
    this.updatedPreferences = Array.isArray(input.updatedPreferences) ? input.updatedPreferences.slice() : [];
    this.updatedAliases = Array.isArray(input.updatedAliases) ? input.updatedAliases.slice() : [];
    this.updatedHabits = Array.isArray(input.updatedHabits) ? input.updatedHabits.slice() : [];
    this.updatedWorkflows = Array.isArray(input.updatedWorkflows) ? input.updatedWorkflows.slice() : [];
    this.diagnostics = input.diagnostics || {};
    this.metadata = { ...(input.metadata || {}) };
    this.timing = { ...(input.timing || {}) };
    this.version = String(input.version || '12.0.0');
    this.futureExtensions = { ...(input.futureExtensions || {}) };
    deepFreeze(this);
  }

  get learned() { return this.itemsLearned.length; }
  get rejected() { return this.itemsRejected.length; }
  get hasUpdates() {
    return this.itemsLearned.length > 0 ||
      this.updatedPreferences.length > 0 ||
      this.updatedAliases.length > 0 ||
      this.updatedHabits.length > 0 ||
      this.updatedWorkflows.length > 0;
  }

  toJSON() {
    return {
      completed: this.completed,
      itemsLearned: this.itemsLearned,
      itemsRejected: this.itemsRejected,
      updatedPreferences: this.updatedPreferences,
      updatedAliases: this.updatedAliases,
      updatedHabits: this.updatedHabits,
      updatedWorkflows: this.updatedWorkflows,
      diagnostics: this.diagnostics,
      metadata: this.metadata,
      timing: this.timing,
      version: this.version,
      futureExtensions: this.futureExtensions
    };
  }
}

module.exports = LearningResult;
