const assert = require('assert');

describe('Assistant Input Acquisition Layer', function() {
  it('creates a standard RawUserInput for every supported input source', function() {
    const { createDefaultInputSourceManager } = require('../../core/assistant/acquisition');
    const manager = createDefaultInputSourceManager();
    const samples = [
      ['chat', 'open chrome', {}],
      ['voice', 'open chrome', { metadata: { transcriptSource: 'parakeet' } }],
      ['phone', 'send me resume file', { phoneContext: { deviceId: 'phone_1', deviceName: 'Pixel' } }],
      ['cloud', { payload: { command: 'open downloads' }, metadata: { cloudRequestId: 'cloud_1' } }, {}],
      ['plugin', 'run plugin action', { metadata: { pluginId: 'plugin.test' } }],
      ['api', 'future api command', { requestId: 'api_1' }],
      ['ocr', { extractedText: 'read this text', metadata: { ocrConfidence: 0.66 } }, {}],
      ['clipboard', { clipboardText: 'paste this command', metadata: { clipboardType: 'text' } }, {}]
    ];

    const results = samples.map(([source, input, options]) => manager.acquire(input, source, options));

    assert.equal(results.length, 8);
    results.forEach((rawInput, index) => {
      assert.ok(rawInput.id);
      assert.ok(rawInput.requestId);
      assert.equal(rawInput.source, samples[index][0]);
      assert.equal(typeof rawInput.rawText, 'string');
      assert.equal(rawInput.text, rawInput.rawText);
      assert.ok(rawInput.language);
      assert.equal(typeof rawInput.confidence, 'number');
      assert.ok(Array.isArray(rawInput.attachments));
      assert.ok(rawInput.metadata.processingTimestamp);
      assert.ok(Array.isArray(rawInput.diagnostics));
    });
  });

  it('allows the pipeline to receive RawUserInput without changing the pass-through output', async function() {
    const {
      PipelineManager,
      PipelineStage,
      StageResult
    } = require('../../core/assistant/pipeline');
    const { createDefaultInputSourceManager } = require('../../core/assistant/acquisition');

    let observedRawInput = null;
    class ObserveStage extends PipelineStage {
      constructor() {
        super({ id: 'observe.raw.input', order: -10 });
      }

      execute(context) {
        observedRawInput = context.rawUserInput;
        return StageResult.ok(this.id, {
          input: context.rawInput,
          source: context.source,
          options: context.options
        });
      }
    }

    const manager = new PipelineManager({ defaultStages: false });
    manager.builder.registerStage(new ObserveStage());
    const rawUserInput = createDefaultInputSourceManager().acquire('send me photo', 'phone', {
      phoneContext: { deviceId: 'phone_1' }
    });
    const result = await manager.process({ input: rawUserInput.rawText, source: 'phone', options: {}, rawUserInput });

    assert.equal(result.success, true);
    assert.equal(result.output.input, 'send me photo');
    assert.equal(result.output.source, 'phone');
    assert.equal(observedRawInput.source, 'phone');
    assert.equal(observedRawInput.device.deviceId, 'phone_1');
  });

  it('routes desktop voice transcripts through the assistant engine', async function() {
    const { createDefaultInputSourceManager } = require('../../core/assistant/acquisition');
    const AssistantEngine = require('../../core/assistant/AssistantEngine');

    let observed = null;
    const engine = new AssistantEngine({
      inputSourceManager: createDefaultInputSourceManager(),
      pipeline: {
        async process(payload) {
          observed = payload;
          return {
            success: true,
            output: {
              success: true,
              source: payload.rawUserInput.source,
              response: 'done'
            }
          };
        }
      }
    });

    const result = await engine.processCommand('what time is it', 'voice', {
      metadata: { transcriptSource: 'parakeet' }
    });

    assert.equal(result.success, true);
    assert.equal(result.source, 'voice');
    assert.equal(observed.rawUserInput.source, 'voice');
    assert.equal(observed.rawUserInput.sourceType, 'desktop-voice');
    assert.equal(observed.rawUserInput.metadata.transcriptSource, 'parakeet');
  });
});
