'use strict';

const BaseMemoryProvider = require('./BaseMemoryProvider');

class LongTermMemory extends BaseMemoryProvider {
  apply(context) {
    const source = context.configuration?.longTermMemory || this.options.source || {};
    const reader = typeof source.read === 'function' ? source.read.bind(source) : null;
    context.longTermMemory = reader ? reader({ entities: context.entities.slice() }) : { ...(source || {}) };
    return context;
  }
}

module.exports = LongTermMemory;
