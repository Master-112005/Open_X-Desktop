'use strict';

const ResponseConfiguration = require('./ResponseConfiguration');
const ResponseRegistry = require('./ResponseRegistry');
const ResponsePipeline = require('./ResponsePipeline');
const ConfirmationResponse = require('./ConfirmationResponse');
const SummaryResponse = require('./SummaryResponse');
const ErrorResponse = require('./ErrorResponse');
const ClarificationResponse = require('./ClarificationResponse');
const SuggestionResponse = require('./SuggestionResponse');
const NaturalLanguageFormatter = require('./NaturalLanguageFormatter');
const VoiceFormatter = require('./VoiceFormatter');
const ChatFormatter = require('./ChatFormatter');
const NotificationFormatter = require('./NotificationFormatter');

class ResponseManager {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof ResponseConfiguration
      ? options.configuration
      : new ResponseConfiguration(options.configuration || options);
    this.registry = options.registry || new ResponseRegistry();
    this.pipeline = options.pipeline || null;
    if (options.defaultGenerators !== false) this._registerDefaults();
  }

  _registerDefaults() {
    [
      [ConfirmationResponse, 'response.confirmation', 10],
      [SummaryResponse, 'response.summary', 20],
      [ErrorResponse, 'response.error', 30],
      [ClarificationResponse, 'response.clarification', 40],
      [SuggestionResponse, 'response.suggestion', 50],
      [NaturalLanguageFormatter, 'response.naturalLanguageFormatter', 60],
      [VoiceFormatter, 'response.voiceFormatter', 70],
      [ChatFormatter, 'response.chatFormatter', 80],
      [NotificationFormatter, 'response.notificationFormatter', 90]
    ].forEach(([Ctor, id, priority]) => {
      const configured = this.configuration.getGeneratorOptions(id, { priority });
      this.registry.register(new Ctor({ id, ...configured }), { id, priority: configured.priority, enabled: configured.enabled });
    });
  }

  registerGenerator(generator, options = {}) {
    this.registry.register(generator, options);
    return this;
  }

  async generate(verificationResult, options = {}) {
    if (!this.pipeline) {
      this.pipeline = new ResponsePipeline({ registry: this.registry, configuration: this.configuration });
    }
    return this.pipeline.run(verificationResult, options);
  }

  getStatus() {
    return { enabled: this.configuration.enabled, version: this.configuration.version, generators: this.registry.health() };
  }

  destroy() {
    for (const generator of this.registry.list()) generator.destroy?.();
    this.registry.clear();
    this.pipeline = null;
  }
}

function createDefaultResponseManager(options = {}) {
  return new ResponseManager(options);
}

module.exports = { ResponseManager, createDefaultResponseManager };
