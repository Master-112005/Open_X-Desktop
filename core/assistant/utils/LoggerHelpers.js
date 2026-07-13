'use strict';

const { sanitizeDetails } = require('./ErrorHelpers');

function normalizeArgs(args) {
  if (args.length <= 1) return args;
  return [args[0], sanitizeDetails(args[1])];
}

function safeLogger(logger = null) {
  const noop = () => {};
  const bind = level => (...args) => {
    const fn = logger?.[level];
    if (typeof fn !== 'function') return noop();
    return fn.apply(logger, normalizeArgs(args));
  };
  return {
    debug: bind('debug'),
    info: bind('info'),
    warn: bind('warn'),
    error: bind('error')
  };
}

module.exports = {
  normalizeArgs,
  safeLogger
};
