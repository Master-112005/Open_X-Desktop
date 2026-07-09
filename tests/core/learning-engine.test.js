const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openx-learning-engine-'));
}

function assistantResponse(rawInput = 'preferred browser is Chrome') {
  const { AutomationResult } = require('../../core/assistant/automation/index.js');
  const { createDefaultVerificationManager } = require('../../core/assistant/verification/index.js');
  const { createDefaultResponseManager } = require('../../core/assistant/response/index.js');
  const automation = new AutomationResult({
    executionStatus: 'COMPLETED',
    completedActions: [{ taskId: 'open.application', action: 'OPEN_APPLICATION', route: 'app.open', success: true }],
    failedActions: [],
    skippedActions: [],
    controllerResults: [],
    executionGraph: { nodes: [], edges: [] },
    metadata: { rawInput }
  });
  return createDefaultVerificationManager()
    .verify(automation)
    .then(result => createDefaultResponseManager().generate(result));
}

describe('Assistant Learning Engine', function() {
  it('produces immutable LearningResult and stores approved learning only after response', async function() {
    const { createDefaultLearningManager, LearningResult } = require('../../core/assistant/learning/index.js');
    const baseDir = tempDir();
    const manager = createDefaultLearningManager({
      configuration: {
        clock: () => '2026-07-09T00:00:00.000Z',
        storage: { baseDir }
      }
    });
    const result = await manager.learn(await assistantResponse(), {
      metadata: { rawInput: 'preferred browser is Chrome', source: 'chat' }
    });

    assert.ok(result instanceof LearningResult);
    assert.ok(Object.isFrozen(result));
    assert.equal(result.completed, true);
    assert.deepEqual(result.updatedPreferences, [{ key: 'browser', value: 'Chrome' }]);
    assert.ok(fs.existsSync(path.join(baseDir, 'preferences.json')));
  });

  it('rejects sensitive learning events before storage', async function() {
    const { createDefaultLearningManager } = require('../../core/assistant/learning/index.js');
    const baseDir = tempDir();
    const manager = createDefaultLearningManager({
      configuration: {
        clock: () => '2026-07-09T00:00:00.000Z',
        storage: { baseDir }
      }
    });
    const result = await manager.learn(await assistantResponse('remember token means sk-test-secret-secret-secret'), {
      metadata: { rawInput: 'remember token means sk-test-secret-secret-secret', source: 'chat' }
    });

    assert.equal(result.updatedAliases.length, 0);
    assert.ok(result.itemsRejected.some(item => /sensitive|not permitted|Key/.test(item.reason)));
  });

  it('runs inside the assistant pipeline without changing routed plain text', async function() {
    const Assistant = require('../../core/assistant');
    const routed = [];
    const assistant = new Assistant({
      assistantIntelligence: {
        pipeline: { learning: { storage: { baseDir: tempDir() } } }
      }
    }, {
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
