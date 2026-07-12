'use strict';

function isPromiseLike(value) {
  return Boolean(value) && typeof value.then === 'function';
}

async function withTimeout(promise, timeoutMs, createError) {
  const ms = Number(timeoutMs);
  if (!Number.isFinite(ms) || ms <= 0) return promise;
  let handle = null;
  const timeout = new Promise((_, reject) => {
    handle = setTimeout(() => {
      reject(typeof createError === 'function' ? createError() : new Error('Operation timed out.'));
    }, ms);
    if (typeof handle.unref === 'function') handle.unref();
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (handle) clearTimeout(handle);
  }
}

module.exports = {
  isPromiseLike,
  withTimeout
};
