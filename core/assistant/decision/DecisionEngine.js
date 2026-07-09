'use strict';

const BaseDecision = require('./BaseDecision');

class DecisionEngine extends BaseDecision {
  decide(context) {
    const blueprint = context.executionBlueprint || {};
    if (!Array.isArray(blueprint.tasks) || blueprint.tasks.length === 0) {
      context.setStatus('WAIT', 'execution blueprint has no tasks');
      return context;
    }
    context.setStatus('EXECUTE', 'execution blueprint contains tasks');
    return context;
  }
}

module.exports = DecisionEngine;
