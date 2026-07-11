const InstallationEngine = require('./InstallationEngine');
const InstallationManager = require('./InstallationManager');
const InstallationService = require('./InstallationService');
const InstallationSession = require('./InstallationSession');
const InstallationState = require('./InstallationState');
const InstallationContext = require('./InstallationContext');
const InstallationEvents = require('./InstallationEvents');
const InstallationLogger = require('./InstallationLogger');
const InstallationDiagnostics = require('./InstallationDiagnostics');
const { InstallationConfiguration, DEFAULT_INSTALLATION_CONFIGURATION } = require('./InstallationConfiguration');
const InstallationPolicy = require('./InstallationPolicy');
const InstallationHistory = require('./InstallationHistory');
const InstallerLauncher = require('./InstallerLauncher');
const ShutdownCoordinator = require('./ShutdownCoordinator');
const ApplicationStateManager = require('./ApplicationStateManager');
const ConfirmationManager = require('./ConfirmationManager');
const InstallationResult = require('./InstallationResult');
const InstallationValidator = require('./InstallationValidator');

module.exports = {
  InstallationEngine,
  InstallationManager,
  InstallationService,
  InstallationSession,
  InstallationState,
  InstallationContext,
  InstallationEvents,
  InstallationLogger,
  InstallationDiagnostics,
  InstallationConfiguration,
  DEFAULT_INSTALLATION_CONFIGURATION,
  InstallationPolicy,
  InstallationHistory,
  InstallerLauncher,
  ShutdownCoordinator,
  ApplicationStateManager,
  ConfirmationManager,
  InstallationResult,
  InstallationValidator
};
