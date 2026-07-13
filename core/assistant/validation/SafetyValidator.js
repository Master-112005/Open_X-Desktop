'use strict';

const BaseValidator = require('./BaseValidator');

class SafetyValidator extends BaseValidator {
  validate(context) {
    const dangerous = context.configuration?.safety?.dangerousActions || new Set();
    let foundDangerous = false;
    for (const task of this.tasks(context)) {
      const highRisk = task.metadata?.risk === 'high';
      if (!dangerous.has(task.action) && !highRisk) continue;
      foundDangerous = true;
      const confirmed = context.metadata.confirmed === true;
      context.check(this.id, confirmed, confirmed ? 'dangerous action confirmed' : 'dangerous action requires confirmation', {
        taskId: task.id,
        action: task.action,
        risk: task.metadata?.risk || null
      });
    }
    if (!foundDangerous) {
      context.check(this.id, true, 'no dangerous actions');
    }
    return context;
  }
}

module.exports = SafetyValidator;
