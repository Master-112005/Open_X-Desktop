'use strict';

function safeLogger(logger = null) {
  const noop = () => {};
  return {
    debug: typeof logger?.debug === 'function' ? logger.debug.bind(logger) : noop,
    info: typeof logger?.info === 'function' ? logger.info.bind(logger) : noop,
    warn: typeof logger?.warn === 'function' ? logger.warn.bind(logger) : noop,
    error: typeof logger?.error === 'function' ? logger.error.bind(logger) : noop
  };
}

module.exports = {
  safeLogger
};
