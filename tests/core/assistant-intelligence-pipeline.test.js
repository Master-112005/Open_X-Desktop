const assert = require('assert');

describe('Assistant Intelligence Pipeline', function() {
  it('exposes the reusable pipeline infrastructure', async function() {
    const {
      PipelineBuilder,
      PipelineStage,
      StageResult
    } = require('../../core/assistant/pipeline');

    class TestStage extends PipelineStage {
      constructor() {
        super({ id: 'test.stage', order: 1 });
      }

      execute(context) {
        context.set('seen', context.rawInput);
        return StageResult.ok(this.id, { input: context.rawInput, source: context.source, options: context.options });
      }
    }

    const engine = new PipelineBuilder({ configuration: { timeoutMs: 1000 } })
      .registerStage(new TestStage())
      .build();

    const result = await engine.run({ rawInput: 'open chrome', source: 'chat', options: { safe: true } });

    assert.equal(result.success, true);
    assert.equal(result.output.input, 'open chrome');
    assert.equal(result.output.source, 'chat');
    assert.equal(result.stageResults[0].stageId, 'test.stage');
    assert.equal(result.context.shared.seen, 'open chrome');
    assert.equal(result.timing.stages.length, 1);
  });

  it('routes Assistant.processCommand through AssistantEngine while preserving behavior', async function() {
    const Assistant = require('../../core/assistant');
    const AssistantEngine = require('../../core/assistant/AssistantEngine');
    const routed = [];
    const router = {
      process: async (input, source, options) => {
        routed.push({ input, source, options });
        return {
          success: true,
          intent: 'app.open',
          entities: { appName: 'chrome' },
          response: `Opened from ${source}.`
        };
      }
    };
    const assistant = new Assistant({}, {
      router,
      automation: {},
      eventBus: { publish() {} }
    });

    const result = await assistant.processCommand('open chrome', 'phone', {
      phoneContext: { deviceId: 'phone_1' },
      permissionGuard: { source: 'test' }
    });

    assert.ok(assistant.engine instanceof AssistantEngine);
    assert.equal(result.success, true);
    assert.equal(result.intent, 'app.open');
    assert.equal(routed.length, 1);
    assert.equal(routed[0].input, 'open chrome');
    assert.equal(routed[0].source, 'phone');
    assert.deepEqual(routed[0].options.phoneContext, { deviceId: 'phone_1' });
    assert.deepEqual(routed[0].options.permissionGuard, { source: 'test' });
  });
});
