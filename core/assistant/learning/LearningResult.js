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
}

module.exports = LearningResult;
