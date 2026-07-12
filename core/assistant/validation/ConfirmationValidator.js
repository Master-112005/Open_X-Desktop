'use strict';

const BaseValidator = require('./BaseValidator');

class ConfirmationValidator extends BaseValidator {
  validate(context) {
    const required = context.decisionResult?.confirmationRequired || [];
    const valid = required.length === 0 || context.metadata.confirmed === true;
    context.check(this.id, valid, valid ? 'confirmation satisfied' : 'confirmation required', { required });
    return context;
  }
}

module.exports = ConfirmationValidator;
