'use strict';

const { MemoryManager, createDefaultMemoryManager } = require('./MemoryManager');
const MEMORY_LAYER_VERSION = '7.1.0';

module.exports = {
  MEMORY_LAYER_VERSION,
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
