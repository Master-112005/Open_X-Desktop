const assert = require('assert');

async function buildSemanticRepresentation(text) {
  const { createDefaultInputSourceManager } = require('../../core/assistant/acquisition');
  const { createDefaultNormalizationManager } = require('../../core/assistant/normalization');
  const { createDefaultLinguisticManager } = require('../../core/assistant/linguistic');
  const { createDefaultSemanticManager } = require('../../core/assistant/semantic');
  const raw = createDefaultInputSourceManager().acquire(text, 'chat');
  const normalized = await createDefaultNormalizationManager().normalize(raw);
  const linguisticGraph = await createDefaultLinguisticManager().analyze(normalized);
  return createDefaultSemanticManager().analyze(linguisticGraph, normalized);
}

describe('Assistant Semantic Understanding Layer', function() {
  it('builds an immutable SemanticRepresentation from a LinguisticGraph', async function() {
    const { SemanticRepresentation } = require('../../core/assistant/semantic');
    const representation = await buildSemanticRepresentation('Could you launch Chrome?');

    assert.ok(representation instanceof SemanticRepresentation);
    assert.ok(Object.isFrozen(representation));
    assert.ok(Object.isFrozen(representation.semanticGraph));
    assert.ok(representation.concepts.some(concept => concept.concept === 'OPEN'));
    assert.ok(representation.concepts.some(concept => concept.concept === 'APPLICATION'));
    assert.ok(representation.relationships.some(relationship => relationship.type === 'concept-target'));
    assert.equal(representation.conversationType.type, 'question');
    assert.equal(typeof representation.confidenceScores.overall, 'number');
    assert.equal(representation.intent, undefined);
  });

  it('keeps semantic output deterministic and explainable', async function() {
    const first = await buildSemanticRepresentation('send an email');
    const second = await buildSemanticRepresentation('send an email');

    assert.deepEqual(first.concepts, second.concepts);
    assert.deepEqual(first.relationships, second.relationships);
    assert.equal(first.confidenceScores.explanations.overall.includes('no execution decision'), true);
  });

  it('keeps semantic analyzer ordering configurable', function() {
    const { createDefaultSemanticManager } = require('../../core/assistant/semantic');
    const manager = createDefaultSemanticManager({
      configuration: {
        analyzers: {
          'semantic.similarityEngine': { enabled: false }
        }
      }
    });
    const status = manager.getStatus();
    const ids = status.analyzers.map(analyzer => analyzer.id);

    assert.equal(ids[0], 'semantic.meaningResolver');
    assert.equal(ids[ids.length - 1], 'semantic.graphBuilder');
    assert.equal(status.analyzers.find(analyzer => analyzer.id === 'semantic.similarityEngine').enabled, false);
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
