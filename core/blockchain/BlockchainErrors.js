'use strict';

class BlockchainError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code || this.constructor.name;
    this.cause = options.cause;
    this.details = sanitizeDetails(options.details || {});
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: sanitizeDetails(this.details)
    };
  }
}

function sanitizeDetails(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > 4) return '[MaxDepth]';
  if (Array.isArray(value)) return value.slice(0, 20).map(item => sanitizeDetails(item, depth + 1));
  if (typeof value !== 'object') return value;
  const output = {};
  for (const [key, child] of Object.entries(value)) {
    if (/(private|secret|seed|mnemonic|password|token|credential|key)/i.test(key)) {
      output[key] = '[REDACTED]';
    } else {
      output[key] = sanitizeDetails(child, depth + 1);
    }
  }
  return output;
}

function wrapBlockchainError(error, ErrorClass = BlockchainError, details = {}) {
  if (error instanceof BlockchainError) return error;
  return new ErrorClass(error?.message || String(error || 'Blockchain operation failed.'), {
    cause: error,
    details
  });
}

class ConnectionError extends BlockchainError {}
class ProviderError extends BlockchainError {}
class RPCError extends BlockchainError {}
class ConfigurationError extends BlockchainError {}
class WalletError extends BlockchainError {}
class TimeoutError extends BlockchainError {}
class RetryLimitError extends BlockchainError {}
class IdentityError extends BlockchainError {}
class RegistrationError extends IdentityError {}
class WalletGenerationError extends WalletError {}
class VerificationError extends IdentityError {}
class IdentityStorageError extends IdentityError {}
class RecoveryError extends IdentityError {}
class PairError extends BlockchainError {}
class PairExpiredError extends PairError {}
class PairRejectedError extends PairError {}
class PairVerificationError extends PairError {}
class PairSynchronizationError extends PairError {}
class PairTimeoutError extends PairError {}
class InvalidQRCodeError extends PairError {}
class BlockchainMismatchError extends PairError {}
class TrustError extends BlockchainError {}
class TrustExpiredError extends TrustError {}
class TrustVerificationError extends TrustError {}
class TrustCacheError extends TrustError {}
class TrustSyncError extends TrustError {}
class TrustConflictError extends TrustError {}
class BlockchainTrustError extends TrustError {}
class OfflineTrustError extends TrustError {}
class PermissionError extends BlockchainError {}
class PermissionExpiredError extends PermissionError {}
class PermissionDeniedError extends PermissionError {}
class PermissionSyncError extends PermissionError {}
class PermissionConflictError extends PermissionError {}
class PermissionCacheError extends PermissionError {}
class PermissionVerificationError extends PermissionError {}
class OfflinePermissionError extends PermissionError {}
class BlockchainPermissionError extends PermissionError {}

module.exports = {
  BlockchainError,
  ConnectionError,
  ProviderError,
  RPCError,
  ConfigurationError,
  WalletError,
  TimeoutError,
  RetryLimitError,
  IdentityError,
  RegistrationError,
  WalletGenerationError,
  VerificationError,
  IdentityStorageError,
  RecoveryError,
  PairError,
  PairExpiredError,
  PairRejectedError,
  PairVerificationError,
  PairSynchronizationError,
  PairTimeoutError,
  InvalidQRCodeError,
  BlockchainMismatchError,
  TrustError,
  TrustExpiredError,
  TrustVerificationError,
  TrustCacheError,
  TrustSyncError,
  TrustConflictError,
  BlockchainTrustError,
  OfflineTrustError,
  PermissionError,
  PermissionExpiredError,
  PermissionDeniedError,
  PermissionSyncError,
  PermissionConflictError,
  PermissionCacheError,
  PermissionVerificationError,
  OfflinePermissionError,
  BlockchainPermissionError,
  sanitizeDetails,
  wrapBlockchainError
};
