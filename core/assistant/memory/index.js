'use strict';

const { MemoryManager, createDefaultMemoryManager } = require('./MemoryManager');

module.exports = {
  MemoryPipeline: require('./MemoryPipeline'),
  MemoryManager,
  createDefaultMemoryManager,
  MemoryContext: require('./MemoryContext'),
  MemoryRegistry: require('./MemoryRegistry'),
  BaseMemoryProvider: require('./BaseMemoryProvider'),
  WorkingMemory: require('./WorkingMemory'),
  ConversationMemory: require('./ConversationMemory'),
  SessionMemory: require('./SessionMemory'),
  DialogueHistory: require('./DialogueHistory'),
  LongTermMemory: require('./LongTermMemory'),
  TopicTracker: require('./TopicTracker'),
  MemoryConfiguration: require('./MemoryConfiguration'),
  MemoryDiagnostics: require('./MemoryDiagnostics'),
  MemoryLogger: require('./MemoryLogger'),
  ResolvedContext: require('./ResolvedContext'),
  MemoryContextStage: require('./MemoryContextStage'),
  ...require('./MemoryErrors')
};
