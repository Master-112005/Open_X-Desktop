const assert = require('assert');

describe('Assistant Input Acquisition Layer', function() {
  it('creates a standard RawUserInput for every supported input source', function() {
    const { createDefaultInputSourceManager } = require('../../core/assistant/acquisition');
    const manager = createDefaultInputSourceManager();
    const samples = [
      ['chat', 'open chrome', {}],
      ['voice', { transcript: 'open chrome', confidence: 0.82, metadata: { speechDurationMs: 900 } }, {}],
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

  it('keeps acquisition separate from NLP by forwarding unchanged text to the current assistant route', async function() {
    const Assistant = require('../../core/assistant');
    const { createDefaultInputSourceManager } = require('../../core/assistant/acquisition');
    const routed = [];
    let acquired = null;
    const inputSourceManager = createDefaultInputSourceManager();
    const originalAcquire = inputSourceManager.acquire.bind(inputSourceManager);
    inputSourceManager.acquire = (...args) => {
      acquired = originalAcquire(...args);
      return acquired;
    };
    const assistant = new Assistant({}, {
      automation: {},
      eventBus: { publish() {} },
      inputSourceManager,
      router: {
        process: async (input, source, options) => {
          routed.push({ input, source, options });
          return { success: true, intent: 'browser.search', entities: { query: input }, response: input };
        }
      }
    });

    const result = await assistant.processCommand('Search for OpenX', 'voice', {
      metadata: { voiceConfidence: 0.91, speechDurationMs: 1200 }
    });

    assert.equal(result.success, true);
    assert.equal(acquired.rawText, 'Search for OpenX');
    assert.equal(routed[0].input, 'search for openx');
    assert.equal(routed[0].source, 'voice');
    assert.equal(acquired.source, 'voice');
    assert.equal(acquired.metadata.voiceConfidence, 0.91);
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
});
