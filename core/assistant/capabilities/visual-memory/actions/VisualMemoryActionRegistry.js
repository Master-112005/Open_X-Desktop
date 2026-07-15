'use strict';

const { VISUAL_MEMORY_CAPABILITY_ACTIONS } = require('../contracts/VisualMemoryCapabilityContracts');

class VisualMemoryActionRegistry {
  list() {
    return VISUAL_MEMORY_CAPABILITY_ACTIONS.map(id => ({
      id,
      capability: 'visual-memory',
      publicApiOnly: true
    }));
  }

  has(action) {
    return VISUAL_MEMORY_CAPABILITY_ACTIONS.includes(action);
  }
}

module.exports = VisualMemoryActionRegistry;
