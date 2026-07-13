'use strict';

const { ValidationManager, createDefaultValidationManager } = require('./ValidationManager');
const VALIDATION_VERSION = '10.1.0';

module.exports = {
  VALIDATION_VERSION,
  ValidationPipeline: require('./ValidationPipeline'),
  ValidationManager,
  createDefaultValidationManager,
  ValidationContext: require('./ValidationContext'),
  ValidationRegistry: require('./ValidationRegistry'),
  BaseValidator: require('./BaseValidator'),
  PermissionValidator: require('./PermissionValidator'),
  SafetyValidator: require('./SafetyValidator'),
  EntityValidator: require('./EntityValidator'),
  ContextValidator: require('./ContextValidator'),
  ConfirmationValidator: require('./ConfirmationValidator'),
  AutomationValidator: require('./AutomationValidator'),
  ConstraintValidator: require('./ConstraintValidator'),
  ValidationResult: require('./ValidationResult'),
  ValidationConfiguration: require('./ValidationConfiguration'),
  ValidationDiagnostics: require('./ValidationDiagnostics'),
  ValidationLogger: require('./ValidationLogger'),
  ...require('./ValidationErrors')
};
