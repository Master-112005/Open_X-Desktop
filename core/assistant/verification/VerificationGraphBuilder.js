'use strict';

const BaseVerifier = require('./BaseVerifier');
const deepFreeze = require('../utils/ObjectFreeze');

class VerificationGraphBuilder extends BaseVerifier {
  verify(context) {
    const planned = context.automationResult?.executionGraph?.nodes || [];
    const nodes = planned.map(node => ({
      id: node.id,
      type: 'planned-action',
      status: node.status,
      action: node.action || null
    }));
    context.evidence.forEach((evidence, index) => {
      nodes.push({ id: `evidence:${index + 1}`, type: 'evidence', value: evidence.value });
    });
    context.verificationGraph = deepFreeze({
      nodes,
      edges: (context.automationResult?.executionGraph?.edges || []).slice(),
      timing: context.automationResult?.timing || {},
      diagnostics: {
        successfulActions: context.successfulActions.length,
        failedActions: context.failedActions.length,
        skippedActions: context.skippedActions.length
      }
    });
    return context;
  }
}

module.exports = VerificationGraphBuilder;
