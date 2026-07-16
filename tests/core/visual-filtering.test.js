'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { VisualMemoryEngine, VisualQueryEngine, CandidateFilterEngine, OUT_OF_SCOPE } = require('../../core/assistant/capabilities/visual-memory');
const { PipelineManager } = require('../../core/assistant/pipeline');

function isoDaysAgo(days) {
  return new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();
}

function sampleSnapshot() {
  return {
    photos: {
      recentScreenshot: {
        id: 'recentScreenshot',
        fileName: 'Screenshot_001.png',
        filePath: 'C:/Users/rakes/Pictures/Screenshots/Screenshot_001.png',
        fileType: 'png',
        createdAt: isoDaysAgo(1),
        modifiedAt: isoDaysAgo(1),
        folderId: 'screenshots'
      },
      oldScreenshot: {
        id: 'oldScreenshot',
        fileName: 'Screenshot_old.png',
        filePath: 'C:/Users/rakes/Pictures/Screenshots/Screenshot_old.png',
        fileType: 'png',
        createdAt: isoDaysAgo(20),
        modifiedAt: isoDaysAgo(20),
        folderId: 'screenshots'
      },
      cameraPhoto: {
        id: 'cameraPhoto',
        fileName: 'IMG_1001.jpg',
        filePath: 'C:/Users/rakes/Pictures/Camera/IMG_1001.jpg',
        fileType: 'jpg',
        createdAt: isoDaysAgo(1),
        modifiedAt: isoDaysAgo(1),
        folderId: 'camera'
      },
      duplicateScreenshot: {
        id: 'duplicateScreenshot',
        fileName: 'Screenshot_copy.png',
        filePath: 'C:/Users/rakes/Pictures/Screenshots/Screenshot_001.png',
        fileType: 'png',
        createdAt: isoDaysAgo(1),
        modifiedAt: isoDaysAgo(1),
        folderId: 'screenshots'
      }
    },
    metadata: {
      recentScreenshot: {
        id: 'recentScreenshot',
        photoId: 'recentScreenshot',
        filePath: 'C:/Users/rakes/Pictures/Screenshots/Screenshot_001.png',
        fileType: 'png',
        createdAt: isoDaysAgo(1),
        modifiedAt: isoDaysAgo(1),
        fileHash: 'same-hash',
        width: 1080,
        height: 2400,
        sourceApp: 'WhatsApp'
      },
      oldScreenshot: {
        id: 'oldScreenshot',
        photoId: 'oldScreenshot',
        filePath: 'C:/Users/rakes/Pictures/Screenshots/Screenshot_old.png',
        fileType: 'png',
        createdAt: isoDaysAgo(20),
        modifiedAt: isoDaysAgo(20),
        fileHash: 'old-hash',
        width: 1080,
        height: 2400,
        sourceApp: 'WhatsApp'
      },
      cameraPhoto: {
        id: 'cameraPhoto',
        photoId: 'cameraPhoto',
        filePath: 'C:/Users/rakes/Pictures/Camera/IMG_1001.jpg',
        fileType: 'jpg',
        createdAt: isoDaysAgo(1),
        modifiedAt: isoDaysAgo(1),
        fileHash: 'camera-hash',
        width: 3000,
        height: 2000
      },
      duplicateScreenshot: {
        id: 'duplicateScreenshot',
        photoId: 'duplicateScreenshot',
        filePath: 'C:/Users/rakes/Pictures/Screenshots/Screenshot_001.png',
        fileType: 'png',
        createdAt: isoDaysAgo(1),
        modifiedAt: isoDaysAgo(1),
        fileHash: 'same-hash',
        width: 1080,
        height: 2400,
        sourceApp: 'WhatsApp'
      }
    },
    folders: {
      screenshots: { id: 'screenshots', label: 'Screenshots', path: 'C:/Users/rakes/Pictures/Screenshots' },
      camera: { id: 'camera', label: 'Camera', path: 'C:/Users/rakes/Pictures/Camera' }
    },
    albums: {}
  };
}

describe('Visual Candidate Filtering', () => {
  it('reduces a visual query to deterministic metadata candidates without AI', () => {
    const visualQuery = new VisualQueryEngine().understand({
      rawInput: 'show my WhatsApp screenshot from yesterday',
      normalizedInput: 'show my whatsapp screenshot from yesterday',
      resolvedContext: { confidence: 0.8 }
    });
    const pool = new CandidateFilterEngine().buildCandidatePool({
      visualQuery,
      databaseSnapshot: sampleSnapshot()
    });

    assert.strictEqual(pool.candidates.length, 1);
    assert.strictEqual(pool.candidates[0].photoId, 'recentScreenshot');
    assert(pool.rejected.length >= 2);
    assert(pool.diagnostics.some(item => item.filterId === 'date'));
    assert(pool.diagnostics.some(item => item.filterId === 'screenshot'));
    assert.strictEqual(OUT_OF_SCOPE.includes('ai-inference'), true);
  });

  it('does not treat generic photo wording as a folder or album constraint', () => {
    const visualQuery = new VisualQueryEngine().understand({
      rawInput: 'find photos with me and dad',
      normalizedInput: 'find photos with me and dad',
      resolvedContext: { confidence: 0.8 }
    });
    const pool = new CandidateFilterEngine().buildCandidatePool({
      visualQuery,
      databaseSnapshot: sampleSnapshot()
    });
    const ids = pool.candidates.map(candidate => candidate.photoId);

    assert(ids.includes('cameraPhoto'));
    assert(ids.includes('recentScreenshot'));
    assert(pool.candidates.length >= 3);
    assert(!pool.diagnostics.some(item => item.filterId === 'folder' && item.rejected > 0));
    assert(!pool.diagnostics.some(item => item.filterId === 'album' && item.rejected > 0));
  });

  it('supports API-level candidate pool building from the Visual Memory database', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-filtering-'));
    const engine = new VisualMemoryEngine({ dataDir, logging: { console: false, file: false } });
    await engine.api.start();
    const snapshot = sampleSnapshot();
    await engine.database.replaceTable('photos', snapshot.photos);
    await engine.database.replaceTable('metadata', snapshot.metadata);
    await engine.database.replaceTable('folders', snapshot.folders);

    const visualQuery = new VisualQueryEngine().understand({
      rawInput: 'show my WhatsApp screenshot from yesterday',
      normalizedInput: 'show my whatsapp screenshot from yesterday',
      resolvedContext: { confidence: 0.8 }
    });
    const pool = await engine.api.buildCandidatePool(visualQuery);

    assert.strictEqual(pool.candidates.length, 1);
    assert.strictEqual(pool.candidates[0].photoId, 'recentScreenshot');
    assert.strictEqual(engine.api.getCandidateStatistics(pool).total, 1);

    await engine.api.shutdown();
  });

  it('exposes individual filter APIs for focused candidate reduction', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-filtering-api-'));
    const engine = new VisualMemoryEngine({ dataDir, logging: { console: false, file: false } });
    await engine.api.start();
    const snapshot = sampleSnapshot();
    await engine.database.replaceTable('photos', snapshot.photos);
    await engine.database.replaceTable('metadata', snapshot.metadata);

    const visualQuery = new VisualQueryEngine().understand({
      rawInput: 'show my screenshots from yesterday',
      normalizedInput: 'show my screenshots from yesterday',
      resolvedContext: { confidence: 0.8 }
    });
    const datePool = await engine.api.filterByDate(visualQuery);
    const screenshotPool = await engine.api.filterScreenshots(visualQuery);

    assert(datePool.candidates.every(candidate => Date.parse(candidate.metadata.createdAt) >= Date.now() - (2 * 24 * 60 * 60 * 1000)));
    assert(screenshotPool.candidates.every(candidate => /screenshot/i.test(candidate.path)));

    await engine.api.shutdown();
  });

  it('adds an assistant pipeline stage that consumes visualQuery through Visual Memory API only', async () => {
    let called = false;
    const fakeApi = {
      async buildCandidatePool(visualQuery) {
        called = true;
        return {
          candidates: [{ photoId: 'candidate-1' }],
          rejected: [],
          validation: { valid: true },
          stats() { return { total: 1, rejected: 0, filters: [] }; }
        };
      }
    };
    const manager = new PipelineManager({
      commandExecutor: null,
      visualMemoryApi: fakeApi,
      logger: { debug() {}, info() {}, warn() {}, error() {} }
    });

    const ids = manager.builder.registry.list({ includeDisabled: true }).map(stage => stage.id);
    assert(ids.indexOf('assistant.visualCandidate.filtering') > ids.indexOf('assistant.visualQuery.understanding'));
    assert(ids.indexOf('assistant.goalIntent.reasoning') > ids.indexOf('assistant.visualCandidate.filtering'));

    const result = await manager.process({ input: 'show my screenshots from yesterday', source: 'chat' });
    const filteringStage = result.stageResults.find(stage => stage.stageId === 'assistant.visualCandidate.filtering');

    assert.strictEqual(called, true);
    assert(filteringStage);
    assert.strictEqual(filteringStage.skipped, false);
    assert.strictEqual(filteringStage.output.total, 1);

    await manager.destroy();
  });
});
