'use strict';

const { MemoryManager, createDefaultMemoryManager } = require('./MemoryCore');
const MEMORY_LAYER_VERSION = '7.1.0';

module.exports = {
  MEMORY_LAYER_VERSION,
  ...require('./MemoryCore'),
  ...require('./MemoryProviders'),
  MemoryManager,
  createDefaultMemoryManager
};