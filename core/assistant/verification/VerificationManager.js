'use strict';

const VerificationConfiguration = require('./VerificationConfiguration');
const VerificationRegistry = require('./VerificationRegistry');
const VerificationPipeline = require('./VerificationPipeline');
const ExecutionVerifier = require('./ExecutionVerifier');
const ApplicationVerifier = require('./ApplicationVerifier');
const BrowserVerifier = require('./BrowserVerifier');
const WindowVerifier = require('./WindowVerifier');
const ReminderVerifier = require('./ReminderVerifier');
const TransferVerifier = require('./TransferVerifier');
const CloudVerifier = require('./CloudVerifier');
const VerificationGraphBuilder = require('./VerificationGraphBuilder');
const VerificationLogger = require('./VerificationLogger');

class VerificationManager {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof VerificationConfiguration
      ? options.configuration
      : new VerificationConfiguration(options.configuration || options);
    this.registry = options.registry || new VerificationRegistry();
    this.pipeline = options.pipeline || null;
    this.logger = options.logger instanceof VerificationLogger ? options.logger : new VerificationLogger(options.logger || null);
    if (options.defaultVerifiers !== false) this._registerDefaults();
  }

  _registerDefaults() {
    [
      [ExecutionVerifier, 'verification.execution', 10],
      [ApplicationVerifier, 'verification.application', 20],
      [BrowserVerifier, 'verification.browser', 30],
      [WindowVerifier, 'verification.window', 40],
      [ReminderVerifier, 'verification.reminder', 50],
      [TransferVerifier, 'verification.transfer', 60],
      [CloudVerifier, 'verification.cloud', 70],
      [VerificationGraphBuilder, 'verification.graphBuilder', 80]
    ].forEach(([Ctor, id, priority]) => {
      const configured = this.configuration.getVerifierOptions(id, { priority });
      this.registry.register(new Ctor({ id, ...configured }), { id, priority: configured.priority, enabled: configured.enabled });
    });
  }

  registerVerifier(verifier, options = {}) {
    this.registry.register(verifier, options);
    return this;
  }

  async verify(automationResult, options = {}) {
    if (!this.pipeline) {
      this.pipeline = new VerificationPipeline({
        registry: this.registry,
        configuration: this.configuration,
        logger: this.logger
      });
    }
    return this.pipeline.run(automationResult, options);
  }

  getStatus() {
    return {
      enabled: this.configuration.enabled,
      version: this.configuration.version,
      pipelineReady: Boolean(this.pipeline),
      verifierCount: this.registry.count(),
      verifiers: this.registry.health()
    };
  }

  destroy() {
    for (const verifier of this.registry.list()) verifier.destroy?.();
    this.registry.clear();
    this.pipeline = null;
  }
}

function createDefaultVerificationManager(options = {}) {
  return new VerificationManager(options);
}

module.exports = { VerificationManager, createDefaultVerificationManager };
