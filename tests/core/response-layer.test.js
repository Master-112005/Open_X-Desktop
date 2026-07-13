'use strict';

const assert = require('assert');

const {
  AssistantResponse,
  BaseResponseGenerator,
  ResponseConfiguration,
  ResponseContext,
  ResponseDiagnostics,
  ResponseGenerationError,
  ResponseRegistry,
  RESPONSE_VERSION,
  createDefaultResponseManager,
  ResponseGenerator
} = require('../../core/assistant/response');

function verificationResult(input = {}) {
  return {
    executionStatus: 'COMPLETED',
    successfulActions: [],
    failedActions: [],
    skippedActions: [],
    metadata: {},
    futureExtensions: {},
    ...input
  };
}

describe('Assistant Response Layer', function() {
  it('exports a versioned response layer', function() {
    assert.match(RESPONSE_VERSION, /^\d+\.\d+\.\d+$/);
  });

  it('keeps AssistantResponse immutable, bounded, and metadata-safe', function() {
    const response = new AssistantResponse({
      formattedVoiceResponse: 'voice '.repeat(400),
      formattedChatResponse: 'chat '.repeat(900),
      formattedNotification: 'notice '.repeat(80),
      suggestions: Array.from({ length: 12 }, (_, index) => ({ text: `suggest ${index}`, token: 'secret' })),
      metadata: { password: 'hidden', visible: 'ok' },
      diagnostics: { apiKey: 'hidden' }
    });

    assert.ok(Object.isFrozen(response));
    assert.ok(response.formattedVoiceResponse.length <= 900);
    assert.ok(response.formattedChatResponse.length <= 2400);
    assert.ok(response.formattedNotification.length <= 180);
    assert.equal(response.suggestions.length, 8);
    assert.equal(response.metadata.password, '[redacted]');
    assert.equal(response.diagnostics.apiKey, '[redacted]');
  });

  it('bounds response context parts and suggestions', function() {
    const configuration = new ResponseConfiguration({ maxParts: 2, maxSuggestions: 1 });
    const context = new ResponseContext({ configuration });

    context.addPart('summary', 'one');
    context.addPart('summary', 'two');
    context.addPart('summary', 'three');
    context.addSuggestion('recovery', 'retry one');
    context.addSuggestion('recovery', 'retry two');

    assert.deepEqual(context.parts.map(part => part.text), ['two', 'three']);
    assert.deepEqual(context.suggestions.map(item => item.text), ['retry two']);
  });

  it('formats clarification, error, voice, chat, and notification responses through the manager', async function() {
    const manager = createDefaultResponseManager({
      configuration: { maxNotificationLength: 60 }
    });
    const response = await manager.generate(verificationResult({
      executionStatus: 'FAILED',
      failedActions: [{ action: 'OPEN_FILE', error: 'File not found' }],
      metadata: {
        decision: {
          clarificationRequirements: [{ field: 'filename' }]
        }
      }
    }));

    assert.equal(response.responseType, 'clarification');
    assert.match(response.formattedChatResponse, /filename/i);
    assert.ok(response.formattedNotification.length <= 60);
    assert.ok(response.suggestions.some(item => item.type === 'recovery' || item.type === 'clarification'));
  });

  it('captures generator failures without breaking non-strict response generation', async function() {
    class BrokenGenerator extends BaseResponseGenerator {
      generate() {
        throw new Error('boom');
      }
    }
    const manager = createDefaultResponseManager({ defaultGenerators: false });
    manager.registerGenerator(new BrokenGenerator({ id: 'response.broken' }));
    const response = await manager.generate(verificationResult());

    assert.ok(response.diagnostics.errors.some(error => /response\.broken/.test(error.message)));
  });

  it('supports registry helpers and duplicate protection', function() {
    const registry = new ResponseRegistry();
    const generator = new BaseResponseGenerator({ id: 'response.custom' });

    registry.register(generator);
    assert.equal(registry.get('response.custom'), generator);
    assert.equal(registry.count(), 1);
    assert.throws(() => registry.register(generator), /already registered/);
    assert.equal(registry.unregister('response.custom'), true);
    assert.equal(registry.clear(), 0);
  });

  it('serializes diagnostics and errors with summaries', function() {
    const diagnostics = new ResponseDiagnostics();
    diagnostics.time('response.test', 3.5);
    diagnostics.formatter('response.formatter');
    diagnostics.warn('careful', { token: 'hidden' });
    diagnostics.error(new ResponseGenerationError('failed', { code: 'response_failed' }), { password: 'hidden' });
    const json = diagnostics.toJSON();

    assert.equal(json.summary.generatorCount, 1);
    assert.equal(json.warnings[0].data.token, '[redacted]');
    assert.equal(json.errors[0].data.password, '[redacted]');
  });

  it('keeps legacy ResponseGenerator robust for bad templates and escaped keys', function() {
    const generator = new ResponseGenerator();
    generator.addTemplate('success', 'custom.key', 'Value: {a.b}');

    const escaped = generator.generate('success', 'custom.key', { entities: { 'a.b': 'ok' } });
    const recovered = generator.generate('success', 'broken.template', {});

    assert.match(escaped, /Value: ok/i);
    assert.ok(recovered.length > 0);
  });
});
