const assert = require('assert');

function reasoning(input = {}) {
  const { ReasoningResult } = require('../../core/assistant/reasoning/index.js');
  return new ReasoningResult({
    resolvedGoal: { id: 'send.document', name: 'Send Document', confidence: 0.8 },
    candidateGoals: [{ id: 'send.document', name: 'Send Document', confidence: 0.8 }],
    resolvedIntent: { intent: 'SendDocument', confidence: 0.72 },
    candidateIntents: [{ intent: 'SendDocument', confidence: 0.72 }],
    resolvedAction: { action: 'MOVE_FILE', confidence: 0.78 },
    candidateActions: [{ action: 'MOVE_FILE', confidence: 0.78 }],
    candidateTasks: [
      { task: 'Locate Document', confidence: 0.7 },
      { task: 'Compose Email', confidence: 0.64 },
      { task: 'Attach Document', confidence: 0.62 },
      { task: 'Send Message', confidence: 0.62 }
    ],
    metadata: { rawInput: 'send my report' },
    ...input
  });
}

describe('Assistant Task Planning Engine', function() {
  it('produces deterministic immutable ExecutionBlueprint without automation, validation, or responses', async function() {
    const { createDefaultPlanningManager, ExecutionBlueprint } = require('../../core/assistant/planning/index.js');
    const manager = createDefaultPlanningManager();
    const first = await manager.plan(reasoning());
    const second = await manager.plan(reasoning());

    assert.ok(first instanceof ExecutionBlueprint);
    assert.ok(Object.isFrozen(first));
    assert.ok(Object.isFrozen(first.taskGraph));
    assert.ok(Object.isFrozen(first.executionGraph));
    assert.equal(first.workflow.type, 'email');
    assert.deepEqual(first.tasks, second.tasks);
    assert.deepEqual(first.dependencies, second.dependencies);
    assert.equal(first.automation, undefined);
    assert.equal(first.validation, undefined);
    assert.equal(first.response, undefined);
  });

  it('builds deterministic dependencies and ordering', async function() {
    const { createDefaultPlanningManager } = require('../../core/assistant/planning/index.js');
    const blueprint = await createDefaultPlanningManager().plan(reasoning());

    assert.ok(blueprint.dependencies.some(item => item.from === 'compose.email' && item.to === 'attach.document'));
    assert.ok(blueprint.dependencies.some(item => item.from === 'attach.document' && item.to === 'send.message'));
    assert.equal(blueprint.ordering[0].taskId, 'locate.document');
  });

  it('builds parallel and recovery metadata deterministically', async function() {
    const { createDefaultPlanningManager } = require('../../core/assistant/planning/index.js');
    const blueprint = await createDefaultPlanningManager().plan(reasoning({
      resolvedGoal: { id: 'application.control', name: 'Application Control', confidence: 0.8 },
      candidateGoals: [{ id: 'application.control', name: 'Application Control', confidence: 0.8 }],
      candidateActions: [
        { action: 'OPEN_APPLICATION', confidence: 0.8, metadata: { app: 'Chrome' } },
        { action: 'OPEN_APPLICATION', confidence: 0.78, metadata: { app: 'VS Code' } }
      ],
      candidateTasks: []
    }));

    assert.ok(blueprint.parallelGroups.some(group => group.id === 'parallel.openApplications'));
    assert.equal(blueprint.recoveryPlan.length, blueprint.tasks.length);
  });

  it('keeps planner order configurable', function() {
    const { createDefaultPlanningManager } = require('../../core/assistant/planning/index.js');
    const manager = createDefaultPlanningManager({
      configuration: {
        planners: {
          'planning.parallelPlanner': { enabled: false }
        }
      }
    });
    const status = manager.getStatus();
    const ids = status.planners.map(planner => planner.id);

    assert.equal(ids[0], 'planning.taskPlanner');
    assert.equal(ids[ids.length - 1], 'planning.executionGraphBuilder');
    assert.equal(status.planners.find(planner => planner.id === 'planning.parallelPlanner').enabled, false);
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
