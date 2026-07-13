'use strict';

const PipelineConfiguration = require('./PipelineConfiguration');
const PipelineDiagnostics = require('./PipelineDiagnostics');
const PipelineEngine = require('./PipelineEngine');
const PipelineRegistry = require('./PipelineRegistry');
const PipelineEventDispatcher = require('../events/PipelineEventDispatcher');
const ServiceContainer = require('../utils/ServiceContainer');

class PipelineBuilder {
  constructor(options = {}) {
    this.container = options.container || new ServiceContainer();
    this.registry = options.registry || new PipelineRegistry();
    this.configuration = new PipelineConfiguration(options.configuration || {});
    this.dispatcher = options.dispatcher || new PipelineEventDispatcher();
    this.diagnostics = options.diagnostics || new PipelineDiagnostics();
    this.logger = options.logger || null;
  }

  registerService(name, factoryOrValue) {
    this.container.register(name, factoryOrValue);
    return this;
  }

  registerStage(stageOrFactory, options = {}) {
    let stage = stageOrFactory;
    if (typeof stageOrFactory === 'function' && !stageOrFactory.execute) {
      stage = typeof stageOrFactory.prototype?.execute === 'function'
        ? new stageOrFactory(options)
        : stageOrFactory(this.container);
    }
    this.registry.register(stage, options);
    return this;
  }

  registerStages(stages = []) {
    for (const item of stages) {
      if (Array.isArray(item)) this.registerStage(item[0], item[1] || {});
      else this.registerStage(item);
    }
    return this;
  }

  configure(options = {}) {
    this.configuration = new PipelineConfiguration({
      ...this.configuration,
      ...(options || {})
    });
    return this;
  }

  build() {
    return new PipelineEngine({
      registry: this.registry,
      configuration: this.configuration,
      diagnostics: this.diagnostics,
      dispatcher: this.dispatcher,
      logger: this.logger
    });
  }

  getStatus() {
    return {
      configuration: this.configuration.toJSON(),
      stages: this.registry.health(),
      diagnostics: typeof this.diagnostics.summary === 'function' ? this.diagnostics.summary(25) : null
    };
  }
}

module.exports = PipelineBuilder;
