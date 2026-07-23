'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  VisualMemoryEngine,
  VisualQueryEngine,
  CandidateFilterEngine,
  VisualMemoryIntelligenceEngine,
  OUT_OF_SCOPE,
  MemorySearchContract,
  SearchSessionContract
} = require('../../core/assistant/capabilities/visual-memory');
const { PipelineManager } = require('../../core/assistant/pipeline');

function ago(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function candidatePool() {
  const snapshot = {
    photos: {
      goaBeach: { id: 'goaBeach', fileName: 'IMG_1.jpg', filePath: 'C:/Pictures/Goa Trip/beach.jpg', fileType: 'jpg', createdAt: ago(20), folderId: 'goa' },
      receipt: { id: 'receipt', fileName: 'receipt.png', filePath: 'C:/Pictures/Receipts/food_receipt.png', fileType: 'png', createdAt: ago(2), folderId: 'receipts' }
    },
    metadata: {
      goaBeach: { id: 'goaBeach', photoId: 'goaBeach', filePath: 'C:/Pictures/Goa Trip/beach.jpg', fileType: 'jpg', createdAt: ago(20), width: 2000, height: 1200 },
      receipt: { id: 'receipt', photoId: 'receipt', filePath: 'C:/Pictures/Receipts/food_receipt.png', fileType: 'png', createdAt: ago(2), width: 1080, height: 1400, photoType: 'receipt' }
    },
    folders: {
      goa: { id: 'goa', label: 'Goa Trip', path: 'C:/Pictures/Goa Trip' },
      receipts: { id: 'receipts', label: 'Receipts', path: 'C:/Pictures/Receipts' }
    },
    albums: {}
  };
  const visualQuery = new VisualQueryEngine().understand({
    rawInput: 'show me photos from my Goa trip at the beach',
    normalizedInput: 'show me photos from my goa trip at the beach',
    resolvedContext: { confidence: 0.8 }
  });
  return {
    visualQuery,
    pool: new CandidateFilterEngine().buildCandidatePool({ visualQuery, databaseSnapshot: snapshot })
  };
}

describe('Visual Memory Intelligence', () => {
  it('turns visual query candidates and vision evidence into ranked memories', async () => {
    const { visualQuery, pool } = candidatePool();
    const engine = new VisualMemoryIntelligenceEngine();
    const result = await engine.search({
      visualQuery,
      candidatePool: pool,
      visionResults: {
        goaBeach: {
          scenes: [{ label: 'beach', confidence: 0.93 }],
          objects: [{ label: 'friend', confidence: 0.8 }],
          embeddings: [{ vector: [1, 0, 0], confidence: 0.9 }]
        }
      }
    });

    assert.strictEqual(result.success, true);
    assert(result.reasoning.strategies.includes('memory-search'));
    assert(result.reasoning.collections.some(collection => collection.id === 'trips'));
    assert.strictEqual(result.results[0].photoId, 'goaBeach');
    assert(result.results[0].confidence > 0.2);
    assert.strictEqual(OUT_OF_SCOPE.includes('new-nlp'), true);
  });

  it('uses the Visual Memory API to build candidates and search memories', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-memory-intelligence-'));
    const engine = new VisualMemoryEngine({ dataDir, logging: { console: false, file: false } });
    await engine.api.start();
    await engine.database.replaceTable('photos', {
      goaBeach: { id: 'goaBeach', fileName: 'beach.jpg', filePath: 'C:/Pictures/Goa Trip/beach.jpg', fileType: 'jpg', createdAt: ago(20), folderId: 'goa' }
    });
    await engine.database.replaceTable('metadata', {
      goaBeach: { id: 'goaBeach', photoId: 'goaBeach', filePath: 'C:/Pictures/Goa Trip/beach.jpg', fileType: 'jpg', createdAt: ago(20), width: 2000, height: 1200 }
    });
    await engine.database.replaceTable('folders', {
      goa: { id: 'goa', label: 'Goa Trip', path: 'C:/Pictures/Goa Trip' }
    });
    const visualQuery = new VisualQueryEngine().understand({
      rawInput: 'show me photos from my Goa trip',
      normalizedInput: 'show me photos from my goa trip',
      resolvedContext: { confidence: 0.8 }
    });
    const result = await engine.api.searchMemories({ visualQuery });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.results[0].photoId, 'goaBeach');
    assert(engine.api.getMemoryIntelligenceHealth().initialized);

    await engine.api.shutdown();
  });

  it('ranks natural scene searches with semantic folder and path hints', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-memory-nature-search-'));
    const engine = new VisualMemoryEngine({ dataDir, logging: { console: false, file: false } });
    await engine.api.start();
    await engine.database.replaceTable('photos', {
      hillView: { id: 'hillView', fileName: 'IMG_1001.jpg', filePath: 'C:/Pictures/Trip/hill_station_view.jpg', fileType: 'jpg', createdAt: ago(4), folderId: 'trip' },
      familyDinner: { id: 'familyDinner', fileName: 'dinner.jpg', filePath: 'C:/Pictures/Family/dinner.jpg', fileType: 'jpg', createdAt: ago(1), folderId: 'family' }
    });
    await engine.database.replaceTable('metadata', {
      hillView: { id: 'hillView', photoId: 'hillView', filePath: 'C:/Pictures/Trip/hill_station_view.jpg', fileType: 'jpg', createdAt: ago(4), width: 1600, height: 900 },
      familyDinner: { id: 'familyDinner', photoId: 'familyDinner', filePath: 'C:/Pictures/Family/dinner.jpg', fileType: 'jpg', createdAt: ago(1), width: 1600, height: 900 }
    });
    await engine.database.replaceTable('folders', {
      trip: { id: 'trip', label: 'Trip', path: 'C:/Pictures/Trip' },
      family: { id: 'family', label: 'Family', path: 'C:/Pictures/Family' }
    });
    const visualQuery = new VisualQueryEngine().understand({
      rawInput: 'find moanitains image',
      normalizedInput: 'find moanitains image',
      resolvedContext: { confidence: 0.8 }
    });
    const result = await engine.api.searchMemories({ visualQuery });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.results[0].photoId, 'hillView');
    assert(result.results[0].evidence.visualScore > 0.18);

    await engine.api.shutdown();
  });

  it('uses named Face Memory evidence to rank people-focused photo searches', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-memory-people-search-'));
    const engine = new VisualMemoryEngine({ dataDir, logging: { console: false, file: false }, faces: { enrollment: { minUnknownPhotos: 2 } } });
    await engine.api.start();
    await engine.database.replaceTable('photos', {
      both: { id: 'both', fileName: 'family.jpg', filePath: 'C:/Pictures/family.jpg', fileType: 'jpg', createdAt: ago(1) },
      dadOnly: { id: 'dadOnly', fileName: 'dad.jpg', filePath: 'C:/Pictures/dad.jpg', fileType: 'jpg', createdAt: ago(2) },
      meOnly: { id: 'meOnly', fileName: 'me.jpg', filePath: 'C:/Pictures/me.jpg', fileType: 'jpg', createdAt: ago(3) },
      popularTrip: { id: 'popularTrip', fileName: 'best-family-trip.jpg', filePath: 'C:/Pictures/family/best-family-trip.jpg', fileType: 'jpg', createdAt: ago(0) }
    });
    await engine.database.replaceTable('metadata', {
      both: { id: 'both', photoId: 'both', filePath: 'C:/Pictures/family.jpg', fileType: 'jpg', createdAt: ago(1) },
      dadOnly: { id: 'dadOnly', photoId: 'dadOnly', filePath: 'C:/Pictures/dad.jpg', fileType: 'jpg', createdAt: ago(2) },
      meOnly: { id: 'meOnly', photoId: 'meOnly', filePath: 'C:/Pictures/me.jpg', fileType: 'jpg', createdAt: ago(3) },
      popularTrip: { id: 'popularTrip', photoId: 'popularTrip', filePath: 'C:/Pictures/family/best-family-trip.jpg', fileType: 'jpg', createdAt: ago(0), rankingScore: 100, semanticTags: ['family', 'trip'] }
    });
    await engine.api.enableFaceMemory({ acceptedBy: 'test-user' });
    await engine.api.ingestUnknownFace({ vector: [1, 0], photoId: 'both', faceId: 'me-1', confidence: 0.96 });
    await engine.api.ingestUnknownFace({ vector: [0.99, 0.01], photoId: 'meOnly', faceId: 'me-2', confidence: 0.95 });
    const meSuggestion = (await engine.api.getFaceEnrollmentSuggestions())[0];
    await engine.api.enrollFaceCluster({ clusterId: meSuggestion.clusterId, name: 'me' });
    await engine.api.ingestUnknownFace({ vector: [0, 1], photoId: 'both', faceId: 'dad-1', confidence: 0.96 });
    await engine.api.ingestUnknownFace({ vector: [0.01, 0.99], photoId: 'dadOnly', faceId: 'dad-2', confidence: 0.95 });
    const dadSuggestion = (await engine.api.getFaceEnrollmentSuggestions()).find(item => item.clusterId !== meSuggestion.clusterId);
    await engine.api.enrollFaceCluster({ clusterId: dadSuggestion.clusterId, name: 'dad', relationship: 'father' });

    const visualQuery = new VisualQueryEngine().understand({
      rawInput: 'find photos with me and dad',
      normalizedInput: 'find photos with me and dad',
      resolvedContext: { confidence: 0.8 }
    });
    const result = await engine.api.searchMemories({ visualQuery });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.results[0].photoId, 'both');
    assert.strictEqual(result.total, 1);
    assert(result.results[0].candidate.faceMemory.peopleNames.includes('me'));
    assert(result.results[0].candidate.faceMemory.relationships.includes('father'));
    assert.strictEqual(result.results[0].evidence.faceSearchStrict, true);
    assert.strictEqual(result.results[0].evidence.faceSearchCoverage, 1);
    assert(!result.results.some(item => item.photoId === 'popularTrip'));

    await engine.api.shutdown();
  });

  it('uses unnamed Face Memory evidence for broad face and unidentified-person searches', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-memory-unnamed-face-search-'));
    const engine = new VisualMemoryEngine({ dataDir, logging: { console: false, file: false }, faces: { enrollment: { minUnknownPhotos: 2 } } });
    await engine.api.start();
    await engine.database.replaceTable('photos', {
      unnamedFace: { id: 'unnamedFace', fileName: 'party-face.jpg', filePath: 'C:/Pictures/party-face.jpg', fileType: 'jpg', createdAt: ago(1) },
      noFace: { id: 'noFace', fileName: 'landscape.jpg', filePath: 'C:/Pictures/landscape.jpg', fileType: 'jpg', createdAt: ago(1) }
    });
    await engine.database.replaceTable('metadata', {
      unnamedFace: { id: 'unnamedFace', photoId: 'unnamedFace', filePath: 'C:/Pictures/party-face.jpg', fileType: 'jpg', createdAt: ago(1) },
      noFace: { id: 'noFace', photoId: 'noFace', filePath: 'C:/Pictures/landscape.jpg', fileType: 'jpg', createdAt: ago(1) }
    });
    await engine.api.enableFaceMemory({ acceptedBy: 'test-user' });
    await engine.api.ingestUnknownFace({
      vector: [0, 1],
      photoId: 'unnamedFace',
      faceId: 'unnamed-face-1',
      confidence: 0.96,
      quality: 0.88
    });

    const broadFaceQuery = new VisualQueryEngine().understand({
      rawInput: 'find photos with faces',
      normalizedInput: 'find photos with faces',
      resolvedContext: { confidence: 0.8 }
    });
    const unnamedQuery = new VisualQueryEngine().understand({
      rawInput: 'show unnamed people in my photos',
      normalizedInput: 'show unnamed people in my photos',
      resolvedContext: { confidence: 0.8 }
    });
    const broadResult = await engine.api.searchMemories({ visualQuery: broadFaceQuery });
    const unnamedResult = await engine.api.searchMemories({ visualQuery: unnamedQuery });

    assert.strictEqual(broadResult.success, true);
    assert.strictEqual(broadResult.results[0].photoId, 'unnamedFace');
    assert.strictEqual(broadResult.results[0].candidate.faceMemory.faceCount, 1);
    assert.strictEqual(broadResult.results[0].evidence.faceSearchCoverage, 1);
    assert.strictEqual(unnamedResult.success, true);
    assert.strictEqual(unnamedResult.results[0].photoId, 'unnamedFace');
    assert.strictEqual(unnamedResult.results[0].candidate.faceMemory.unknownFaceCount, 1);
    assert.strictEqual(unnamedResult.results[0].evidence.faceSearchCoverage, 1);

    await engine.api.shutdown();
  });

  it('requires saved face evidence for relationship-only parent searches', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-memory-parent-search-'));
    const engine = new VisualMemoryEngine({ dataDir, logging: { console: false, file: false }, faces: { enrollment: { minUnknownPhotos: 2 } } });
    await engine.api.start();
    await engine.database.replaceTable('photos', {
      bothParents: { id: 'bothParents', fileName: 'parents.jpg', filePath: 'C:/Pictures/parents.jpg', fileType: 'jpg', createdAt: ago(1) },
      mummyOnly: { id: 'mummyOnly', fileName: 'mummy.jpg', filePath: 'C:/Pictures/mummy.jpg', fileType: 'jpg', createdAt: ago(2) },
      daddyOnly: { id: 'daddyOnly', fileName: 'daddy.jpg', filePath: 'C:/Pictures/daddy.jpg', fileType: 'jpg', createdAt: ago(3) },
      genericFamily: { id: 'genericFamily', fileName: 'family-trip.jpg', filePath: 'C:/Pictures/Family/family-trip.jpg', fileType: 'jpg', createdAt: ago(0) }
    });
    await engine.database.replaceTable('metadata', {
      bothParents: { id: 'bothParents', photoId: 'bothParents', filePath: 'C:/Pictures/parents.jpg', fileType: 'jpg', createdAt: ago(1) },
      mummyOnly: { id: 'mummyOnly', photoId: 'mummyOnly', filePath: 'C:/Pictures/mummy.jpg', fileType: 'jpg', createdAt: ago(2) },
      daddyOnly: { id: 'daddyOnly', photoId: 'daddyOnly', filePath: 'C:/Pictures/daddy.jpg', fileType: 'jpg', createdAt: ago(3) },
      genericFamily: { id: 'genericFamily', photoId: 'genericFamily', filePath: 'C:/Pictures/Family/family-trip.jpg', fileType: 'jpg', createdAt: ago(0), rankingScore: 100, semanticTags: ['family'] }
    });
    await engine.api.enableFaceMemory({ acceptedBy: 'test-user' });
    await engine.api.ingestUnknownFace({ vector: [1, 0], photoId: 'bothParents', faceId: 'mother-1', confidence: 0.96 });
    await engine.api.ingestUnknownFace({ vector: [0.99, 0.01], photoId: 'mummyOnly', faceId: 'mother-2', confidence: 0.95 });
    const motherSuggestion = (await engine.api.getFaceEnrollmentSuggestions())[0];
    await engine.api.enrollFaceCluster({ clusterId: motherSuggestion.clusterId, name: 'mummy', relationship: 'mother' });
    await engine.api.ingestUnknownFace({ vector: [0, 1], photoId: 'bothParents', faceId: 'father-1', confidence: 0.96 });
    await engine.api.ingestUnknownFace({ vector: [0.01, 0.99], photoId: 'daddyOnly', faceId: 'father-2', confidence: 0.95 });
    const fatherSuggestion = (await engine.api.getFaceEnrollmentSuggestions()).find(item => item.clusterId !== motherSuggestion.clusterId);
    await engine.api.enrollFaceCluster({ clusterId: fatherSuggestion.clusterId, name: 'daddy', relationship: 'father' });

    const visualQuery = new VisualQueryEngine().understand({
      rawInput: 'find photos of mummy and daddy',
      normalizedInput: 'find photos of mummy and daddy',
      resolvedContext: { confidence: 0.8 }
    });
    const result = await engine.api.searchMemories({ visualQuery });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.results[0].photoId, 'bothParents');
    assert.deepStrictEqual(result.results[0].candidate.faceMemorySearch.matchedRelationships.sort(), ['father', 'mother']);
    assert(!result.results.some(item => item.photoId === 'genericFamily'));
    assert(!result.results.some(item => item.photoId === 'mummyOnly'));
    assert(!result.results.some(item => item.photoId === 'daddyOnly'));

    await engine.api.shutdown();
  });

  it('integrates as an optional assistant pipeline stage through Visual Memory API', async () => {
    let called = false;
    const fakeApi = {
      async buildCandidatePool() {
        return { candidates: [{ photoId: 'one', path: 'C:/one.jpg', metadata: {}, photo: {} }], rejected: [] };
      },
      async searchMemories(input) {
        called = true;
        return {
          success: true,
          total: 1,
          reasoning: { strategies: ['memory-search'] },
          results: [{ id: 'memory:one', photoId: 'one', confidence: 0.7 }]
        };
      }
    };
    const manager = new PipelineManager({
      visualMemoryApi: fakeApi,
      commandExecutor: null,
      logger: { debug() {}, info() {}, warn() {}, error() {} }
    });
    const ids = manager.builder.registry.list({ includeDisabled: true }).map(stage => stage.id);
    assert(ids.indexOf('assistant.visualMemory.intelligence') > ids.indexOf('assistant.visualCandidate.filtering'));
    assert(ids.indexOf('assistant.goalIntent.reasoning') > ids.indexOf('assistant.visualMemory.intelligence'));

    const output = await manager.process({ input: 'show me photos from my goa trip', source: 'chat' });
    const stage = output.stageResults.find(item => item.stageId === 'assistant.visualMemory.intelligence');
    assert.strictEqual(called, true);
    assert(stage);
    assert.strictEqual(stage.output.total, 1);

    await manager.destroy();
  });

  it('returns a valid empty result when candidate pool is missing', async () => {
    const visualQuery = new VisualQueryEngine().understand({
      rawInput: 'show me similar photos',
      normalizedInput: 'show me similar photos',
      resolvedContext: { confidence: 0.8 }
    });
    const engine = new VisualMemoryIntelligenceEngine();
    const result = await engine.search({ visualQuery });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.total, 0);
  });

  it('publishes explicit Phase 5 contracts and supports search continuation', async () => {
    const { visualQuery, pool } = candidatePool();
    const engine = new VisualMemoryIntelligenceEngine();
    const result = await engine.search({
      visualQuery,
      candidatePool: pool,
      options: { pageSize: 1, includeAllResults: true }
    });

    assert(MemorySearchContract.output.includes('continuationToken'));
    assert(SearchSessionContract.supports.includes('pagination'));
    assert.strictEqual(result.page, 1);
    assert.strictEqual(result.pageSize, 1);
    if (result.hasMore) {
      const next = engine.continueSearch(result.continuationToken);
      assert(next);
      assert.strictEqual(next.page, 2);
    }
    const cancelled = engine.cancelSearch(result.session.id, 'user-request');
    assert.strictEqual(cancelled.cancelled, true);
  });
});
