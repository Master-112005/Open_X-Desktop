'use strict';

const { TimeoutError, RetryLimitError } = require('../BlockchainErrors');

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(milliseconds) || 0)));
}

function withTimeout(promise, timeoutMs, details = {}) {
  const duration = Math.max(1, Number(timeoutMs) || 1);
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError('Blockchain operation timed out.', {
        code: 'BLOCKCHAIN_TIMEOUT',
        details: { ...details, timeoutMs: duration }
      }));
    }, duration);
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function retryOperation(operation, options = {}) {
  const attempts = Math.max(1, Number(options.attempts) || 1);
  const baseDelayMs = Math.max(0, Number(options.baseDelayMs) || 0);
  const maxDelayMs = Math.max(baseDelayMs, Number(options.maxDelayMs) || baseDelayMs);
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) break;
      const delay = Math.min(maxDelayMs, baseDelayMs * (2 ** (attempt - 1)));
      if (delay > 0) await sleep(delay);
    }
  }

  throw new RetryLimitError('Blockchain retry limit reached.', {
    code: 'BLOCKCHAIN_RETRY_LIMIT',
    cause: lastError,
    details: { attempts, lastError: lastError?.message || String(lastError || '') }
  });
}

module.exports = {
  sleep,
  withTimeout,
  retryOperation
};
