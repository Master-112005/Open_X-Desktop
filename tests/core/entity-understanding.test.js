const assert = require('assert');

async function buildStructuredEntities(text) {
  const { createDefaultInputSourceManager } = require('../../core/assistant/acquisition');
  const { createDefaultNormalizationManager } = require('../../core/assistant/normalization');
  const { createDefaultLinguisticManager } = require('../../core/assistant/linguistic');
  const { createDefaultSemanticManager } = require('../../core/assistant/semantic');
  const { createDefaultEntityManager } = require('../../core/assistant/entities/index.js');
  const raw = createDefaultInputSourceManager().acquire(text, 'chat');
  const normalized = await createDefaultNormalizationManager().normalize(raw);
  const linguisticGraph = await createDefaultLinguisticManager().analyze(normalized);
  const semanticRepresentation = await createDefaultSemanticManager().analyze(linguisticGraph, normalized);
  return createDefaultEntityManager().understand(semanticRepresentation);
}

describe('Assistant Entity Understanding Layer', function() {
  it('extracts immutable structured entities without producing intent', async function() {
    const { StructuredEntities } = require('../../core/assistant/entities/index.js');
    const entities = await buildStructuredEntities('Open Chrome tomorrow at 5 PM.');

    assert.ok(entities instanceof StructuredEntities);
    assert.ok(Object.isFrozen(entities));
    assert.ok(Object.isFrozen(entities.entityGraph));
    assert.ok(entities.applications.some(entity => entity.canonical === 'Google Chrome'));
    assert.ok(entities.dates.some(entity => entity.value.toLowerCase() === 'tomorrow'));
    assert.ok(entities.times.some(entity => entity.value.toLowerCase() === '5 pm'));
    assert.equal(entities.intent, undefined);
    assert.equal(entities.goals, undefined);
    assert.ok(Array.isArray(entities.relationships));
  });

  it('keeps extractor order deterministic and configurable', function() {
    const { createDefaultEntityManager } = require('../../core/assistant/entities/index.js');
    const manager = createDefaultEntityManager({
      configuration: {
        extractors: {
          'entity.personExtractor': { enabled: false }
        }
      }
    });
    const status = manager.getStatus();
    const ids = status.extractors.map(extractor => extractor.id);

    assert.equal(ids[0], 'entity.applicationExtractor');
    assert.equal(ids[ids.length - 1], 'entity.brightnessExtractor');
    assert.equal(status.extractors.find(extractor => extractor.id === 'entity.personExtractor').enabled, false);
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
