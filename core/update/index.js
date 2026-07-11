const UpdateEngine = require('./UpdateEngine');
const UpdateManager = require('./UpdateManager');
const { UpdateConfiguration, DEFAULT_UPDATE_CONFIGURATION } = require('./UpdateConfiguration');
const VersionManager = require('./VersionManager');
const UPDATE_EVENTS = require('./UpdateEvents');
const UpdateDiagnostics = require('./UpdateDiagnostics');
const UpdateLogger = require('./UpdateLogger');
const UpdateContext = require('./UpdateContext');
const { UPDATE_STATES, isValidUpdateState } = require('./UpdateState');
const UpdateDirectoryManager = require('./UpdateDirectoryManager');
const {
  UpdateResult,
  InitializationResult,
  VersionResult,
  StatusResult,
  DiagnosticResult
} = require('./UpdateResult');
const version = require('./version');
const events = require('./events');
const download = require('./download');
const verification = require('./verification');
const install = require('./install');
const selfupdate = require('./selfupdate');
const presentation = require('./presentation');
const recovery = require('./recovery');

module.exports = {
  UpdateEngine,
  UpdateManager,
  UpdateConfiguration,
  DEFAULT_UPDATE_CONFIGURATION,
  VersionManager,
  UPDATE_EVENTS,
  UpdateDiagnostics,
  UpdateLogger,
  UpdateContext,
  UPDATE_STATES,
  isValidUpdateState,
  UpdateDirectoryManager,
  UpdateResult,
  InitializationResult,
  VersionResult,
  StatusResult,
  DiagnosticResult,
  ...version,
  ...events,
  ...download,
  ...verification,
  ...install,
  ...selfupdate,
  ...presentation,
  ...recovery
};
