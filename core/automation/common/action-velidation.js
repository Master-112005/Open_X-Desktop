const path = require('path');

const MAX_ENTITY_TEXT_LENGTH = 500;
const VALIDATION_STATUS = Object.freeze({
  PASSED: 'passed',
  FAILED: 'failed'
});

const DEVICE_VALUE_ACTIONS = new Set([
  'volume.set',
  'volume.up',
  'volume.down',
  'brightness.set',
  'brightness.up',
  'brightness.down'
]);

const PATH_ENTITY_NAMES = new Set([
  'path',
  'source',
  'destination',
  'sourcePath',
  'selectedPath',
  'filename',
  'folderName',
  'oldName',
  'newName'
]);

function sanitizeText(value, fallback = '') {
  return String(value ?? fallback ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function normalizeActionId(intent = {}) {
  return sanitizeText(intent.id || intent.action || intent.name || 'action').toLowerCase();
}

function requiredFields(intent = {}) {
  if (!Array.isArray(intent.entities)) {
    return [];
  }

  return intent.entities
    .filter(entity => entity?.required)
    .map(entity => sanitizeText(entity.name))
    .filter(Boolean);
}

function issue(id, field, message, severity = 'error', detail = {}) {
  return {
    id,
    field: field || null,
    severity,
    message: sanitizeText(message),
    ...detail
  };
}

function looksLikeUrl(value) {
  const source = String(value || '').trim();
  if (!source) {
    return false;
  }
  if (/^(?:https?|mailto|chrome|edge|about|file):/i.test(source)) {
    return true;
  }
  try {
    new URL(source);
    return true;
  } catch (error) {
    return /^[a-z0-9.-]+\.[a-z]{2,}(?:[/?#].*)?$/i.test(source);
  }
}

function hasPathTraversal(value) {
  const text = String(value || '');
  if (!text) {
    return false;
  }

  const normalized = text.replace(/[\\/]+/g, path.sep);
  return normalized.split(path.sep).some(part => part === '..') ||
    /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(text);
}

function hasReservedWindowsName(value) {
  const parsed = path.parse(String(value || '').trim());
  const name = (parsed.name || parsed.base || '').toUpperCase();
  return /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(name);
}

function hasControlCharacters(value) {
  return /[\u0000-\u001F\u007F]/.test(String(value || ''));
}

function compactEntities(entities = {}) {
  const compact = {};
  for (const [key, value] of Object.entries(entities || {})) {
    if (typeof value === 'string') {
      compact[key] = sanitizeText(value).slice(0, 120);
    } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      compact[key] = value;
    }
  }
  return compact;
}

class ActionValidation {
  validate(intent, entities = {}) {
    const actionId = normalizeActionId(intent);
    const missing = requiredFields(intent).filter(name => !hasValue(entities[name]));
    const errors = missing.map(name => issue(
      'validation.required',
      name,
      `Missing required value: ${name}`,
      'error'
    ));
    const warnings = [];

    this._validateEntityShape(entities, errors, warnings);
    this._validateActionSemantics(actionId, entities, errors, warnings);

    const valid = errors.length === 0;
    return {
      valid,
      status: valid ? VALIDATION_STATUS.PASSED : VALIDATION_STATUS.FAILED,
      missing,
      errors,
      warnings,
      actionId,
      sanitizedEntities: compactEntities(entities),
      confidence: valid ? (warnings.length > 0 ? 0.82 : 0.96) : 0.2,
      summary: {
        requiredCount: requiredFields(intent).length,
        missingCount: missing.length,
        errorCount: errors.length,
        warningCount: warnings.length
      }
    };
  }

  _validateEntityShape(entities, errors, warnings) {
    for (const [key, value] of Object.entries(entities || {})) {
      if (typeof value !== 'string') {
        continue;
      }

      if (hasControlCharacters(value)) {
        errors.push(issue(
          'validation.controlCharacters',
          key,
          `${key} contains unsupported control characters`
        ));
      }

      if (value.length > MAX_ENTITY_TEXT_LENGTH) {
        warnings.push(issue(
          'validation.longEntity',
          key,
          `${key} is unusually long and may be truncated in responses`,
          'warning',
          { maxLength: MAX_ENTITY_TEXT_LENGTH }
        ));
      }

      if (PATH_ENTITY_NAMES.has(key) && hasReservedWindowsName(value)) {
        errors.push(issue(
          'validation.windowsReservedName',
          key,
          `${key} uses a reserved Windows device name`
        ));
      }

      if (PATH_ENTITY_NAMES.has(key) && hasPathTraversal(value)) {
        warnings.push(issue(
          'validation.pathTraversal',
          key,
          `${key} contains parent-directory traversal and will need a safe resolved path`,
          'warning'
        ));
      }
    }
  }

  _validateActionSemantics(actionId, entities, errors, warnings) {
    if (DEVICE_VALUE_ACTIONS.has(actionId) && hasValue(entities.value)) {
      this._validatePercentValue(actionId, 'value', entities.value, errors);
    }

    if (actionId.startsWith('browser.')) {
      this._validateBrowserAction(actionId, entities, errors);
    }

    if (actionId.startsWith('timer.') || actionId.startsWith('alarm.') || actionId.startsWith('reminder.')) {
      this._validateScheduleAction(actionId, entities, errors, warnings);
    }

    if (actionId.startsWith('file.') || actionId.startsWith('folder.') || actionId === 'phone.sendfile') {
      this._validateFileLikeAction(actionId, entities, errors);
    }

    if (actionId === 'system.calculate' && hasValue(entities.expression)) {
      this._validateCalculationExpression(entities.expression, errors);
    }
  }

  _validatePercentValue(actionId, field, value, errors) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      errors.push(issue('validation.percentValue', field, `${actionId} needs a numeric percent value`));
      return;
    }
    if (numeric < 0 || numeric > 100) {
      errors.push(issue('validation.percentRange', field, `${actionId} value must be between 0 and 100`, 'error', {
        min: 0,
        max: 100,
        value: numeric
      }));
    }
  }

  _validateBrowserAction(actionId, entities, errors) {
    const urlActions = new Set(['browser.open', 'browser.openurl']);
    if (urlActions.has(actionId) && hasValue(entities.url) && !looksLikeUrl(entities.url)) {
      errors.push(issue('validation.url', 'url', 'Browser URL is not in a supported format'));
    }

    if (actionId === 'browser.sitesearch' && !hasValue(entities.site)) {
      errors.push(issue('validation.site', 'site', 'Site search needs a site name'));
    }
  }

  _validateScheduleAction(actionId, entities, errors, warnings) {
    if (actionId === 'timer.set' && hasValue(entities.duration)) {
      const duration = Number(entities.duration);
      if (!Number.isFinite(duration) || duration <= 0) {
        errors.push(issue('validation.duration', 'duration', 'Timer duration must be a positive number of minutes'));
      }
      if (Number.isFinite(duration) && duration > 1440) {
        warnings.push(issue('validation.longTimer', 'duration', 'Timer duration is longer than one day', 'warning'));
      }
    }

    if (actionId === 'alarm.set' && hasValue(entities.timeExpression) && !/[0-9]|noon|midnight|morning|evening|night/i.test(String(entities.timeExpression))) {
      warnings.push(issue('validation.timeExpression', 'timeExpression', 'Alarm time is ambiguous', 'warning'));
    }

    if (actionId === 'reminder.set' && hasValue(entities.reminderText) && String(entities.reminderText).trim().length < 2) {
      errors.push(issue('validation.reminderText', 'reminderText', 'Reminder text is too short'));
    }
  }

  _validateFileLikeAction(actionId, entities, errors) {
    const deleteLike = /(?:delete|remove|clear)$/i.test(actionId);
    if (deleteLike && entities.force === true && entities.confirmed !== true) {
      errors.push(issue(
        'validation.deleteConfirmation',
        'confirmed',
        'Destructive file or folder actions must be explicitly confirmed before execution'
      ));
    }
  }

  _validateCalculationExpression(expression, errors) {
    const text = String(expression || '');
    if (/[;&|`$<>]/.test(text)) {
      errors.push(issue(
        'validation.calculationExpression',
        'expression',
        'Calculation expression contains unsupported command characters'
      ));
    }
  }
}

module.exports = ActionValidation;
module.exports._private = {
  sanitizeText,
  hasPathTraversal,
  hasReservedWindowsName,
  looksLikeUrl,
  requiredFields
};
