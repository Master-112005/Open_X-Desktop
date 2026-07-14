const MAX_LABEL_LENGTH = 120;

const RISK_BY_OPERATION = Object.freeze({
  'file.delete': 'high',
  'folder.delete': 'high',
  'system.shutdown': 'critical',
  'system.restart': 'critical',
  'system.sleep': 'medium',
  'system.lock': 'medium',
  'app.close': 'medium',
  'window.close': 'medium',
  'phone.sendFile': 'medium',
  'message.compose': 'medium',
  'email.compose': 'medium',
  'call.start': 'medium'
});

const REVERSIBLE_OPERATIONS = new Set([
  'volume.set',
  'volume.up',
  'volume.down',
  'volume.mute',
  'volume.unmute',
  'brightness.set',
  'brightness.up',
  'brightness.down',
  'app.open',
  'app.switch',
  'browser.open',
  'browser.search',
  'system.screenshot',
  'timer.set',
  'alarm.set',
  'reminder.set'
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeLabel(value, fallback = '') {
  return String(value || fallback || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LABEL_LENGTH);
}

function normalizeStatus(value, fallback = 'unknown') {
  const status = String(value || fallback || '').trim().toLowerCase();
  if (['passed', 'failed', 'unknown'].includes(status)) return status;
  return fallback;
}

function operationFrom(result = {}) {
  return sanitizeLabel(
    result.intent ||
    result.actionId ||
    result.data?.operation ||
    result.data?.actionId ||
    result.data?.action ||
    result.data?.command ||
    'action'
  );
}

function targetFrom(result = {}) {
  const data = result.data || {};
  const entities = result.entities || {};
  return sanitizeLabel(
    data.target ||
    data.app ||
    data.appName ||
    data.filename ||
    data.folderName ||
    data.filePath ||
    data.path ||
    data.url ||
    data.deviceName ||
    entities.appName ||
    entities.filename ||
    entities.folderName ||
    entities.contactName ||
    ''
  );
}

function classifyRisk(operation, result = {}) {
  const data = result.data || {};
  if (data.risk) return sanitizeLabel(data.risk).toLowerCase();
  if (RISK_BY_OPERATION[operation]) return RISK_BY_OPERATION[operation];
  if (operation.startsWith('system.')) return 'medium';
  if (operation.includes('delete') || operation.includes('remove') || operation.includes('clear')) return 'high';
  if (operation.includes('send') || operation.includes('transfer') || operation.includes('share')) return 'medium';
  return 'low';
}

function reversibleFor(operation, result = {}) {
  if (typeof result.data?.reversible === 'boolean') return result.data.reversible;
  if (REVERSIBLE_OPERATIONS.has(operation)) return true;
  if (operation.includes('delete') || operation.includes('shutdown') || operation.includes('restart')) return false;
  return null;
}

function buildMessage({ success, operation, target, risk, verificationStatus, error }) {
  if (!success) {
    return sanitizeLabel(error, `The ${operation} action did not complete.`);
  }

  const targetText = target ? ` for ${target}` : '';
  const verified = verificationStatus === 'passed' ? ' and verified' : '';
  if (risk === 'critical' || risk === 'high') {
    return `Completed${verified}: ${operation}${targetText}.`;
  }
  return `Completed${verified}: ${operation}${targetText}.`;
}

class ActionConfirmation {
  confirm(result = {}) {
    if (!isPlainObject(result)) {
      return {
        confirmed: false,
        success: false,
        error: 'Action returned an invalid result',
        data: null,
        risk: 'unknown',
        reversible: null,
        verificationStatus: 'failed',
        requiresReview: true,
        message: 'Action returned an invalid result'
      };
    }

    const data = isPlainObject(result.data) ? result.data : {};
    const operation = operationFrom(result);
    const target = targetFrom(result);
    const validationStatus = normalizeStatus(result.validation?.status || data.validation?.status);
    const verificationStatus = normalizeStatus(result.verification?.status || data.verification?.status);
    const success = Boolean(result.success);
    const risk = classifyRisk(operation, result);
    const reversible = reversibleFor(operation, result);
    const error = sanitizeLabel(result.error || data.error || '');

    return {
      confirmed: success,
      success,
      error: error || null,
      data: result.data || null,
      operation,
      target: target || null,
      risk,
      reversible,
      validationStatus,
      verificationStatus,
      requiresReview: !success || verificationStatus === 'failed' || risk === 'high' || risk === 'critical',
      message: buildMessage({ success, operation, target, risk, verificationStatus, error }),
      metadata: {
        operation,
        risk,
        reversible,
        validationStatus,
        verificationStatus,
        targetPresent: Boolean(target)
      }
    };
  }
}

module.exports = ActionConfirmation;
module.exports._private = {
  sanitizeLabel,
  classifyRisk,
  reversibleFor,
  operationFrom,
  targetFrom
};
