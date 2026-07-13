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
    assert.equal(blueprint.ready, true);
    assert.equal(blueprint.actionCounts.MOVE_FILE, 1);
  });

  it('carries action entities and explicit dependencies into the execution blueprint', async function() {
    const { createDefaultPlanningManager } = require('../../core/assistant/planning/index.js');
    const blueprint = await createDefaultPlanningManager().plan(reasoning({
      metadata: { rawInput: 'open chrome then search ai news', entities: { appName: 'chrome' } },
      candidateTasks: [{ task: 'Open Chrome', action: 'OPEN_APPLICATION', confidence: 0.8 }],
      candidateActions: [{
        action: 'SEARCH_WEB',
        confidence: 0.78,
        metadata: { entities: { query: 'ai news' }, dependsOn: ['open.chrome'] }
      }]
    }));

    const searchTask = blueprint.tasks.find(task => task.action === 'SEARCH_WEB');

    assert.equal(blueprint.taskIndex['open.chrome'].metadata.entities.appName, 'chrome');
    assert.equal(searchTask.metadata.entities.query, 'ai news');
    assert.ok(blueprint.dependencies.some(item => item.from === 'open.chrome' && item.to === searchTask.id && item.type === 'explicit'));
    assert.ok(blueprint.executionGraph.edges.some(item => item.from === 'open.chrome' && item.to === searchTask.id));
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

  it('uses action-aware recovery and duration estimates', async function() {
    const { createDefaultPlanningManager } = require('../../core/assistant/planning/index.js');
    const blueprint = await createDefaultPlanningManager().plan(reasoning({
      candidateTasks: [],
      candidateActions: [
        { action: 'DELETE_FILE', confidence: 0.8, metadata: { entities: { filename: 'old.txt' } } },
        { action: 'OPEN_APPLICATION', confidence: 0.7, metadata: { entities: { appName: 'notepad' } } }
      ]
    }));
    const deleteRecovery = blueprint.recoveryPlan.find(item => item.taskId === 'delete.file');

    assert.deepEqual(deleteRecovery.strategies, ['abort-workflow']);
    assert.equal(deleteRecovery.retryLimit, 0);
    assert.ok(blueprint.estimatedDuration >= 20);
  });

  it('keeps graph references valid after optimization', async function() {
    const { createDefaultPlanningManager } = require('../../core/assistant/planning/index.js');
    const blueprint = await createDefaultPlanningManager().plan(reasoning({
      candidateTasks: [],
      candidateActions: [
        { action: 'OPEN_APPLICATION', confidence: 0.8, metadata: { entities: { appName: 'chrome' } } },
        { action: 'OPEN_APPLICATION', confidence: 0.78, metadata: { entities: { appName: 'edge' } } },
        { action: 'OPEN_APPLICATION', confidence: 0.76, metadata: { entities: { appName: 'notepad' } } }
      ]
    }));
    const ids = new Set(blueprint.tasks.map(task => task.id));

    assert.ok(blueprint.ordering.every(order => ids.has(order.taskId)));
    assert.ok(blueprint.dependencies.every(edge => ids.has(edge.from) && ids.has(edge.to)));
    assert.ok(blueprint.executionGraph.nodes.every(node => ids.has(node.id)));
  });

  it('enforces max task limits deterministically', async function() {
    const { createDefaultPlanningManager } = require('../../core/assistant/planning/index.js');
    const blueprint = await createDefaultPlanningManager({
      configuration: { maxTasks: 2 }
    }).plan(reasoning({
      candidateTasks: [
        { task: 'one', confidence: 0.8 },
        { task: 'two', confidence: 0.8 },
        { task: 'three', confidence: 0.8 }
      ],
      candidateActions: []
    }));

    assert.equal(blueprint.tasks.length, 2);
    assert.ok(blueprint.planningDiagnostics.warnings.some(item => item.message.includes('Task limit')));
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

  it('supports planning registry lookup and removal for extensions', function() {
    const { PlanningRegistry, BasePlanner } = require('../../core/assistant/planning/index.js');
    const registry = new PlanningRegistry();
    const planner = new BasePlanner({ id: 'planning.custom' });

    registry.register(planner);
    assert.equal(registry.get('planning.custom'), planner);
    assert.equal(registry.unregister('planning.custom'), true);
    assert.equal(registry.get('planning.custom'), null);
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
