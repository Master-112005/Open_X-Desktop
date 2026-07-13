'use strict';

const { createDefaultVerificationManager } = require('./VerificationManager');
const { createDefaultResponseManager } = require('../response');

class VerificationResponseManager {
  constructor(options = {}) {
    this.verificationManager = options.verificationManager || createDefaultVerificationManager({
      configuration: options.verification || options.configuration?.verification || {}
    });
    this.responseManager = options.responseManager || createDefaultResponseManager({
      configuration: options.response || options.configuration?.response || {}
    });
  }

  async run(automationResult, options = {}) {
    const verificationResult = await this.verificationManager.verify(automationResult, {
      metadata: options.metadata || {}
    });
    const assistantResponse = await this.responseManager.generate(verificationResult, {
      metadata: {
        ...(options.metadata || {}),
        verificationSummary: verificationResult.summary || {}
      }
    });
    return { verificationResult, assistantResponse };
  }

  getStatus() {
    return {
      verification: this.verificationManager.getStatus(),
      response: this.responseManager.getStatus()
    };
  }

  destroy() {
    this.verificationManager.destroy?.();
    this.responseManager.destroy?.();
  }
}

function createDefaultVerificationResponseManager(options = {}) {
  return new VerificationResponseManager(options);
}

module.exports = { VerificationResponseManager, createDefaultVerificationResponseManager };
