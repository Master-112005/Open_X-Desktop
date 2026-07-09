const assert = require('assert');

describe('Assistant Linguistic Understanding Layer', function() {
  it('builds an immutable LinguisticGraph from NormalizedInput', async function() {
    const { createDefaultInputSourceManager } = require('../../core/assistant/acquisition');
    const { createDefaultNormalizationManager } = require('../../core/assistant/normalization');
    const { createDefaultLinguisticManager, LinguisticGraph } = require('../../core/assistant/linguistic');

    const raw = createDefaultInputSourceManager().acquire('John opened Chrome because he needed it.', 'chat');
    const normalized = await createDefaultNormalizationManager().normalize(raw);
    const graph = await createDefaultLinguisticManager().analyze(normalized);

    assert.ok(graph instanceof LinguisticGraph);
    assert.equal(graph.normalizedSentence, 'John opened Chrome because he needed it.');
    assert.ok(Object.isFrozen(graph));
    assert.ok(graph.tokens.length >= 7);
    assert.ok(graph.sentences.length >= 1);
    assert.ok(graph.clauses.length >= 2);
    assert.ok(graph.posTags.some(tag => tag.tag === 'verb'));
    assert.ok(graph.verbs.some(verb => verb.value.toLowerCase() === 'opened'));
    assert.ok(graph.subjects.length >= 1);
    assert.ok(graph.objects.length >= 1);
    assert.ok(graph.dependencies.length >= 1);
  });

  it('resolves pronouns only within the same sentence', async function() {
    const { createDefaultInputSourceManager } = require('../../core/assistant/acquisition');
    const { createDefaultNormalizationManager } = require('../../core/assistant/normalization');
    const { createDefaultLinguisticManager } = require('../../core/assistant/linguistic');

    const raw = createDefaultInputSourceManager().acquire('John opened Chrome because he needed it. Then close it.', 'chat');
    const normalized = await createDefaultNormalizationManager().normalize(raw);
    const graph = await createDefaultLinguisticManager().analyze(normalized);
    const firstSentencePronoun = graph.pronouns.find(item => item.value.toLowerCase() === 'he');
    const secondSentencePronoun = graph.pronouns.filter(item => item.value.toLowerCase() === 'it').pop();

    assert.equal(firstSentencePronoun.antecedent, 'John');
    assert.equal(secondSentencePronoun.antecedent, null);
  });

  it('keeps analyzer ordering deterministic and configurable', async function() {
    const { createDefaultLinguisticManager } = require('../../core/assistant/linguistic');
    const manager = createDefaultLinguisticManager({
      configuration: {
        analyzers: {
          'linguistic.negationDetector': { enabled: false }
        }
      }
    });

    const status = manager.getStatus();
    const ids = status.analyzers.map(analyzer => analyzer.id);

    assert.equal(ids[0], 'linguistic.tokenizer');
    assert.equal(ids[ids.length - 1], 'linguistic.pronounResolver');
    assert.equal(status.analyzers.find(analyzer => analyzer.id === 'linguistic.negationDetector').enabled, false);
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

    const result = await assistant.processCommand('opne chrome', 'voice', {
      metadata: { voiceConfidence: 0.9 }
    });

    assert.equal(result.success, true);
    assert.equal(routed[0].input, 'open chrome');
    assert.equal(routed[0].source, 'voice');
  });
});
