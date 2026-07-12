'use strict';

const BaseValidator = require('./BaseValidator');

class ConstraintValidator extends BaseValidator {
  validate(context) {
    const taskIds = new Set((context.executionBlueprint?.tasks || []).map(task => task.id));
    for (const dependency of context.executionBlueprint?.dependencies || []) {
      context.check(this.id, taskIds.has(dependency.from) && taskIds.has(dependency.to), 'dependency endpoints exist', dependency);
    }
    if ((context.executionBlueprint?.dependencies || []).length === 0) {
      context.check(this.id, true, 'no dependency constraints');
    }
    return context;
  }
}

module.exports = ConstraintValidator;
