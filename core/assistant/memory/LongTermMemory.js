'use strict';

const BaseMemoryProvider = require('./BaseMemoryProvider');

class LongTermMemory extends BaseMemoryProvider {
  apply(context) {
    const source = context.configuration?.longTermMemory || this.options.source || {};
    const reader = typeof source.read === 'function' ? source.read.bind(source) : null;
    const value = reader ? reader({
      entities: context.entitySnapshot(),
      input: context.input,
      topic: context.topic
    }) : { ...(source || {}) };
    context.longTermMemory = value && typeof value === 'object' ? { ...value } : {};
    context.futureExtensions.longTermMemory = {
      available: Boolean(context.longTermMemory && Object.keys(context.longTermMemory).length),
      keys: Object.keys(context.longTermMemory || {}).slice(0, 20)
    };
    return context;
  }
}

module.exports = LongTermMemory;
