'use strict';

const BaseValidator = require('./BaseValidator');

class ContextValidator extends BaseValidator {
  validate(context) {
    context.check(this.id, true, 'runtime context accepted', {
      workflow: context.executionBlueprint?.workflow?.type || null
    });
    return context;
  }
}

module.exports = ContextValidator;
