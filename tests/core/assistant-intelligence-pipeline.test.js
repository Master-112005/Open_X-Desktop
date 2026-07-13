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
    assert.equal(result.lastStageResult.stageId, 'test.stage');
    assert.equal(result.failedStageResults.length, 0);
  });

  it('bounds pipeline context state and exposes command input helpers', async function() {
    const {
      PipelineBuilder,
      PipelineStage,
      StageResult
    } = require('../../core/assistant/pipeline');

    class ContextStage extends PipelineStage {
      constructor() {
        super({ id: 'context.stage', order: 1 });
      }

      execute(context) {
        context.set('assistant.commandIntentText', 'open chrome');
        for (let index = 0; index < 30; index += 1) {
          context.addDiagnostic({ level: 'info', message: `diag-${index}` });
          context.set(`key-${index}`, index);
        }
        return StageResult.ok(this.id, {
          commandInput: context.getCommandInput(),
          sharedSize: context.shared.size,
          diagnostics: context.diagnostics.length
        });
      }
    }

    const engine = new PipelineBuilder({
      configuration: {
        maxDiagnostics: 5,
        maxSharedEntries: 4
      }
    }).registerStage(new ContextStage()).build();

    const result = await engine.run({ rawInput: 'please open chrome', source: 'chat' });

    assert.equal(result.success, true);
    assert.equal(result.output.commandInput, 'open chrome');
    assert.equal(result.output.sharedSize, 10);
    assert.equal(result.context.diagnostics.length, 25);
  });

  it('fails slow stages with stage timeout without hanging the command pipeline', async function() {
    const {
      PipelineBuilder,
      PipelineStage
    } = require('../../core/assistant/pipeline');
    const { sleep } = require('../../core/assistant/utils/AsyncHelpers');

    class SlowStage extends PipelineStage {
      constructor() {
        super({ id: 'slow.stage', order: 1 });
      }

      async execute() {
        await sleep(50);
        return { done: true };
      }
    }

    const engine = new PipelineBuilder({
      configuration: {
        stageTimeoutMs: 5,
        continueOnStageFailure: true
      }
    }).registerStage(new SlowStage()).build();

    const result = await engine.run({ rawInput: 'open chrome' });

    assert.equal(result.success, true);
    assert.equal(result.stageResults[0].success, false);
    assert.equal(result.stageResults[0].error.code, 'stage-timeout-error');
    assert.equal(result.failedStageResults.length, 1);
  });

  it('protects registry integrity and exposes health status', function() {
    const {
      PipelineBuilder,
      PipelineStage,
      ConfigurationError
    } = require('../../core/assistant/pipeline');

    class TestStage extends PipelineStage {
      constructor() {
        super({ id: 'unique.stage', order: 1 });
      }
    }

    const builder = new PipelineBuilder().registerStage(new TestStage());

    assert.throws(() => builder.registerStage(new TestStage()), ConfigurationError);
    assert.equal(builder.getStatus().stages[0].id, 'unique.stage');
    assert.equal(builder.getStatus().configuration.enabled, true);
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
    assert.ok(routed[0].options.pipelineContext);
    assert.ok(routed[0].options.resolvedContext);
    assert.ok(routed[0].options.structuredEntities);
  });
});
