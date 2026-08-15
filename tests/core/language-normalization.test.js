const assert = require('assert');

describe('Assistant Language Normalization Layer', function() {
  it('normalizes language into a deterministic NormalizedInput object', async function() {
    const { createDefaultInputSourceManager } = require('../../core/assistant/acquisition');
    const { createDefaultNormalizationManager, NormalizedInput } = require('../../core/assistant/normalization');

    const rawUserInput = createDefaultInputSourceManager().acquire('  opne   chromee!!!  ', 'chat', {
      metadata: { chatConfidence: 0.9 }
    });
    const normalized = await createDefaultNormalizationManager().normalize(rawUserInput);

    assert.ok(normalized instanceof NormalizedInput);
    assert.equal(normalized.originalText, '  opne   chromee!!!  ');
    assert.equal(normalized.normalizedText, 'open chrome!');
    assert.equal(normalized.commandIntentText, 'open chrome');
    assert.equal(normalized.metadata.commandIntentText, 'open chrome');
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

  it('builds command-ready intent text across normalizer modules', async function() {
    const { createDefaultInputSourceManager } = require('../../core/assistant/acquisition');
    const { createDefaultNormalizationManager } = require('../../core/assistant/normalization');

    const rawUserInput = createDefaultInputSourceManager().acquire('bro pls opne blue tooth settings at 8 p m for twenty-one mins', 'chat');
    const normalized = await createDefaultNormalizationManager().normalize(rawUserInput);
    const observations = normalized.metadata.observations;

    assert.equal(normalized.commandIntentText, 'open bluetooth settings at 8 pm for twenty one minutes');
    assert.ok(observations.times.some(entry => entry.canonical === '20:00'));
    assert.ok(observations.numbers.some(entry => entry.value === 21));
    assert.ok(observations.units.some(entry => entry.canonical === 'min'));
    assert.ok(normalized.normalizationHistory.some(entry => entry.normalizerId === 'command.preprocessor'));
  });

  it('keeps correction cues and command hints for follow-up edits', async function() {
    const { createDefaultInputSourceManager } = require('../../core/assistant/acquisition');
    const { createDefaultNormalizationManager } = require('../../core/assistant/normalization');

    const rawUserInput = createDefaultInputSourceManager().acquire('no no set it to 40', 'chat');
    const normalized = await createDefaultNormalizationManager().normalize(rawUserInput);

    assert.equal(normalized.commandIntentText, 'no no set volume to 40');
    assert.equal(normalized.metadata.commandHints.hasCorrectionCue, true);
    assert.ok(normalized.commandTokens.includes('volume'));
  });

  it('preserves media title interiors while still producing command metadata', async function() {
    const { createDefaultInputSourceManager } = require('../../core/assistant/acquisition');
    const { createDefaultNormalizationManager } = require('../../core/assistant/normalization');

    const rawUserInput = createDefaultInputSourceManager().acquire('play Stars and Stripes Forever song', 'chat');
    const normalized = await createDefaultNormalizationManager().normalize(rawUserInput);

    assert.equal(normalized.commandIntentText, 'play stars and stripes forever song');
    assert.equal(normalized.metadata.commandHints.likelyMediaTitle, true);
    assert.deepEqual(normalized.commandTokens.slice(0, 2), ['play', 'stars']);
  });

  it('recognizes compact times, units, and recurring weekday lists without rewriting text', async function() {
    const { createDefaultInputSourceManager } = require('../../core/assistant/acquisition');
    const { createDefaultNormalizationManager } = require('../../core/assistant/normalization');

    const rawUserInput = createDefaultInputSourceManager().acquire('remind me every saturday and monday at 8pm for 15min', 'chat');
    const normalized = await createDefaultNormalizationManager().normalize(rawUserInput);
    const observations = normalized.metadata.observations;

    assert.equal(normalized.normalizedText, 'remind me every saturday and monday at 8pm for 15min');
    assert.ok(observations.dates.some(entry => entry.type === 'weekday-list' && entry.weekdays.includes('saturday') && entry.weekdays.includes('monday')));
    assert.ok(observations.times.some(entry => entry.canonical === '20:00'));
    assert.ok(observations.units.some(entry => entry.original === '15min' && entry.canonical === 'min'));
  });

  it('bounds diagnostics and observations for long noisy commands', async function() {
    const { createDefaultInputSourceManager } = require('../../core/assistant/acquisition');
    const { createDefaultNormalizationManager } = require('../../core/assistant/normalization');

    const manager = createDefaultNormalizationManager({
      configuration: {
        maxInputLength: 24,
        maxObservationEntriesPerType: 10,
        maxHistoryEntries: 20
      }
    });
    const rawUserInput = createDefaultInputSourceManager().acquire("open chrome and search for today's news with extra trailing words", 'chat');
    const normalized = await manager.normalize(rawUserInput);

    assert.equal(normalized.normalizedText.length, 24);
    assert.ok(normalized.warnings.some(warning => /truncated/i.test(warning.message)));
    assert.ok(normalized.normalizationHistory.length <= 20);
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

  it('routes through command-ready text while preserving pipeline context', async function() {
    const Assistant = require('../../core/assistant');
    const routed = [];
    const assistant = new Assistant({}, {
      automation: {},
      eventBus: { publish() {} },
      router: {
        process: async (input, source, options) => {
          routed.push({ input, source, options });
          return { success: true, intent: 'app.open', entities: { appName: 'visual studio code' }, response: input };
        }
      }
    });

    const result = await assistant.processCommand('bro pls opne vs code', 'chat');

    assert.equal(result.success, true);
    assert.equal(routed[0].input, 'open visual studio code');
    assert.equal(routed[0].options.pipelineContext.normalizedInputObject.commandIntentText, 'open visual studio code');
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
