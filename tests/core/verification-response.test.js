const assert = require('assert');

function automationResult(input = {}) {
  const { AutomationResult } = require('../../core/assistant/automation/index.js');
  return new AutomationResult({
    executionStatus: 'COMPLETED',
    completedActions: [{ taskId: 'open.application', action: 'OPEN_APPLICATION', route: 'app.open', success: true }],
    failedActions: [],
    skippedActions: [],
    controllerResults: [{ taskId: 'open.application', action: 'OPEN_APPLICATION', route: 'app.open', success: true }],
    executionGraph: {
      nodes: [{ id: 'open.application', action: 'OPEN_APPLICATION', status: 'completed' }],
      edges: []
    },
    metadata: { rawInput: 'open chrome' },
    ...input
  });
}

describe('Assistant Verification and Response Layer', function() {
  it('produces deterministic immutable VerificationResult and graph', async function() {
    const { createDefaultVerificationManager, VerificationResult } = require('../../core/assistant/verification/index.js');
    const manager = createDefaultVerificationManager();
    const first = await manager.verify(automationResult());
    const second = await manager.verify(automationResult());

    assert.ok(first instanceof VerificationResult);
    assert.ok(Object.isFrozen(first));
    assert.ok(Object.isFrozen(first.verificationGraph));
    assert.equal(first.executionStatus, 'COMPLETED');
    assert.equal(first.successfulActions.length, 1);
    assert.deepEqual(first.evidence, second.evidence);
  });

  it('produces deterministic channel-specific AssistantResponse', async function() {
    const { createDefaultVerificationManager } = require('../../core/assistant/verification/index.js');
    const { createDefaultResponseManager, AssistantResponse } = require('../../core/assistant/response/index.js');
    const verification = await createDefaultVerificationManager().verify(automationResult());
    const first = await createDefaultResponseManager().generate(verification);
    const second = await createDefaultResponseManager().generate(verification);

    assert.ok(first instanceof AssistantResponse);
    assert.ok(Object.isFrozen(first));
    assert.equal(first.responseType, 'confirmation');
    assert.equal(first.formattedVoiceResponse, '1 action completed successfully.');
    assert.equal(first.formattedChatResponse, second.formattedChatResponse);
    assert.ok(first.formattedNotification.length <= 90);
  });

  it('keeps verifier and response generator order configurable', function() {
    const { createDefaultVerificationManager } = require('../../core/assistant/verification/index.js');
    const { createDefaultResponseManager } = require('../../core/assistant/response/index.js');
    const verifiers = createDefaultVerificationManager({
      configuration: { verifiers: { 'verification.cloud': { enabled: false } } }
    }).getStatus().verifiers;
    const generators = createDefaultResponseManager({
      configuration: { generators: { 'response.suggestion': { enabled: false } } }
    }).getStatus().generators;

    assert.equal(verifiers[0].id, 'verification.execution');
    assert.equal(verifiers[verifiers.length - 1].id, 'verification.graphBuilder');
    assert.equal(verifiers.find(item => item.id === 'verification.cloud').enabled, false);
    assert.equal(generators[0].id, 'response.confirmation');
    assert.equal(generators[generators.length - 1].id, 'response.notificationFormatter');
    assert.equal(generators.find(item => item.id === 'response.suggestion').enabled, false);
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
