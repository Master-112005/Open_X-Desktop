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

  it('rejects malformed dependency graphs before automation dispatch', async function() {
    const { createDefaultDecisionValidationAutomationManager } = require('../../core/assistant/automation/index.js');
    const calls = [];
    const manager = createDefaultDecisionValidationAutomationManager({
      automationEngine: {
        getActions: () => ['app.open'],
        execute: async () => {
          calls.push('executed');
          return { success: true };
        }
      },
      configuration: { automation: { execute: true } }
    });
    const result = await manager.run(blueprint({
      dependencies: [{ from: 'open.application', to: 'missing.task' }]
    }), { metadata: { source: 'chat' } });

    assert.equal(result.decision.status, 'REJECT');
    assert.equal(result.executionStatus, 'REJECT');
    assert.equal(calls.length, 0);
    assert.ok(result.decision.blockers.some(item => item.type === 'missing-dependencies'));
  });

  it('rejects dependency cycles before automation dispatch', async function() {
    const { createDefaultDecisionValidationAutomationManager } = require('../../core/assistant/automation/index.js');
    const result = await createDefaultDecisionValidationAutomationManager().run(blueprint({
      tasks: [
        { id: 'a', label: 'a', action: 'OPEN_APPLICATION', metadata: { entities: { appName: 'chrome' } } },
        { id: 'b', label: 'b', action: 'OPEN_APPLICATION', metadata: { entities: { appName: 'code' } } }
      ],
      dependencies: [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }],
      ordering: [{ taskId: 'a', index: 0 }, { taskId: 'b', index: 1 }]
    }), { metadata: { source: 'chat' } });

    assert.equal(result.decision.status, 'REJECT');
    assert.ok(result.decision.blockers.some(item => item.type === 'dependency-cycle'));
  });

  it('requires confirmation for task metadata marked as high risk', async function() {
    const { createDefaultDecisionValidationAutomationManager } = require('../../core/assistant/automation/index.js');
    const result = await createDefaultDecisionValidationAutomationManager().run(blueprint({
      tasks: [{
        id: 'send.message',
        label: 'send message',
        action: 'SEND_MESSAGE',
        metadata: {
          risk: 'high',
          confirmationReason: 'sending a message needs review',
          entities: { contactName: 'Rahul', messageText: 'I agree' }
        }
      }],
      ordering: [{ taskId: 'send.message', index: 0 }]
    }), { metadata: { source: 'chat' } });

    assert.equal(result.decision.status, 'CONFIRM');
    assert.ok(result.decision.confirmationRequired.some(item => item.taskId === 'send.message'));
  });

  it('applies allow-list and task metadata policy blocks', async function() {
    const { createDefaultDecisionManager } = require('../../core/assistant/decision/index.js');
    const allowedDecision = await createDefaultDecisionManager({
      configuration: { allowedActions: ['OPEN_APPLICATION'] }
    }).decide(blueprint({
      tasks: [{ id: 'search.web', label: 'search', action: 'SEARCH_WEB', metadata: { entities: { query: 'news' } } }],
      ordering: [{ taskId: 'search.web', index: 0 }]
    }));
    const metadataDecision = await createDefaultDecisionManager().decide(blueprint({
      tasks: [{
        id: 'blocked.task',
        label: 'blocked',
        action: 'OPEN_APPLICATION',
        metadata: { policy: { allowed: false, reason: 'blocked for test' }, entities: { appName: 'chrome' } }
      }],
      ordering: [{ taskId: 'blocked.task', index: 0 }]
    }));

    assert.equal(allowedDecision.status, 'REJECT');
    assert.equal(allowedDecision.policyResults[0].policy, 'action-not-allowed');
    assert.equal(metadataDecision.status, 'REJECT');
    assert.equal(metadataDecision.policyResults[0].policy, 'metadata-policy');
  });

  it('detects target-aware conflicts without blocking unrelated app actions', async function() {
    const { createDefaultDecisionManager } = require('../../core/assistant/decision/index.js');
    const unrelated = await createDefaultDecisionManager().decide(blueprint({
      tasks: [
        { id: 'open.chrome', label: 'open chrome', action: 'OPEN_APPLICATION', metadata: { entities: { appName: 'chrome' } } },
        { id: 'close.notepad', label: 'close notepad', action: 'CLOSE_APPLICATION', metadata: { entities: { appName: 'notepad' } } }
      ],
      ordering: [{ taskId: 'open.chrome', index: 0 }, { taskId: 'close.notepad', index: 1 }]
    }));
    const sameTarget = await createDefaultDecisionManager().decide(blueprint({
      tasks: [
        { id: 'open.chrome', label: 'open chrome', action: 'OPEN_APPLICATION', metadata: { entities: { appName: 'chrome' } } },
        { id: 'close.chrome', label: 'close chrome', action: 'CLOSE_APPLICATION', metadata: { entities: { appName: 'chrome' } } }
      ],
      ordering: [{ taskId: 'open.chrome', index: 0 }, { taskId: 'close.chrome', index: 1 }]
    }));

    assert.equal(unrelated.status, 'EXECUTE');
    assert.equal(unrelated.conflicts.length, 0);
    assert.equal(sameTarget.status, 'CLARIFY');
    assert.equal(sameTarget.conflicts[0].target, 'chrome');
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

  it('validates and dispatches task-level automation route overrides consistently', async function() {
    const { createDefaultDecisionValidationAutomationManager } = require('../../core/assistant/automation/index.js');
    const calls = [];
    const fakeEngine = {
      getActions: () => ['app.switch'],
      execute: async (action, entities) => {
        calls.push({ action, entities });
        return { success: true };
      }
    };
    const manager = createDefaultDecisionValidationAutomationManager({
      automationEngine: fakeEngine,
      configuration: { automation: { execute: true } }
    });
    const result = await manager.run(blueprint({
      tasks: [{
        id: 'switch.application',
        label: 'switch application',
        action: 'OPEN_APPLICATION',
        metadata: {
          automationAction: 'app.switch',
          entities: { appName: 'chrome' }
        }
      }],
      ordering: [{ taskId: 'switch.application', index: 0, mode: 'sequential' }]
    }), { metadata: { source: 'chat' } });

    assert.equal(result.validation.valid, true);
    assert.equal(result.executionStatus, 'COMPLETED');
    assert.equal(calls[0].action, 'app.switch');
  });

  it('keeps validation route coverage aligned with dispatcher routes', function() {
    const { AutomationDispatcher } = require('../../core/assistant/automation/index.js');
    const { AutomationValidator } = require('../../core/assistant/validation/index.js');

    assert.deepEqual(AutomationValidator.ACTION_ROUTES, AutomationDispatcher.ACTION_ROUTES);
    for (const action of ['OPEN_APPLICATION', 'CLOSE_APPLICATION', 'SEARCH_WEB', 'PLAY_MEDIA', 'PAUSE_MEDIA', 'SET_VOLUME', 'OPEN_FOLDER', 'DELETE_FILE', 'MOVE_FILE', 'CREATE_REMINDER']) {
      assert.ok(AutomationDispatcher.ACTION_ROUTES[action], `missing route for ${action}`);
    }
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

  it('lets a disabled decision pipeline bypass decisions without blocking execution', async function() {
    const { createDefaultDecisionManager } = require('../../core/assistant/decision/index.js');
    const result = await createDefaultDecisionManager({
      configuration: { enabled: false }
    }).decide(blueprint());

    assert.equal(result.status, 'EXECUTE');
    assert.equal(result.ready, true);
  });

  it('supports decision registry lookup and removal for extensions', function() {
    const { DecisionRegistry, BaseDecision } = require('../../core/assistant/decision/index.js');
    const registry = new DecisionRegistry();
    const decision = new BaseDecision({ id: 'decision.custom' });

    registry.register(decision);
    assert.equal(registry.get('decision.custom'), decision);
    assert.equal(registry.unregister('decision.custom'), true);
    assert.equal(registry.get('decision.custom'), null);
    assert.equal(registry.clear(), 0);
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
