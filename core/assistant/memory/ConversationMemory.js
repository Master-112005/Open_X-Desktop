'use strict';

const BaseMemoryProvider = require('./BaseMemoryProvider');

class ConversationMemory extends BaseMemoryProvider {
  apply(context) {
    const limit = Number(this.options.limit || context.configuration?.memoryLimit || 50);
    const history = context.state.conversationTurns || [];
    const turn = {
      input: context.input,
      entities: context.entities.map(entity => ({
        type: entity.type,
        value: entity.canonical || entity.value,
        confidence: entity.confidence
      })),
      timestamp: Date.now()
    };
    history.push(turn);
    context.state.conversationTurns = history.slice(-limit);
    context.conversationMemory = {
      turns: context.state.conversationTurns.slice(),
      previousTurn: context.state.conversationTurns.length > 1
        ? context.state.conversationTurns[context.state.conversationTurns.length - 2]
        : null,
      references: context.state.conversationTurns.flatMap(item => item.entities).slice(-limit)
    };
    return context;
  }
}

module.exports = ConversationMemory;
