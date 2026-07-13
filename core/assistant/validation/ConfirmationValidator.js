'use strict';

const BaseValidator = require('./BaseValidator');

class ConfirmationValidator extends BaseValidator {
  validate(context) {
    const required = Array.isArray(context.decisionResult?.confirmationRequired)
      ? context.decisionResult.confirmationRequired
      : [];
    const confirmedTasks = new Set(context.metadata.confirmedTasks || []);
    const valid = required.length === 0 ||
      context.metadata.confirmed === true ||
      required.every(item => confirmedTasks.has(item.taskId));
    context.check(this.id, valid, valid ? 'confirmation satisfied' : 'confirmation required', {
      required,
      confirmedTasks: [...confirmedTasks]
    });
    return context;
  }
}

module.exports = ConfirmationValidator;
