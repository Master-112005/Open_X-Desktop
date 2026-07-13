'use strict';

const ValidationConfiguration = require('./ValidationConfiguration');
const ValidationRegistry = require('./ValidationRegistry');
const ValidationPipeline = require('./ValidationPipeline');
const PermissionValidator = require('./PermissionValidator');
const SafetyValidator = require('./SafetyValidator');
const EntityValidator = require('./EntityValidator');
const ContextValidator = require('./ContextValidator');
const ConfirmationValidator = require('./ConfirmationValidator');
const AutomationValidator = require('./AutomationValidator');
const ConstraintValidator = require('./ConstraintValidator');
const ValidationLogger = require('./ValidationLogger');

class ValidationManager {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof ValidationConfiguration
      ? options.configuration
      : new ValidationConfiguration(options.configuration || options);
    this.registry = options.registry || new ValidationRegistry();
    this.pipeline = options.pipeline || null;
    this.logger = options.logger instanceof ValidationLogger ? options.logger : new ValidationLogger(options.logger || null);
    if (options.defaultValidators !== false) this._registerDefaults();
  }

  _registerDefaults() {
    [
      [PermissionValidator, 'validation.permission', 10],
      [SafetyValidator, 'validation.safety', 20],
      [EntityValidator, 'validation.entity', 30],
      [ContextValidator, 'validation.context', 40],
      [ConfirmationValidator, 'validation.confirmation', 50],
      [AutomationValidator, 'validation.automation', 60],
      [ConstraintValidator, 'validation.constraint', 70]
    ].forEach(([Ctor, id, priority]) => {
      const configured = this.configuration.getValidatorOptions(id, { priority });
      this.registry.register(new Ctor({ id, ...configured }), { id, priority: configured.priority, enabled: configured.enabled });
    });
  }

  registerValidator(validator, options = {}) {
    this.registry.register(validator, options);
    return this;
  }

  async validate(executionBlueprint, decisionResult, options = {}) {
    if (!this.pipeline) {
      this.pipeline = new ValidationPipeline({
        registry: this.registry,
        configuration: this.configuration,
        logger: this.logger
      });
    }
    return this.pipeline.run(executionBlueprint, decisionResult, options);
  }

  getStatus() {
    return {
      enabled: this.configuration.enabled,
      version: this.configuration.version,
      pipelineReady: Boolean(this.pipeline),
      validatorCount: this.registry.count(),
      validators: this.registry.health()
    };
  }

  destroy() {
    for (const validator of this.registry.list()) validator.destroy?.();
    this.registry.clear();
    this.pipeline = null;
  }
}

function createDefaultValidationManager(options = {}) {
  return new ValidationManager(options);
}

module.exports = { ValidationManager, createDefaultValidationManager };
