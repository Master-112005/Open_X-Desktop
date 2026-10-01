'use strict';

const CONTEXT_LAYER_VERSION = '1.1.0';

module.exports = {
  CONTEXT_LAYER_VERSION,
  ...require('./ContextProviders'),
  ContextManager: require('./ContextManager')
};