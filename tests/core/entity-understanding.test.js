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

  it('supports custom entity types and processors without engine changes', async function() {
    const { createDefaultEntityManager, BaseEntityExtractor } = require('../../core/assistant/entities/index.js');

    class ProjectExtractor extends BaseEntityExtractor {
      extract(context) {
        context.addEntity('project', 'openx', { source: this.id, confidence: 0.9 });
        return context;
      }
    }

    const manager = createDefaultEntityManager({ defaultExtractors: false });
    manager
      .registerEntityType('project', { collection: 'projects' })
      .registerExtractor(new ProjectExtractor({ id: 'entity.projectExtractor', priority: 1 }))
      .registerNormalizer('entity.projectNormalizer', {
        normalize(entity) {
          if (entity.type === 'project') entity.canonical = 'OpenX';
        }
      });

    const entities = await manager.understand({ originalInput: 'open openx project' });

    assert.equal(entities.futureExtensions.customEntities.project[0].canonical, 'OpenX');
    assert.ok(Object.isFrozen(entities.entityGraph));
    assert.ok(entities.entityGraph.nodes.some(node => node.type === 'project'));
  });

  it('extracts suffix folder references as folders', async function() {
    const entities = await buildStructuredEntities('open java practice folder on desktop');

    assert.ok(entities.folders.some(entity => entity.value.toLowerCase() === 'java practice'));
    assert.ok(entities.folders.some(entity => entity.canonical === 'Desktop Folder'));
  });

  it('extracts flexible reminder date and time entities without intent data', async function() {
    const entities = await buildStructuredEntities('remind me next month 7 at five pm say wishes to mohit');

    assert.ok(entities.dates.some(entity => entity.value.toLowerCase() === 'next month 7'));
    assert.ok(entities.times.some(entity => entity.value.toLowerCase() === 'five pm'));
    assert.ok(entities.reminders.some(entity => entity.value.toLowerCase() === 'wishes to mohit'));
    assert.equal(entities.intent, undefined);
  });

  it('keeps full song titles as one media entity', async function() {
    const entities = await buildStructuredEntities('play Stars and Stripes Forever song');

    assert.ok(entities.media.some(entity => entity.value === 'Stars and Stripes Forever'));
    assert.equal(entities.media.filter(entity => /Stars/i.test(entity.value)).length, 1);
  });

  it('extracts visual person names, visible self, and family relationships from photo requests', async function() {
    const entities = await buildStructuredEntities('find a pic of me and daddy with jithu and vivek');
    const people = entities.people.map(entity => String(entity.canonical || entity.value).toLowerCase());

    assert.ok(people.includes('user'));
    assert.ok(people.includes('jithu'));
    assert.ok(people.includes('vivek'));
    assert.ok(!people.includes('daddy'));
    assert.ok(entities.relationships.some(relationship => relationship.target === 'father'));
  });

  it('extracts recurring reminder task, days, time, and recurrence metadata', async function() {
    const entities = await buildStructuredEntities('remind me every saturday monday to eat lunch at 8pm');

    assert.ok(entities.reminders.some(entity => entity.value.toLowerCase() === 'eat lunch'));
    assert.ok(entities.dates.some(entity => /saturday monday/i.test(entity.value)));
    assert.ok(entities.times.some(entity => entity.value.toLowerCase() === '8pm'));
    assert.ok(entities.reminders.some(entity => /saturday monday/i.test(entity.metadata.recurrence || '')));
  });

  it('deduplicates aliases while retaining the best entity metadata', async function() {
    const entities = await buildStructuredEntities('open chrome and google chrome');

    assert.equal(entities.applications.filter(entity => entity.canonical === 'Google Chrome').length, 1);
    assert.ok(entities.diagnostics.duplicateEntities.length >= 1);
  });

  it('extracts reply contacts through the legacy entity extractor', function() {
    const { EntityExtractor } = require('../../core/assistant/entities/index.js');
    const extractor = new EntityExtractor({});
    const entities = extractor.extract({
      entities: [
        { name: 'contactName' },
        { name: 'messageText' }
      ]
    }, 'reply for Sunil saying I will call later');

    assert.equal(entities.contactName, 'Sunil');
    assert.equal(entities.messageText, 'I will call later');
  });
});
