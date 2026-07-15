'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  FaceMemoryEngine,
  FaceMemoryContract,
  FACE_MEMORY_OUT_OF_SCOPE,
  VisualMemoryEngine
} = require('../../core/assistant/capabilities/visual-memory');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openx-face-memory-'));
}

async function enabledEngine(options = {}) {
  const engine = new FaceMemoryEngine({
    configuration: {
      enrollment: { minUnknownPhotos: 2 },
      ...(options.configuration || {})
    }
  });
  await engine.initialize();
  engine.enableFaceMemory({ acceptedBy: 'test-user' });
  return engine;
}

function addTwoUnknownFaces(engine) {
  const first = engine.ingestUnknownFace({ vector: [1, 0], photoId: 'p1', faceId: 'f1', confidence: 0.94 });
  const second = engine.ingestUnknownFace({ vector: [0.99, 0.01], photoId: 'p2', faceId: 'f2', confidence: 0.92 });
  return { first, second };
}

describe('Face Memory System', () => {
  it('is disabled by default and refuses face ingestion without explicit consent', async () => {
    const engine = new FaceMemoryEngine();
    await engine.initialize();

    const result = engine.ingestUnknownFace({ vector: [1, 0], photoId: 'p1' });

    assert.strictEqual(engine.getStatus().enabled, false);
    assert.strictEqual(result.skipped, true);
    assert.strictEqual(result.reason, 'face-memory-disabled');
    assert.strictEqual(FaceMemoryContract.disabledByDefault, true);
    assert.strictEqual(FACE_MEMORY_OUT_OF_SCOPE.includes('automatic-naming'), true);
    assert.strictEqual(FACE_MEMORY_OUT_OF_SCOPE.includes('face-embedding-generation'), true);
  });

  it('groups unknown faces only after consent and creates suggestions from repeated evidence', async () => {
    const engine = await enabledEngine();
    addTwoUnknownFaces(engine);

    const suggestions = engine.getEnrollmentSuggestions();

    assert.strictEqual(suggestions.length, 1);
    assert.strictEqual(suggestions[0].photoCount, 2);
    assert(suggestions[0].options.includes('Name Person'));
  });

  it('enrolls a user-confirmed identity and matches future embeddings', async () => {
    const engine = await enabledEngine();
    addTwoUnknownFaces(engine);
    const [suggestion] = engine.getEnrollmentSuggestions();

    const enrolled = engine.enrollCluster({
      clusterId: suggestion.clusterId,
      name: 'Rahul',
      relationship: 'friend',
      notes: 'Confirmed from gallery review'
    });
    const match = engine.matchFace([0.98, 0.02]);
    const search = engine.searchFaces({ relationship: 'friend' });
    const timeline = engine.getTimeline(enrolled.identity.id);

    assert.strictEqual(enrolled.identity.name, 'Rahul');
    assert.strictEqual(match.best.name, 'Rahul');
    assert(match.best.confidence >= 0.9);
    assert.strictEqual(search.profiles[0].name, 'Rahul');
    assert.strictEqual(timeline.identityId, enrolled.identity.id);
    assert.strictEqual(timeline.photoCount, 2);
  });

  it('supports explicit identity merge, split, delete, and privacy reset', async () => {
    const engine = await enabledEngine();
    addTwoUnknownFaces(engine);
    const firstIdentity = engine.enrollCluster({
      clusterId: engine.getEnrollmentSuggestions()[0].clusterId,
      name: 'Rahul'
    }).identity;

    engine.ingestUnknownFace({ vector: [0, 1], photoId: 'p3', faceId: 'f3', confidence: 0.9 });
    engine.ingestUnknownFace({ vector: [0.01, 0.99], photoId: 'p4', faceId: 'f4', confidence: 0.88 });
    const secondIdentity = engine.enrollCluster({
      clusterId: engine.getEnrollmentSuggestions().find(item => item.clusterId !== firstIdentity.clusterIds[0]).clusterId,
      name: 'Sita'
    }).identity;

    const merged = engine.mergeIdentities(secondIdentity.id, firstIdentity.id);
    const movedEmbedding = merged.embeddingIds[0];
    const split = engine.splitIdentity(firstIdentity.id, [movedEmbedding], 'Rahul duplicate');
    const deleted = engine.deleteIdentity(split.identity.id);

    assert.strictEqual(engine.listIdentities().length, 1);
    assert.strictEqual(deleted, true);
    const reset = engine.reset();
    assert.strictEqual(reset.deleted, true);
    assert.strictEqual(engine.getStatus().consent.enabled, false);
    assert.strictEqual(engine.listIdentities().length, 0);
  });

  it('exposes Face Memory through Visual Memory API and persists local state across restarts', async () => {
    const dataDir = tempDir();
    const first = new VisualMemoryEngine({ dataDir, logging: { console: false, file: false }, faces: { enrollment: { minUnknownPhotos: 2 } } });
    await first.api.start();

    assert.strictEqual((await first.api.getFaceMemoryStatus()).enabled, false);
    await first.api.enableFaceMemory({ acceptedBy: 'test-user' });
    await first.api.ingestUnknownFace({ vector: [1, 0], photoId: 'p1', faceId: 'f1', confidence: 0.95 });
    await first.api.ingestUnknownFace({ vector: [0.99, 0.01], photoId: 'p2', faceId: 'f2', confidence: 0.93 });
    const [suggestion] = await first.api.getFaceEnrollmentSuggestions();
    const enrolled = await first.api.enrollFaceCluster({ clusterId: suggestion.clusterId, name: 'Rahul', relationship: 'friend' });
    await first.api.shutdown();

    const second = new VisualMemoryEngine({ dataDir, logging: { console: false, file: false } });
    await second.api.start();
    const status = await second.api.getFaceMemoryStatus();
    const match = await second.api.matchFace([0.98, 0.02]);
    const exportData = await second.api.exportFaceMemoryData();

    assert.strictEqual(status.enabled, true);
    assert.strictEqual(match.best.identityId, enrolled.identity.id);
    assert.strictEqual(Object.keys(exportData.identities).length, 1);

    await second.api.resetFaceMemory();
    assert.strictEqual((await second.api.getFaceMemoryStatus()).consent.enabled, false);
    await second.api.shutdown();
  });
});
