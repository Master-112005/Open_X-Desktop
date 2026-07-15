'use strict';

const { VISUAL_MEMORY_HIGH_RISK_ACTIONS } = require('../contracts/VisualMemoryCapabilityContracts');

class VisualMemoryVerificationManager {
  constructor({ configuration } = {}) {
    this.configuration = configuration;
  }

  requiresVerification(request = {}, session = {}) {
    const action = request.action;
    if (!VISUAL_MEMORY_HIGH_RISK_ACTIONS.includes(action)) {
      return { required: false };
    }
    if (action === 'delete' && this.configuration.verification.requireForDelete) {
      return {
        required: true,
        reason: 'delete-visual-memory',
        prompt: 'Are you sure you want to delete these visual memories?',
        targets: session.currentSelection?.length || (session.currentImage ? 1 : 0)
      };
    }
    if (action === 'move-bulk' && this.configuration.verification.requireForBulkMove) {
      return {
        required: true,
        reason: 'bulk-move-visual-memory',
        prompt: 'Are you sure you want to move this many visual memories?',
        targets: session.currentSelection?.length || 0
      };
    }
    return { required: false };
  }
}

module.exports = VisualMemoryVerificationManager;
