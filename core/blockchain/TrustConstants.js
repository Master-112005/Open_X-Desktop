'use strict';

const TRUST_STATUS = Object.freeze({
  TRUSTED: 'TRUSTED',
  PENDING: 'PENDING',
  BLOCKED: 'BLOCKED',
  REVOKED: 'REVOKED',
  UNKNOWN: 'UNKNOWN',
  EXPIRED: 'EXPIRED'
});

const TRUST_DECISION = Object.freeze({
  ALLOW: 'ALLOW',
  DENY: 'DENY',
  PENDING: 'PENDING',
  BLOCKED: 'BLOCKED'
});

const TRUST_VERSION = 'openx-trust-v1';
const TRUST_SOURCE = Object.freeze({
  CACHE: 'cache',
  BLOCKCHAIN: 'blockchain',
  PAIRING: 'pairing',
  OFFLINE: 'offline',
  DEFAULT: 'default'
});

module.exports = {
  TRUST_STATUS,
  TRUST_DECISION,
  TRUST_VERSION,
  TRUST_SOURCE
};
