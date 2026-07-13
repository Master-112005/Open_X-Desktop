'use strict';

const BaseValidator = require('./BaseValidator');

class ContextValidator extends BaseValidator {
  validate(context) {
    const blueprint = context.executionBlueprint || {};
    context.check(this.id, Boolean(blueprint && typeof blueprint === 'object'), 'execution blueprint present');
    context.check(this.id, Array.isArray(blueprint.tasks), 'blueprint tasks array present');
    context.check(this.id, Array.isArray(blueprint.ordering), 'blueprint ordering array present');
    context.check(this.id, Boolean(blueprint.workflow?.type), 'workflow type present', {
      workflow: blueprint.workflow?.type || null
    });
    context.check(this.id, Boolean(context.metadata.source || context.metadata.sourceType), 'source metadata present', {
      source: context.metadata.source || context.metadata.sourceType || null
    });
    return context;
  }
}

module.exports = ContextValidator;
