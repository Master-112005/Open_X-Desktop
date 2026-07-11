const VersionCheckManager = require('./VersionCheckManager');
const VersionCheckService = require('./VersionCheckService');
const VersionCheckRequest = require('./VersionCheckRequest');
const { VersionCheckResponse, VALID_VERSION_RESPONSE_STATUSES } = require('./VersionCheckResponse');
const VersionCheckResult = require('./VersionCheckResult');
const VersionCheckDiagnostics = require('./VersionCheckDiagnostics');
const VERSION_CHECK_EVENTS = require('./VersionCheckEvents');
const { VERSION_CHECK_STATES } = require('./VersionCheckState');
const { VersionCheckConfiguration, DEFAULT_VERSION_CHECK_CONFIGURATION } = require('./VersionCheckConfiguration');
const { VersionComparisonResult, VERSION_COMPARISON_STATUS } = require('./VersionComparisonResult');

module.exports = {
  VersionCheckManager,
  VersionCheckService,
  VersionCheckRequest,
  VersionCheckResponse,
  VALID_VERSION_RESPONSE_STATUSES,
  VersionCheckResult,
  VersionCheckDiagnostics,
  VERSION_CHECK_EVENTS,
  VERSION_CHECK_STATES,
  VersionCheckConfiguration,
  DEFAULT_VERSION_CHECK_CONFIGURATION,
  VersionComparisonResult,
  VERSION_COMPARISON_STATUS
};
