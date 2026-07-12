'use strict';

const BaseValidator = require('./BaseValidator');

class SafetyValidator extends BaseValidator {
  validate(context) {
    const dangerous = context.configuration?.safety?.dangerousActions || new Set();
    for (const task of context.executionBlueprint?.tasks || []) {
      if (!dangerous.has(task.action)) continue;
      const confirmed = context.metadata.confirmed === true;
      context.check(this.id, confirmed, confirmed ? 'dangerous action confirmed' : 'dangerous action requires confirmation', {
        taskId: task.id,
        action: task.action
      });
    }
    if (!(context.executionBlueprint?.tasks || []).some(task => dangerous.has(task.action))) {
      context.check(this.id, true, 'no dangerous actions');
    }
    return context;
  }
}

module.exports = SafetyValidator;
