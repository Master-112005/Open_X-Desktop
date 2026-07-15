'use strict';

class VisualMemoryCapabilityConfiguration {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.permissions = {
      allowDelete: options.permissions?.allowDelete === true,
      allowSharing: options.permissions?.allowSharing !== false,
      allowAutomation: options.permissions?.allowAutomation !== false,
      allowFaceMemory: options.permissions?.allowFaceMemory !== false,
      allowOcrSearch: options.permissions?.allowOcrSearch !== false,
      allowPhoneTransfer: options.permissions?.allowPhoneTransfer !== false
    };
    this.verification = {
      requireForDelete: options.verification?.requireForDelete !== false,
      requireForBulkMove: options.verification?.requireForBulkMove !== false,
      bulkThreshold: Math.max(10, Number(options.verification?.bulkThreshold || 100))
    };
    this.conversation = {
      sessionTtlMs: Math.max(60000, Number(options.conversation?.sessionTtlMs || 30 * 60 * 1000)),
      maxSessions: Math.max(1, Number(options.conversation?.maxSessions || 20))
    };
    this.performance = {
      routeBudgetMs: Math.max(1, Number(options.performance?.routeBudgetMs || 10)),
      continuationBudgetMs: Math.max(1, Number(options.performance?.continuationBudgetMs || 5))
    };
  }

  toJSON() {
    return {
      enabled: this.enabled,
      permissions: { ...this.permissions },
      verification: { ...this.verification },
      conversation: { ...this.conversation },
      performance: { ...this.performance }
    };
  }
}

module.exports = VisualMemoryCapabilityConfiguration;
