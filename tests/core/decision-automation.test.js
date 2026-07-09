const assert = require('assert');

function blueprint(input = {}) {
  const { ExecutionBlueprint } = require('../../core/assistant/planning/index.js');
  return new ExecutionBlueprint({
    tasks: [{
      id: 'open.application',
      label: 'open application',
      action: 'OPEN_APPLICATION',
      retryable: true,
      cancelable: true,
      metadata: { entities: { appName: 'chrome' } }
    }],
    workflow: { id: 'workflow.application', type: 'application', tasks: ['open.application'] },
    dependencies: [],
    ordering: [{ taskId: 'open.application', index: 0, mode: 'sequential', retryable: true, cancelable: true }],
    metadata: { rawInput: 'open chrome' },
    ...input
  });
}

describe('Assistant Decision, Validation, and Automation Layer', function() {
  it('produces deterministic immutable AutomationResult without dispatch by default', async function() {
    const { createDefaultDecisionValidationAutomationManager, AutomationResult } = require('../../core/assistant/automation/index.js');
    const manager = createDefaultDecisionValidationAutomationManager();
    const first = await manager.run(blueprint(), { metadata: { source: 'chat' } });
    const second = await manager.run(blueprint(), { metadata: { source: 'chat' } });

    assert.ok(first instanceof AutomationResult);
    assert.ok(Object.isFrozen(first));
    assert.ok(Object.isFrozen(first.executionGraph));
    assert.equal(first.decision.status, 'EXECUTE');
    assert.equal(first.validation.valid, true);
    assert.equal(first.executionStatus, 'NOT_DISPATCHED');
    assert.deepEqual(first.skippedActions, second.skippedActions);
  });

  it('requires confirmation for dangerous actions before execution', async function() {
    const { createDefaultDecisionValidationAutomationManager } = require('../../core/assistant/automation/index.js');
    const manager = createDefaultDecisionValidationAutomationManager();
    const result = await manager.run(blueprint({
      tasks: [{
        id: 'delete.file',
        label: 'delete file',
        action: 'DELETE_FILE',
        metadata: { entities: { filename: 'report.pdf' } }
      }],
      ordering: [{ taskId: 'delete.file', index: 0, mode: 'sequential' }]
    }), { metadata: { source: 'chat' } });

    assert.equal(result.decision.status, 'CONFIRM');
    assert.equal(result.executionStatus, 'CONFIRM');
    assert.ok(result.decision.confirmationRequired.some(item => item.action === 'DELETE_FILE'));
  });

  it('dispatches through an injected automation engine only when enabled', async function() {
    const { createDefaultDecisionValidationAutomationManager } = require('../../core/assistant/automation/index.js');
    const calls = [];
    const fakeEngine = {
      getActions: () => ['app.open'],
      execute: async (action, entities, context) => {
        calls.push({ action, entities, context });
        return { success: true, data: { action, entities } };
      }
    };
    const manager = createDefaultDecisionValidationAutomationManager({
      automationEngine: fakeEngine,
      configuration: {
        automation: { execute: true }
      }
    });
    const result = await manager.run(blueprint(), { metadata: { source: 'chat' } });

    assert.equal(result.executionStatus, 'COMPLETED');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].action, 'app.open');
    assert.deepEqual(calls[0].entities, { appName: 'chrome' });
    assert.equal(result.completedActions.length, 1);
  });

  it('keeps decision and validation component order configurable', function() {
    const { createDefaultDecisionManager } = require('../../core/assistant/decision/index.js');
    const { createDefaultValidationManager } = require('../../core/assistant/validation/index.js');
    const decisions = createDefaultDecisionManager({
      configuration: { decisions: { 'decision.policy': { enabled: false } } }
    }).getStatus().decisions;
    const validators = createDefaultValidationManager({
      configuration: { validators: { 'validation.context': { enabled: false } } }
    }).getStatus().validators;

    assert.equal(decisions[0].id, 'decision.engine');
    assert.equal(decisions[decisions.length - 1].id, 'decision.conflict');
    assert.equal(decisions.find(item => item.id === 'decision.policy').enabled, false);
    assert.equal(validators[0].id, 'validation.permission');
    assert.equal(validators[validators.length - 1].id, 'validation.constraint');
    assert.equal(validators.find(item => item.id === 'validation.context').enabled, false);
  });

  it('runs inside the assistant pipeline without changing routed plain text', async function() {
    const Assistant = require('../../core/assistant');
    const routed = [];
    const assistant = new Assistant({}, {
      automation: {},
      eventBus: { publish() {} },
      router: {
        process: async (input, source, options) => {
          routed.push({ input, source, options });
          return { success: true, intent: 'app.open', entities: { appName: 'chrome' }, response: input };
        }
      }
    });

    const result = await assistant.processCommand('launch chrome', 'chat');

    assert.equal(result.success, true);
    assert.equal(routed[0].input, 'launch chrome');
    assert.equal(routed[0].source, 'chat');
  });
});
