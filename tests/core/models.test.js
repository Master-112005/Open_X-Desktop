const assert = require('assert');

describe('Assistant Model Layer', function() {
  it('exports a versioned model layer and immutable request/input models', function() {
    const {
      MODELS_LAYER_VERSION,
      AssistantRequest,
      RawUserInput,
      ProcessedInput
    } = require('../../core/assistant/models');

    assert.match(MODELS_LAYER_VERSION, /^\d+\.\d+\.\d+$/);

    const raw = new RawUserInput({
      source: 'phone',
      rawText: 'open chrome',
      metadata: { apiKey: 'hidden', visible: 'ok' },
      attachments: Array.from({ length: 30 }, (_, index) => ({
        name: `file-${index}.txt`,
        contents: 'x'.repeat(1000)
      }))
    });
    const request = new AssistantRequest({
      input: raw.rawText,
      source: raw.source,
      metadata: { commandIntentText: 'open chrome', token: 'secret' }
    });
    const processed = new ProcessedInput({
      raw: '  open chrome  ',
      normalized: 'open chrome',
      metadata: { commandIntentText: 'open chrome' }
    });

    assert.equal(Object.isFrozen(raw), true);
    assert.equal(raw.isFromPhone(), true);
    assert.equal(raw.metadata.apiKey, '[redacted]');
    assert.equal(raw.attachments.length, 20);
    assert.equal(request.isEmpty(), false);
    assert.equal(request.commandText, 'open chrome');
    assert.equal(request.metadata.token, '[redacted]');
    assert.deepEqual(processed.tokens, ['open', 'chrome']);
  });

  it('keeps response, diagnostics, execution, stage, and timing metadata compact', function() {
    const {
      AssistantResponse,
      DiagnosticRecord,
      ExecutionMetadata,
      StageMetadata,
      TimingInformation
    } = require('../../core/assistant/models');

    const response = new AssistantResponse({
      success: true,
      response: 'reply '.repeat(1200),
      result: { password: 'hidden', visible: 'ok' },
      metadata: { secret: 'hidden' }
    });
    const diagnostic = new DiagnosticRecord({
      level: 'fatal',
      message: 'bad',
      data: { password: 'hidden', ok: true }
    });
    const execution = new ExecutionMetadata({
      status: 'completed',
      attempt: 2,
      executor: 'test',
      durationMs: 12
    });
    const stage = new StageMetadata({
      id: 'stage.test',
      tags: ['model'],
      timeoutMs: 100,
      requiredInputs: ['rawInput']
    });
    const timing = new TimingInformation({
      durationMs: 30,
      stages: [
        { stageId: 'a', durationMs: 5, success: true },
        { stageId: 'b', durationMs: 25, success: false }
      ]
    });

    assert.equal(response.success, true);
    assert.ok(response.response.length <= 4000);
    assert.equal(response.result.password, '[redacted]');
    assert.equal(diagnostic.level, 'info');
    assert.equal(diagnostic.data.password, '[redacted]');
    assert.equal(diagnostic.isError, false);
    assert.equal(execution.terminal, true);
    assert.equal(stage.hasTag('model'), true);
    assert.equal(timing.stageDurationMs, 30);
    assert.equal(timing.slowestStage.stageId, 'b');
  });

  it('bounds mutable pipeline metadata while preserving assistant keys', function() {
    const { PipelineMetadata } = require('../../core/assistant/models');
    const metadata = new PipelineMetadata({ 'assistant.commandIntentText': 'open chrome' }, { maxEntries: 10 });

    for (let index = 0; index < 20; index += 1) {
      metadata.set(`key-${index}`, { token: 'secret', value: index });
    }

    assert.equal(metadata.get('assistant.commandIntentText'), 'open chrome');
    assert.equal(Object.keys(metadata.toJSON()).length, 10);
    assert.equal(metadata.get('key-19').token, '[redacted]');
    assert.equal(metadata.has('key-19'), true);
  });
});
