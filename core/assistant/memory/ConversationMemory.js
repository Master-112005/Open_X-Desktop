'use strict';

const BaseMemoryProvider = require('./BaseMemoryProvider');

class ConversationMemory extends BaseMemoryProvider {
  apply(context) {
    const limit = Number(this.options.limit || context.configuration?.memoryLimit || 50);
    const history = context.state.conversationTurns || [];
    const turn = {
      input: context.input,
      entities: context.entitySnapshot(limit),
      source: context.metadata.source || context.structuredEntities?.metadata?.source || 'chat',
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
    context.futureExtensions.conversation = {
      turnCount: context.conversationMemory.turns.length,
      referenceCount: context.conversationMemory.references.length
    };
    return context;
  }
}

module.exports = ConversationMemory;
