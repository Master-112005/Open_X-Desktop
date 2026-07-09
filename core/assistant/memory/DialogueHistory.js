'use strict';

const BaseMemoryProvider = require('./BaseMemoryProvider');

class DialogueHistory extends BaseMemoryProvider {
  apply(context) {
    const limit = Number(this.options.limit || context.configuration?.memoryLimit || 50);
    const history = context.state.dialogueHistory || [];
    history.push({
      role: 'user',
      text: context.input,
      timestamp: Date.now(),
      entityCount: context.entities.length
    });
    context.state.dialogueHistory = history.slice(-limit);
    context.dialogueHistory = context.state.dialogueHistory.slice();
    return context;
  }
}

module.exports = DialogueHistory;
