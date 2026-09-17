'use strict';

const { isSupportedStepType } = require('./ActionStepRegistry');

const CONTEXT_STEP_TYPES = new Set(['open_application', 'focus_window', 'close_application']);
const TOUCH_STEP_TYPES = new Set([
  'type_text',
  'save_file',
  'create_file',
  'calculate',
  'window_control',
  'press_key',
  'hotkey',
  'click',
  'move_mouse',
  'read_screen',
  'find_element'
]);

const INTENT_TO_STEP = {
  'app.open': 'open_application',
  'app.switch': 'focus_window',
  'app.close': 'close_application',
  'text.write': 'type_text',
  'text.pasteFromFile': 'type_text',
  'system.calculate': 'calculate',
  'file.create': 'create_file',
  'window.minimize': 'window_control',
  'window.maximize': 'window_control'
};

const ROUTER_INTERNAL_ENTITY_KEYS = new Set([
  'intent',
  'confidence',
  'confirmedInput',
  'confirmationRequired',
  'permissionDenied',
  'requiresConfirmation'
]);

const DATE_PHRASE_PATTERN = /\b(?:today'?s?\s+date|todays\s+date|current\s+date|date\s+today|the\s+date)\b/i;

class ComputerActionPlanner {
  constructor(options = {}) {
    this.resolveIntent = options.resolveIntent || null;
    this.resolveWritableText = options.resolveWritableText || null;
    this.resolveSystemDate = options.resolveSystemDate || null;
    this.extractExpression = options.extractExpression || null;
    this.userDisplayName = options.userDisplayName || 'Rakesh';
    this.settleMs = Number(options.settleMs) || 700;
    this.logger = options.logger || null;
  }

  _log(level, message, data) {
    if (this.logger) {
      if (typeof this.logger.log === 'function') this.logger.log(`${level}: ${message}`, data || {});
      else if (typeof this.logger[level] === 'function') this.logger[level](message, data || {});
    }
  }

  _cleanEntities(entities = {}) {
    const cleaned = {};
    Object.keys(entities).forEach(key => {
      if (ROUTER_INTERNAL_ENTITY_KEYS.has(key)) return;
      const value = entities[key];
      if (value === undefined || value === null || value === '') return;
      if (typeof value === 'string' && key === 'text') {
        cleaned[key] = value;
        return;
      }
      cleaned[key] = value;
    });
    return cleaned;
  }

  _saveAsClause(text) {
    const raw = String(text || '').trim();
    const pronounMatch = raw.match(/^(?:save|store|write\s+to|write\s+it\s+to)\s+(?:it|this|that|the\s+text|the\s+content|this\s+content)\s*(?:as|to|in|into)?\s+(.+)$/i);
    const filenameSource = pronounMatch?.[1] || null;
    if (filenameSource) {
      const filename = String(filenameSource)
        .replace(/[?.!]+$/g, '')
        .replace(/\s+please\s*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      return filename ? { filename } : null;
    }
    const directMatch = raw.match(/^(?:save|store)\s+(?:as|to|into)?\s+(.+)$/i);
    if (directMatch?.[1]) {
      const filename = String(directMatch[1])
        .replace(/[?.!]+$/g, '')
        .replace(/\s+please\s*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      const looksLikeDetidedReference = /^(?:the|a|an|my|this|that)\s+/i.test(filename);
      const hasExtension = /\.[A-Za-z0-9]{1,10}\b/.test(filename);
      const isKnownFileToken = /\b(?:file|document|workbook|spreadsheet|note|notes|txt|text|md|markdown|pdf|doc|docx|sheet)\b/i.test(filename);
      if (filename && ((hasExtension || isKnownFileToken) && !(looksLikeDetidedReference && !hasExtension && !/\b(?:file|document|note|txt|sheet)\b/i.test(filename)))) {
        return { filename };
      }
    }
    return null;
  }

  _saveFileNameFromEntities(entities = {}) {
    return String(entities.filename || entities.fileName || entities.path || '').trim();
  }

  async _resolveDateText(text) {
    if (!DATE_PHRASE_PATTERN.test(text) || String(text).length > 40) return null;
    if (typeof this.resolveSystemDate === 'function') {
      try {
        const date = await this.resolveSystemDate();
        if (date) return date;
      } catch (err) {
        this._log('error', 'System date resolution failed', err);
      }
    }
    return null;
  }

  _stepForClause(clause, source) {
    const text = String(clause || '').trim();
    if (!text) return null;

    if (typeof this.resolveIntent === 'function') {
      const resolved = this.resolveIntent(text, source);
      if (resolved?.intent) {
        const stepType = INTENT_TO_STEP[String(resolved.intent.id || resolved.intent)];
        if (stepType && isSupportedStepType(stepType)) {
          if (stepType === 'open_application' && String(resolved.intent.id || resolved.intent) === 'app.open') {
            const appHint = String(resolved.entities?.appName || '').trim().toLowerCase();
            if (/^(?:calc|calculator)$/.test(appHint) && /^(?:calculate|calc)\b/i.test(text) && typeof this.extractExpression === 'function') {
              const expression = this.extractExpression(text);
              if (expression) {
                return { type: 'calculate', intent: 'system.calculate', entities: { expression } };
              }
            }
          }
          return { type: stepType, intent: String(resolved.intent.id || resolved.intent), entities: resolved.entities || {} };
        }
        return { type: null, excluded: true, intent: String(resolved.intent.id || resolved.intent) };
      }
    }

    return null;
  }

  _finalizeStepParams(step, carriedApp) {
    const entities = step.entities || {};
    const params = {
      ...this._cleanEntities(entities),
      ...(entities.filename !== undefined ? { filename: entities.filename } : {}),
      ...(entities.path !== undefined ? { path: entities.path } : {})
    };
    delete params.expression;
    delete params.windowName;

    switch (step.type) {
      case 'open_application':
        params.appName = String(entities.appName || entities.targetApp || '').trim();
        break;
      case 'focus_window':
        params.appName = String(entities.appName || entities.targetApp || entities.windowName || '').trim();
        break;
      case 'close_application':
        params.appName = String(entities.appName || entities.targetApp || '').trim();
        break;
      case 'type_text': {
        let text = String(entities.text || '').trim();
        text = this.resolveWritableText ? this.resolveWritableText(text) : text;
        if (!text) return null;
        params.text = text;
        if (entities.source) params.source = String(entities.source).trim();
        if (entities.filename) params.filename = String(entities.filename).trim();
        if (entities.appName) params.appName = String(entities.appName).trim();
        else if (entities.windowName) params.windowName = String(entities.windowName).trim();
        else if (carriedApp) params.appName = carriedApp;
        if (params.appName || params.windowName) params.settleDelayMs = this.settleMs;
        break;
      }
      case 'save_file': {
        let text = String(entities.text || '').trim();
        text = this.resolveWritableText ? this.resolveWritableText(text) : text;
        if (text) params.text = text;
        else delete params.text;
        break;
      }
      case 'create_file':
        params.filename = String(entities.filename || entities.fileName || '').trim();
        params.path = entities.path ? String(entities.path).trim() : null;
        break;
      case 'calculate':
        params.expression = String(entities.expression || entities.calculation || entities.query || '').trim();
        break;
      case 'window_control':
        params.operation = String(step.intent === 'window.minimize' ? 'minimize' : 'maximize');
        break;
      default:
        break;
    }

    return params;
  }

  async buildPlan(clauses, options = {}) {
    const rawClauses = Array.isArray(clauses) ? clauses.map(clause => String(clause || '').trim()).filter(Boolean).slice(0, 6) : [];
    if (rawClauses.length < 2) return null;

    const planSteps = [];
    let carriedApp = null;
    let carriedText = null;

    for (const clause of rawClauses) {
      const saveAs = this._saveAsClause(clause);
      if (saveAs) {
        const step = {
          type: 'save_file',
          intent: 'text.write',
          clauseInput: clause,
          routedInput: clause,
          entities: { filename: saveAs.filename },
          params: { filename: saveAs.filename },
          optional: false,
          appContext: carriedApp ? { appName: carriedApp } : null
        };
        if (carriedText) {
          step.params.text = carriedText;
          step.entities.text = carriedText;
        } else {
          step.type = 'create_file';
          step.intent = 'file.create';
        }
        planSteps.push(step);
        continue;
      }

      const stepHint = this._stepForClause(clause, options.source);
      if (!stepHint || stepHint.excluded) return null;

      const step = {
        type: stepHint.type,
        intent: stepHint.intent,
        clauseInput: clause,
        routedInput: clause,
        entities: stepHint.entities || {},
        params: {},
        optional: false
      };

      const params = this._finalizeStepParams(step, carriedApp);
      if (!params) return null;
      step.params = params;
      step.appContext = carriedApp ? { appName: carriedApp } : null;

      if (this._wantsCarriedContext(step) && !carriedApp) {
        return null;
      }

      if (step.type === 'type_text') {
        const resolvedDate = await this._resolveDateText(String(params.text || ''));
        if (resolvedDate) params.text = resolvedDate;
        if (params.text) carriedText = params.text;
      }

      if (params.appName || params.windowName) {
        if (step.type === 'open_application' || step.type === 'focus_window') {
          carriedApp = params.appName || params.windowName;
        }
      }

      planSteps.push(step);
    }

    if (planSteps.length < 2) return null;

    const hasContext = planSteps.some(step => CONTEXT_STEP_TYPES.has(step.type));
    const hasTouch = planSteps.some(step => TOUCH_STEP_TYPES.has(step.type));
    if (!hasTouch || !hasContext) return null;

    const allOpenList = planSteps.every(step => step.type === 'open_application');
    if (allOpenList) return null;

    return {
      id: `plan_${Date.now().toString(36)}`,
      source: options.source || 'chat',
      clauses: rawClauses,
      steps: planSteps,
      settleMs: this.settleMs
    };
  }

  _wantsCarriedContext(step) {
    if (!TOUCH_STEP_TYPES.has(step.type)) return false;
    if (step.type === 'calculate' || step.type === 'read_screen' || step.type === 'find_element' || step.type === 'move_mouse' || step.type === 'click') {
      return false;
    }
    if (step.type === 'create_file' || step.type === 'save_file') return false;
    const params = step.params || {};
    return !params.appName && !params.windowName && !params.filename && !params.source;
  }

  static serialize(plan) {
    if (!plan) return null;
    return {
      source: plan.source || 'chat',
      steps: (plan.steps || []).map(step => ({
        action: step.type,
        description: `${step.type.replace(/_/g, ' ')} (${step.intent})`,
        params: step.params || {}
      }))
    };
  }

  static toJSON(plan) {
    return JSON.stringify(ComputerActionPlanner.serialize(plan), null, 2);
  }
}

module.exports = ComputerActionPlanner;