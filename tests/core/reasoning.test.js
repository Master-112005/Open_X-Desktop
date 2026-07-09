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
    assert.equal(status.reasoners.find(reasoner => reasoner.id === 'reasoning.taskReasoner').enabled, false);
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
