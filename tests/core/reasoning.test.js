const assert = require('assert');

function resolved(rawInput, extra = {}) {
  const { ResolvedContext } = require('../../core/assistant/memory/index.js');
  return new ResolvedContext({
    metadata: { rawInput },
    ...extra
  });
}

describe('Assistant Goal and Intent Reasoning Layer', function() {
  it('produces immutable deterministic ReasoningResult without planning, automation, or responses', async function() {
    const { createDefaultReasoningManager, ReasoningResult } = require('../../core/assistant/reasoning/index.js');
    const manager = createDefaultReasoningManager();
    const input = resolved('Play music on YouTube.', {
      browserState: { currentBrowser: 'Google Chrome' }
    });
    const first = await manager.reason(input);
    const second = await manager.reason(input);

    assert.ok(first instanceof ReasoningResult);
    assert.ok(Object.isFrozen(first));
    assert.ok(Object.isFrozen(first.reasoningGraph));
    assert.equal(first.resolvedGoal.id, 'media.playback');
    assert.equal(first.resolvedAction.action, 'PLAY_MEDIA');
    assert.deepEqual(first.candidateGoals, second.candidateGoals);
    assert.deepEqual(first.candidateActions, second.candidateActions);
    assert.equal(first.plan, undefined);
    assert.equal(first.automation, undefined);
    assert.equal(first.response, undefined);
  });

  it('returns consistent clarification requirements', async function() {
    const { createDefaultReasoningManager } = require('../../core/assistant/reasoning/index.js');
    const manager = createDefaultReasoningManager();
    const result = await manager.reason(resolved('Open browser.'));

    assert.ok(result.clarificationRequirements.some(item => item.field === 'browser'));
    assert.ok(result.missingInformation.some(item => item.field === 'browser'));
  });

  it('detects conflicts deterministically', async function() {
    const { createDefaultReasoningManager } = require('../../core/assistant/reasoning/index.js');
    const manager = createDefaultReasoningManager();
    const result = await manager.reason(resolved('Open Chrome and close Chrome.'));

    assert.ok(result.detectedConflicts.some(item => item.type === 'action-conflict' || item.type === 'text-conflict'));
  });

  it('does not invent opposite application actions from broad goals', async function() {
    const { createDefaultReasoningManager } = require('../../core/assistant/reasoning/index.js');
    const manager = createDefaultReasoningManager();
    const result = await manager.reason(resolved('Open Chrome.'));

    assert.ok(result.candidateActions.some(item => item.action === 'OPEN_APPLICATION'));
    assert.ok(!result.candidateActions.some(item => item.action === 'CLOSE_APPLICATION'));
  });

  it('uses structured entities for full media titles and planning metadata', async function() {
    const { createDefaultReasoningManager } = require('../../core/assistant/reasoning/index.js');
    const manager = createDefaultReasoningManager();
    const structuredEntities = {
      media: [{ value: 'Stars and Stripes Forever', confidence: 0.9 }],
      applications: [],
      browsers: [],
      files: [],
      folders: [],
      paths: [],
      contacts: [],
      reminders: [],
      alarms: [],
      timers: [],
      dates: [],
      times: [],
      durations: [],
      volumeLevels: [],
      brightnessLevels: []
    };
    const result = await manager.reason(resolved('Play Stars and Stripes Forever song.'), {
      metadata: { structuredEntities }
    });

    assert.equal(result.resolvedAction.action, 'PLAY_MEDIA');
    assert.equal(result.candidateActions[0].metadata.entities.mediaQuery, 'Stars and Stripes Forever');
    assert.equal(result.entitySummary.media, 1);
  });

  it('understands recurring reminder schedules as reminder actions', async function() {
    const { createDefaultReasoningManager } = require('../../core/assistant/reasoning/index.js');
    const manager = createDefaultReasoningManager();
    const structuredEntities = {
      reminders: [{ value: 'eat lunch', confidence: 0.86, metadata: { recurrence: 'saturday monday' } }],
      dates: [{ value: 'saturday monday', confidence: 0.76, metadata: { recurring: true } }],
      times: [{ value: '8pm', confidence: 0.86 }],
      applications: [],
      browsers: [],
      files: [],
      folders: [],
      paths: [],
      contacts: [],
      media: [],
      alarms: [],
      timers: [],
      durations: [],
      volumeLevels: [],
      brightnessLevels: []
    };
    const result = await manager.reason(resolved('remind me every saturday monday to eat lunch at 8pm'), {
      metadata: { structuredEntities }
    });

    assert.equal(result.resolvedAction.action, 'CREATE_REMINDER');
    assert.equal(result.candidateActions[0].metadata.entities.reminderText, 'eat lunch');
    assert.ok(result.candidateTasks.some(task => task.action === 'CREATE_REMINDER'));
  });

  it('deliberates over entity and context support before final action ranking', async function() {
    const { createDefaultReasoningManager } = require('../../core/assistant/reasoning/index.js');
    const manager = createDefaultReasoningManager();
    const structuredEntities = {
      files: [{ value: 'report.pdf', confidence: 0.9 }],
      paths: [],
      folders: [],
      applications: [],
      browsers: [],
      websites: [],
      contacts: [],
      media: [],
      dates: [],
      times: [],
      durations: [],
      reminders: [],
      alarms: [],
      timers: [],
      volumeLevels: [],
      brightnessLevels: []
    };
    const result = await manager.reason(resolved('open report file', {
      selections: { selectedFiles: ['C:\\Users\\User\\Documents\\report.pdf'] }
    }), {
      metadata: { structuredEntities }
    });

    assert.equal(result.resolvedAction.action, 'OPEN_FILE');
    assert.equal(result.candidateActions[0].metadata.deliberation.strengths.includes('target-language'), true);
    assert.ok(result.diagnostics.deliberation.actionEvaluations > 0);
    assert.equal(result.futureExtensions.deliberation.strategy, 'deterministic-reason-act-entity-context-rerank');
    assert.ok(result.reasoningGraph.path.includes('reasoning.deliberationReasoner'));
  });

  it('records deferred command decomposition for scheduled actions', async function() {
    const { createDefaultReasoningManager } = require('../../core/assistant/reasoning/index.js');
    const manager = createDefaultReasoningManager();
    const structuredEntities = {
      reminders: [{ value: 'drink water', confidence: 0.86 }],
      durations: [{ value: '10 minutes', confidence: 0.86 }],
      applications: [],
      browsers: [],
      files: [],
      folders: [],
      paths: [],
      contacts: [],
      media: [],
      dates: [],
      times: [],
      alarms: [],
      timers: [],
      volumeLevels: [],
      brightnessLevels: []
    };
    const result = await manager.reason(resolved('after 10 minutes remind me to drink water'), {
      metadata: { structuredEntities }
    });

    assert.equal(result.resolvedAction.action, 'CREATE_REMINDER');
    assert.equal(result.futureExtensions.deliberation.decomposition[0].kind, 'deferred');
    assert.ok(result.candidateActions[0].metadata.deliberation.strengths.includes('deferred-step'));
  });

  it('maps assistant reasoning requirements into cognitive dimensions', async function() {
    const { createDefaultReasoningManager } = require('../../core/assistant/reasoning/index.js');
    const manager = createDefaultReasoningManager();
    const input = [
      'I need help planning my trip tomorrow because I feel tired and stressed.',
      'Should I send my private photos to mom from home and delete all old files?',
      'Remember that I usually prefer early mornings; coordinate calendar and messages.',
      'Are you sure this is safe?'
    ].join(' ');
    const result = await manager.reason(resolved(input));
    const dimensions = new Set(result.futureExtensions.cognitiveReasoning.dimensions.map(item => item.id));

    for (const id of [
      'intent', 'context', 'personalMemory', 'preference', 'temporal',
      'causal', 'planning', 'commonSense', 'emotional', 'conversation',
      'knowledge', 'uncertainty', 'decision', 'privacy', 'learning',
      'spatial', 'identity', 'multiAgent', 'safety', 'selfReflection'
    ]) {
      assert.ok(dimensions.has(id), `missing cognitive dimension: ${id}`);
    }
    assert.equal(result.futureExtensions.cognitiveReasoning.safety.requiresConfirmation, true);
    assert.equal(result.futureExtensions.cognitiveReasoning.privacy.sensitive, true);
    assert.equal(result.futureExtensions.cognitiveReasoning.learning.shouldLearn, true);
  });

  it('detects hidden wellbeing intent without inventing an automation action', async function() {
    const { createDefaultReasoningManager } = require('../../core/assistant/reasoning/index.js');
    const manager = createDefaultReasoningManager();
    const result = await manager.reason(resolved('I am feeling tired.'));
    const cognitive = result.futureExtensions.cognitiveReasoning;

    assert.ok(cognitive.hiddenIntents.some(item => item.id === 'wellbeing.rest'));
    assert.ok(cognitive.dimensions.some(item => item.id === 'emotional'));
    assert.equal(result.resolvedAction, null);
  });

  it('asks for clarification when a reference-dependent command has no target context', async function() {
    const { createDefaultReasoningManager } = require('../../core/assistant/reasoning/index.js');
    const manager = createDefaultReasoningManager();
    const result = await manager.reason(resolved('delete it'));

    assert.equal(result.futureExtensions.cognitiveReasoning.uncertainty.requiresClarification, true);
    assert.ok(result.clarificationRequirements.some(item => item.field === 'target'));
  });

  it('propagates cognitive safety and privacy risk to dangerous action metadata', async function() {
    const { createDefaultReasoningManager } = require('../../core/assistant/reasoning/index.js');
    const manager = createDefaultReasoningManager();
    const structuredEntities = {
      files: [{ value: 'private photos', confidence: 0.88 }],
      folders: [],
      paths: [],
      applications: [],
      browsers: [],
      websites: [],
      contacts: [],
      people: [],
      media: [],
      dates: [],
      times: [],
      durations: [],
      reminders: [],
      alarms: [],
      timers: [],
      volumeLevels: [],
      brightnessLevels: []
    };
    const result = await manager.reason(resolved('delete all private photos'), {
      metadata: { structuredEntities }
    });
    const action = result.candidateActions.find(item => item.action === 'DELETE_FILE');

    assert.equal(result.futureExtensions.cognitiveReasoning.safety.level, 'high');
    assert.equal(result.futureExtensions.cognitiveReasoning.privacy.sensitive, true);
    assert.equal(action.metadata.requiresConfirmation, true);
    assert.equal(action.metadata.dangerous, true);
    assert.equal(action.metadata.privacySensitive, true);
  });

  it('builds a bounded cognitive reasoning graph for reviewable commands', async function() {
    const { createDefaultReasoningManager } = require('../../core/assistant/reasoning/index.js');
    const manager = createDefaultReasoningManager({
      configuration: { graphMaxNodes: 120, graphMaxEdges: 180 }
    });
    const structuredEntities = {
      files: [{ value: 'private photos', confidence: 0.88 }],
      folders: [],
      paths: [],
      applications: [],
      browsers: [],
      websites: [],
      contacts: [],
      people: [],
      media: [],
      dates: [],
      times: [],
      durations: [],
      reminders: [],
      alarms: [],
      timers: [],
      volumeLevels: [],
      brightnessLevels: []
    };
    const result = await manager.reason(resolved('delete all private photos'), {
      metadata: { structuredEntities }
    });
    const nodeTypes = new Set(result.reasoningGraph.nodes.map(node => node.type));
    const edgeTypes = new Set(result.reasoningGraph.edges.map(edge => edge.type));

    assert.ok(nodeTypes.has('cognitive-dimension'));
    assert.ok(nodeTypes.has('cognitive-safety'));
    assert.ok(nodeTypes.has('cognitive-privacy'));
    assert.ok(edgeTypes.has('requires-review'));
    assert.ok(edgeTypes.has('privacy-review'));
    assert.ok(result.reasoningGraph.stats.nodes <= 120);
    assert.ok(result.reasoningGraph.stats.edges <= 180);
    assert.equal(result.reasoningGraph.cognitiveSummary.safety, 'high');
    assert.equal(result.cognitiveReasoning.privacy.sensitive, true);
    assert.equal(result.diagnostics.graphStats.nodes, result.reasoningGraph.stats.nodes);
  });

  it('handles correction-style volume follow ups', async function() {
    const { createDefaultReasoningManager } = require('../../core/assistant/reasoning/index.js');
    const manager = createDefaultReasoningManager();
    const structuredEntities = {
      volumeLevels: [{ value: '40', confidence: 0.86 }],
      applications: [],
      browsers: [],
      files: [],
      folders: [],
      paths: [],
      contacts: [],
      media: [],
      dates: [],
      times: [],
      durations: [],
      reminders: [],
      alarms: [],
      timers: [],
      brightnessLevels: []
    };
    const result = await manager.reason(resolved('no no set it to 40'), {
      metadata: { structuredEntities }
    });

    assert.equal(result.resolvedAction.action, 'SET_VOLUME');
    assert.equal(result.candidateActions[0].metadata.entities.value, '40');
    assert.equal(result.metadata.isCorrection, true);
  });

  it('keeps reasoner order configurable', function() {
    const { createDefaultReasoningManager } = require('../../core/assistant/reasoning/index.js');
    const manager = createDefaultReasoningManager({
      configuration: {
        reasoners: {
          'reasoning.taskReasoner': { enabled: false }
        }
      }
    });
    const status = manager.getStatus();
    const ids = status.reasoners.map(reasoner => reasoner.id);

    assert.equal(ids[0], 'reasoning.inferenceEngine');
    assert.equal(ids[ids.length - 1], 'reasoning.graphBuilder');
    assert.ok(ids.includes('reasoning.cognitiveReasoner'));
    assert.ok(ids.includes('reasoning.deliberationReasoner'));
    assert.equal(status.reasoners.find(reasoner => reasoner.id === 'reasoning.taskReasoner').enabled, false);
  });

  it('redacts nested sensitive reasoning logger metadata', function() {
    const { ReasoningLogger } = require('../../core/assistant/reasoning/index.js');
    const calls = [];
    const logger = new ReasoningLogger({
      info: (message, data) => calls.push({ message, data })
    });

    logger.info('reasoning metadata', {
      account: { email: 'user@example.com', nested: { privateKey: 'secret' } },
      safe: 'value'
    });

    assert.equal(calls[0].data.account.email, '[REDACTED]');
    assert.equal(calls[0].data.account.nested.privateKey, '[REDACTED]');
    assert.equal(calls[0].data.safe, 'value');
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
