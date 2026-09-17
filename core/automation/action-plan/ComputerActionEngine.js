'use strict';

const { describeStep } = require('./ActionStepRegistry');

class ComputerActionEngine {
  constructor({ automationEngine, logger, settleMs = 700, maxSteps = 10 } = {}) {
    if (!automationEngine || typeof automationEngine.execute !== 'function') {
      throw new Error('ComputerActionEngine requires an automationEngine with an execute(actionId, entities) method');
    }
    this.automationEngine = automationEngine;
    this.logger = logger || null;
    this.settleMs = Number(settleMs) || 700;
    this.maxSteps = Number(maxSteps) || 10;
  }

  _log(level, message, data) {
    if (!this.logger) return;
    if (typeof this.logger.log === 'function') {
      this.logger.log(`${level}: ${message}`, data || {});
      return;
    }
    if (typeof this.logger[level] === 'function') {
      this.logger[level](message, data || {});
    }
  }

  _throwIfAborted(context) {
    if (context?.signal?.aborted) {
      const err = new Error('Computer action plan aborted');
      err.cancelled = true;
      err.name = 'CancellationError';
      throw err;
    }
  }

  async _sleep(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return;
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  async _executeAction(actionId, entities) {
    if (actionId === 'wait') return { success: true, data: {} };
    const execute = this.automationEngine.execute.bind(this.automationEngine);
    const result = await execute(actionId, entities || {});
    if (result && result.success === true) {
      return { success: true, data: result.data || {}, result };
    }
    return {
      success: false,
      data: result?.data || null,
      error: result?.error || result?.message || `Action ${actionId} did not complete`
    };
  }

  _resolveStepExecution(step = {}) {
    const type = String(step.type || '');
    const entities = { ...(step.entities || {}), ...(step.params || {}) };
    switch (type) {
      case 'open_application':
        return { actionId: 'app.open', entities };
      case 'close_application':
        return { actionId: 'app.close', entities };
      case 'focus_window':
        return { actionId: 'app.switch', entities };
      case 'window_control':
        if (entities.operation === 'minimize') return { actionId: 'window.minimize', entities };
        if (entities.operation === 'maximize') return { actionId: 'window.maximize', entities };
        return null;
      case 'type_text': {
        if (entities.source) {
          return { actionId: 'text.pasteFromFile', entities: this._withoutEmpty(entities) };
        }
        return { actionId: 'text.write', entities: this._withoutEmpty(entities) };
      }
      case 'save_file':
        return { actionId: 'text.write', entities: this._withoutEmpty(entities) };
      case 'create_file':
        return { actionId: 'file.create', entities: this._withoutEmpty(entities) };
      case 'calculate':
        return { actionId: 'system.calculate', entities: { expression: entities.expression } };
      case 'press_key':
      case 'hotkey':
        return { actionId: 'window.keys', entities: this._withoutEmpty(entities) };
      case 'open_url':
        return { actionId: 'browser.open', entities: this._withoutEmpty(entities) };
      case 'read_screen':
        return { actionId: 'system.screenshot', entities: {} };
      case 'find_element':
        return { actionId: 'window.find', entities: { name: entities.name, kind: entities.kind || 'window' } };
      case 'move_mouse':
        return { actionId: 'mouse.move', entities: { x: entities.x, y: entities.y } };
      case 'click':
        return {
          actionId: 'mouse.click',
          entities: { x: entities.x, y: entities.y, button: entities.button || 'left' }
        };
      case 'wait': {
        const ms = Math.max(0, Number(entities.ms) || 0);
        return { actionId: 'wait', entities: { ms, settleDelayMs: ms } };
      }
      default:
        return null;
    }
  }

  _withoutEmpty(entities) {
    const cleaned = {};
    Object.keys(entities || {}).forEach(key => {
      const value = entities[key];
      if (value === undefined || value === null || value === '') return;
      cleaned[key] = value;
    });
    return cleaned;
  }

  async executePlan(plan, context = {}) {
    const steps = Array.isArray(plan?.steps) ? plan.steps : [];
    if (steps.length === 0) {
      return { success: false, error: 'Empty computer action plan', steps: [] };
    }
    const executed = [];
    const bounded = steps.slice(0, this.maxSteps);
    for (const step of bounded) {
      this._throwIfAborted(context);
      if (step.skip === true) {
        executed.push({ ...step, success: true, skipped: true, data: {} });
        continue;
      }
      let result;
      if (step.type === 'wait') {
        const ms = Math.max(0, Number(step.params?.ms || step.entities?.ms) || 0);
        await this._sleep(ms);
        result = { success: true, data: { elapsedMs: ms } };
      } else {
        const mapping = this._resolveStepExecution(step);
        if (!mapping) {
          const unsupported = new Error(`Unsupported computer action step: ${step.type}`);
          this._log('error', unsupported.message, step);
          result = { success: false, data: null, error: unsupported.message };
        } else {
          result = await this._executeAction(mapping.actionId, mapping.entities);
        }
      }
      const record = {
        ...step,
        type: step.type,
        success: Boolean(result.success),
        skipped: Boolean(result.skipped),
        data: result.data || null,
        error: result.error || null,
        result: result.result || null
      };
      executed.push(record);
      if (!result.success) {
        return {
          success: false,
          steps: executed,
          failedStep: record,
          failureStepIndex: executed.length - 1,
          failureReason: describeStep({ ...step, entities: step.entities || {} })
        };
      }
    }
    const failed = executed.filter(step => !step.success);
    return { success: failed.length === 0, steps: executed };
  }
}

module.exports = ComputerActionEngine;