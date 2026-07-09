const assert = require('assert');

describe('Assistant Language Normalization Layer', function() {
  it('normalizes language into a deterministic NormalizedInput object', async function() {
    const { createDefaultInputSourceManager } = require('../../core/assistant/acquisition');
    const { createDefaultNormalizationManager, NormalizedInput } = require('../../core/assistant/normalization');

    const rawUserInput = createDefaultInputSourceManager().acquire('  opne   chromee!!!  ', 'voice', {
      metadata: { voiceConfidence: 0.9 }
    });
    const normalized = await createDefaultNormalizationManager().normalize(rawUserInput);

    assert.ok(normalized instanceof NormalizedInput);
    assert.equal(normalized.originalText, '  opne   chromee!!!  ');
    assert.equal(normalized.normalizedText, 'open chrome!');
    assert.equal(normalized.language.code, 'en');
    assert.ok(Array.isArray(normalized.normalizationHistory));
    assert.ok(normalized.normalizationHistory.some(entry => entry.normalizerId === 'spell.repair'));
    assert.ok(normalized.timing.durationMs >= 0);
  });

  it('records dates, times, units, numbers, emojis, and language regions without doing intent work', async function() {
    const { createDefaultInputSourceManager } = require('../../core/assistant/acquisition');
    const { createDefaultNormalizationManager } = require('../../core/assistant/normalization');

    const rawUserInput = createDefaultInputSourceManager().acquire("don't remind me tomorrow at 3 pm for twenty one minutes \u{1F4C1}", 'chat');
    const normalized = await createDefaultNormalizationManager().normalize(rawUserInput);
    const observations = normalized.metadata.observations;

    assert.match(normalized.normalizedText, /do not remind me tomorrow at 3 pm for twenty one minutes/u);
    assert.ok(observations.dates.some(entry => entry.original === 'tomorrow'));
    assert.ok(observations.times.some(entry => entry.canonical === '15:00'));
    assert.ok(observations.units.some(entry => entry.canonical === 'min'));
    assert.ok(observations.numbers.some(entry => entry.value === 21));
    assert.ok(observations.emojis.some(entry => entry.meaning === 'folder'));
    assert.ok(observations.languageSegments.length >= 1);
  });

  it('runs before the existing assistant route and forwards normalized plain text only', async function() {
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

    const result = await assistant.processCommand('opne chromee', 'phone', {
      phoneContext: { deviceId: 'phone_1' }
    });

    assert.equal(result.success, true);
    assert.equal(routed[0].input, 'open chrome');
    assert.equal(routed[0].source, 'phone');
    assert.deepEqual(routed[0].options.phoneContext, { deviceId: 'phone_1' });
  });

  it('can disable individual normalizers through configuration', async function() {
    const { createDefaultInputSourceManager } = require('../../core/assistant/acquisition');
    const { createDefaultNormalizationManager } = require('../../core/assistant/normalization');
    const manager = createDefaultNormalizationManager({
      configuration: {
        normalizers: {
          'spell.repair': { enabled: false }
        }
      }
    });

    const rawUserInput = createDefaultInputSourceManager().acquire('opne chrome', 'chat');
    const normalized = await manager.normalize(rawUserInput);

    assert.equal(normalized.normalizedText, 'opne chrome');
  });
});
