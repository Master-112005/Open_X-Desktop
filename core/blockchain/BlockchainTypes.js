'use strict';

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError((label || 'value') + ' must be a plain object.');
  }
  return true;
}

function statusSnapshot(status = {}) {
  assertPlainObject(status, 'blockchain status');
  return {
    enabled: Boolean(status.enabled),
    initialized: Boolean(status.initialized),
    state: String(status.state || ''),
    network: status.network || null,
    health: status.health || null,
    wallet: status.wallet || null,
    diagnostics: status.diagnostics || null
  };
}

module.exports = {
  assertPlainObject,
  statusSnapshot
};
