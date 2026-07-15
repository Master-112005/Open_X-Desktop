'use strict';

const { VISUAL_MEMORY_CAPABILITY_ACTIONS } = require('../contracts/VisualMemoryCapabilityContracts');

class VisualMemoryCapabilityValidator {
  validateRequest(request = {}) {
    if (!request || typeof request !== 'object') return { valid: false, reason: 'Visual Memory capability request must be an object.' };
    if (!request.action) return { valid: false, reason: 'Visual Memory action is required.' };
    if (!VISUAL_MEMORY_CAPABILITY_ACTIONS.includes(request.action)) return { valid: false, reason: `Unsupported Visual Memory action: ${request.action}` };
    return { valid: true };
  }

  validateSession(session = {}) {
    if (!session?.id) return { valid: false, reason: 'Visual Memory session is required.' };
    return { valid: true };
  }

  validateApi(api) {
    if (!api) return { valid: false, reason: 'Visual Memory API is not connected.' };
    return { valid: true };
  }
}

module.exports = VisualMemoryCapabilityValidator;
