'use strict';

function isPromiseLike(value) {
  return Boolean(value) && typeof value.then === 'function';
}

function sleep(delayMs, value) {
  return new Promise(resolve => {
    const handle = setTimeout(() => resolve(value), Math.max(0, Number(delayMs) || 0));
    if (typeof handle.unref === 'function') handle.unref();
  });
}

function defer() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function withTimeout(promise, timeoutMs, createError) {
  const ms = Number(timeoutMs);
  if (!Number.isFinite(ms) || ms <= 0) return promise;
  let handle = null;
  const operation = Promise.resolve(promise);
  const timeout = new Promise((_, reject) => {
    handle = setTimeout(() => {
      const error = typeof createError === 'function' ? createError() : new Error('Operation timed out.');
      if (error && !error.code) error.code = 'operation_timeout';
      reject(error);
    }, ms);
    if (typeof handle.unref === 'function') handle.unref();
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (handle) clearTimeout(handle);
  }
}

module.exports = {
  defer,
  isPromiseLike,
  sleep,
  withTimeout
};
