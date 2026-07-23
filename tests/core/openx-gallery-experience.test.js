'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  VisualMemoryEngine,
  GalleryContract,
  GALLERY_OUT_OF_SCOPE
} = require('../../core/assistant/capabilities/visual-memory');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openx-gallery-experience-'));
}

async function seedVisualMemory(engine) {
  await engine.database.replaceTable('photos', {
    goaBeach: { id: 'goaBeach', fileName: 'beach.jpg', filePath: 'C:/Pictures/Goa Trip/beach.jpg', fileType: 'jpg', createdAt: '2025-12-18T10:00:00.000Z', folderId: 'goa' },
    desktopShot: { id: 'desktopShot', fileName: 'screenshot.png', filePath: 'C:/Pictures/Screenshots/screenshot.png', fileType: 'png', createdAt: '2026-01-10T08:00:00.000Z', folderId: 'screenshots' },
    foodReceipt: { id: 'foodReceipt', fileName: 'food_receipt.png', filePath: 'C:/Pictures/Receipts/food_receipt.png', fileType: 'png', createdAt: '2026-01-11T08:00:00.000Z', folderId: 'receipts' }
  });
  await engine.database.replaceTable('metadata', {
    goaBeach: { id: 'goaBeach', photoId: 'goaBeach', createdAt: '2025-12-18T10:00:00.000Z', width: 2000, height: 1200, city: 'Goa', photoType: 'image' },
    desktopShot: { id: 'desktopShot', photoId: 'desktopShot', createdAt: '2026-01-10T08:00:00.000Z', width: 1920, height: 1080, photoType: 'screenshot', sourceApp: 'desktop' },
    foodReceipt: { id: 'foodReceipt', photoId: 'foodReceipt', createdAt: '2026-01-11T08:00:00.000Z', width: 1080, height: 1400, photoType: 'receipt' }
  });
  await engine.database.replaceTable('folders', {
    goa: { id: 'goa', label: 'Goa Trip', path: 'C:/Pictures/Goa Trip' },
    screenshots: { id: 'screenshots', label: 'Screenshots', path: 'C:/Pictures/Screenshots' },
    receipts: { id: 'receipts', label: 'Receipts', path: 'C:/Pictures/Receipts' }
  });
  await engine.database.replaceTable('albums', {
    pinned: { id: 'pinned', title: 'Pinned Memories', photoIds: ['goaBeach'] }
  });
}

describe('OpenX Gallery Experience', () => {
  it('publishes a presentation-only gallery contract', () => {
    assert.strictEqual(GalleryContract.role, 'presentation-layer');
    assert.strictEqual(GalleryContract.localFirst, true);
    assert.strictEqual(GALLERY_OUT_OF_SCOPE.includes('ai-inference'), true);
    assert.strictEqual(GALLERY_OUT_OF_SCOPE.includes('visual-query-parsing'), true);
  });

  it('opens native gallery navigation and timeline views without running intelligence', async () => {
    const engine = new VisualMemoryEngine({ dataDir: tempDir(), logging: { console: false, file: false } });
    await engine.api.start();
    await seedVisualMemory(engine);

    const status = await engine.api.getOpenXGalleryStatus();
    const navigation = await engine.api.getOpenXGalleryNavigation();
    const timeline = await engine.api.openOpenXGallery('timeline', { group: 'month', pageSize: 2 });
    const screenshots = await engine.api.openOpenXGalleryView('screenshots');
    const collections = await engine.api.getOpenXGalleryCollections();
    const places = await engine.api.getOpenXGalleryPlaces();

    assert.strictEqual(status.initialized, true);
    assert(navigation.some(item => item.id === 'timeline'));
    assert(navigation.some(item => item.id === 'people'));
    assert.strictEqual(timeline.view, 'timeline');
    assert.strictEqual(timeline.page.items.length, 2);
    assert.strictEqual(timeline.statistics.totalPhotos, 3);
    assert.strictEqual(screenshots.total, 1);
    assert(collections.collections.some(item => item.id === 'screenshots'));
    assert(places.places.some(place => place.title === 'Goa'));

    await engine.api.shutdown();
  });

  it('displays Face Memory people data without performing recognition', async () => {
    const engine = new VisualMemoryEngine({
      dataDir: tempDir(),
      logging: { console: false, file: false },
      faces: { enrollment: { minUnknownPhotos: 2 } }
    });
    await engine.api.start();
    await seedVisualMemory(engine);
    await engine.api.enableFaceMemory({ acceptedBy: 'test-user' });
    await engine.api.ingestUnknownFace({
      vector: [1, 0],
      photoId: 'goaBeach',
      faceId: 'f1',
      confidence: 0.95,
      faceBox: { x: 410, y: 250, width: 120, height: 150 },
      imageWidth: 2000,
      imageHeight: 1200
    });
    await engine.api.ingestUnknownFace({
      vector: [0.99, 0.01],
      photoId: 'desktopShot',
      faceId: 'f2',
      confidence: 0.93,
      faceBox: { x: 90, y: 110, width: 80, height: 90 },
      imageWidth: 1920,
      imageHeight: 1080
    });
    await engine.api.ingestUnknownFace({
      vector: [0, 1],
      photoId: 'foodReceipt',
      faceId: 'f3',
      confidence: 0.94,
      faceBox: { x: 120, y: 180, width: 70, height: 88 },
      imageWidth: 1080,
      imageHeight: 1400
    });
    const unnamedPeople = await engine.api.getOpenXGalleryPeople();
    assert.strictEqual(unnamedPeople.summary.readyToName, 2);
    assert.strictEqual(unnamedPeople.summary.reviewLater, 0);
    assert.strictEqual(unnamedPeople.unknown[0].nameable, true);
    assert.strictEqual(unnamedPeople.unknown[0].representativePhotoId, 'goaBeach');
    assert.strictEqual(unnamedPeople.unknown[1].nameable, true);
    assert.strictEqual(unnamedPeople.reviewLater.length, 0);
    const [suggestion] = await engine.api.getFaceEnrollmentSuggestions();
    await engine.api.enrollFaceCluster({ clusterId: suggestion.clusterId, name: 'Rahul', relationship: 'friend' });

    const people = await engine.api.getOpenXGalleryPeople();

    assert.strictEqual(people.performsRecognition, false);
    assert.strictEqual(people.known[0].name, 'Rahul');
    assert.strictEqual(people.known[0].representativePhotoId, 'goaBeach');
    assert.strictEqual(people.known[0].representativeFaceBox.width, 120);
    assert.strictEqual(people.known[0].representativeFaceBox.imageWidth, 2000);
    assert.strictEqual(people.relationshipGroups.friend.length, 1);

    await engine.api.shutdown();
  });

  it('scans indexed photos into nameable people only from verified face evidence', async () => {
    const visionEngine = {
      async initialize() {},
      runtime: { getStatus: () => ({ adapters: ['test'] }) },
      async infer(request) {
        if (/screenshot/i.test(request.imagePath || '')) {
          return {
            faces: [{ id: 'face-low', confidence: 0.42, imageWidth: 1000, imageHeight: 800, box: { x: 100, y: 120, width: 80, height: 80 } }],
            embeddings: [{ vector: [0, 1], confidence: 0.91 }],
            warnings: []
          };
        }
        if (/receipt/i.test(request.imagePath || '')) {
          return {
            faces: [{
              id: 'object-false-positive',
              confidence: 0.96,
              imageWidth: 1000,
              imageHeight: 800,
              box: { x: 120, y: 160, width: 22, height: 190 }
            }],
            embeddings: [{
              vector: Array.from({ length: 80 }, (_, index) => index % 2 === 0 ? 0.3 : 0.7),
              confidence: 0.93,
              metadata: {
                vectorType: 'local-face-region-v2',
                qualitySignals: {
                  sharpness: 0.006,
                  contrast: 0.007,
                  textureEnergy: 0.005
                }
              }
            }],
            warnings: []
          };
        }
        if (/family/i.test(request.imagePath || '')) {
          return {
            faces: [
              { id: 'face-2', confidence: 0.95, imageWidth: 1000, imageHeight: 800, box: { x: 240, y: 185, width: 178, height: 178 } },
              { id: 'face-2-duplicate', confidence: 0.91, imageWidth: 1000, imageHeight: 800, box: { x: 248, y: 193, width: 174, height: 174 } }
            ],
            embeddings: [
              { vector: [0.97, 0.24], confidence: 0.94 },
              { vector: [0.969, 0.245], confidence: 0.91 }
            ],
            warnings: []
          };
        }
        return {
          faces: [
            { id: 'face-1', confidence: 0.96, imageWidth: 1000, imageHeight: 800, box: { x: 220, y: 180, width: 180, height: 180 } },
            { id: 'face-duplicate', confidence: 0.92, imageWidth: 1000, imageHeight: 800, box: { x: 232, y: 190, width: 176, height: 176 } }
          ],
          embeddings: [
            { vector: [1, 0], confidence: 0.94 },
            { vector: [0.99, 0.01], confidence: 0.91 }
          ],
          warnings: []
        };
      }
    };
    const engine = new VisualMemoryEngine({
      dataDir: tempDir(),
      logging: { console: false, file: false },
      visionEngine,
      faces: { enrollment: { minUnknownPhotos: 2 } }
    });
    await engine.api.start();
    await seedVisualMemory(engine);
    await engine.database.upsert('photos', 'familyPark', {
      fileName: 'family.jpg',
      filePath: 'C:/Pictures/Family/family.jpg',
      fileType: 'jpg',
      createdAt: '2026-01-12T08:00:00.000Z',
      folderId: 'family'
    });
    await engine.database.upsert('metadata', 'familyPark', {
      photoId: 'familyPark',
      createdAt: '2026-01-12T08:00:00.000Z',
      width: 1600,
      height: 1000,
      photoType: 'image'
    });
    await engine.api.enableFaceMemory({ acceptedBy: 'test-rescan' });
    await engine.api.ingestUnknownFace({ vector: [0, 1], photoId: 'desktopShot', faceId: 'old-bad-cluster', confidence: 0.95 });

    const progressEvents = [];
    const result = await engine.api.scanGalleryPeople({
      maxPhotos: 4,
      onProgress: event => progressEvents.push(event)
    });
    const people = await engine.api.getOpenXGalleryPeople();
    const progressStages = progressEvents.map(event => event.stage);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.reset.removedClusters, 1);
    assert.strictEqual(result.scanned, 4);
    assert.strictEqual(result.grouped, 2);
    assert.strictEqual(result.falsePositiveFaces, 1);
    assert(result.warnings.some(item => item.code === 'object-like-face-suppressed'));
    assert(result.warnings.some(item => item.code === 'duplicate-face-detection-suppressed'));
    assert.strictEqual(result.verification.requireFaceDetection, true);
    assert.strictEqual(result.verification.requireFaceEmbedding, true);
    assert(progressStages.includes('loading-runtime'));
    assert(progressStages.includes('scanning-photos'));
    assert(progressStages.includes('cleaning-faces'));
    assert(progressStages.includes('matching-known-people'));
    assert(progressStages.includes('saving-results'));
    assert(progressStages.includes('complete'));
    assert(progressEvents.some(event => /Scanning photos/.test(event.message)));
    assert(progressEvents.some(event => event.stage === 'complete' && /verified/.test(event.detail)));
    assert(people.unknown.length >= 1);
    assert(people.unknown.every(person => person.nameable === true));
    assert.strictEqual(people.unknown[0].representativeFaceBox.width, 178);
    assert.strictEqual(people.unknown[0].representativeFaceBox.imageWidth, 1000);

    await engine.api.shutdown();
  });

  it('presents search results, similar memories, objects, and events from existing subsystem outputs', async () => {
    const engine = new VisualMemoryEngine({ dataDir: tempDir(), logging: { console: false, file: false } });
    await engine.api.start();
    await seedVisualMemory(engine);
    const memorySearchResult = {
      success: true,
      total: 1,
      hasMore: false,
      session: { id: 'search-1' },
      reasoning: {
        strategies: ['memory-search'],
        collections: [{ id: 'trips', title: 'Trips', confidence: 0.82, matchedCount: 1 }]
      },
      results: [{ id: 'memory:goa', photoId: 'goaBeach', confidence: 0.91, reason: 'Goa trip' }]
    };

    const search = await engine.api.openOpenXGallerySearchResults(memorySearchResult);
    const similar = await engine.api.presentOpenXGallerySimilar(memorySearchResult);
    const objects = await engine.api.getOpenXGalleryObjects({
      goaBeach: { objects: [{ label: 'beach', confidence: 0.9 }] }
    });
    const events = await engine.api.getOpenXGalleryEvents(memorySearchResult);

    assert.strictEqual(search.performsNlp, false);
    assert.strictEqual(search.results[0].photoId, 'goaBeach');
    assert.strictEqual(similar.computesSimilarity, false);
    assert.strictEqual(objects.consumesVisionOutputOnly, true);
    assert.strictEqual(objects.objects[0].title, 'beach');
    assert(events.events.some(event => event.title === 'Trips'));

    await engine.api.shutdown();
  });

  it('supports viewer, accessibility, quick actions, selection, favorites, recent, and persistence', async () => {
    const dataDir = tempDir();
    const first = new VisualMemoryEngine({ dataDir, logging: { console: false, file: false } });
    await first.api.start();
    await seedVisualMemory(first);

    const viewer = await first.api.openOpenXGalleryViewer('goaBeach');
    const selection = await first.api.setOpenXGallerySelection(['goaBeach', 'desktopShot'], 'multiple');
    const favorite = await first.api.toggleOpenXGalleryFavorite('images', 'goaBeach', true);
    const accessibility = await first.api.getOpenXGalleryAccessibility();
    const quickActions = await first.api.getOpenXGalleryQuickActions();
    await first.api.shutdown();

    const second = new VisualMemoryEngine({ dataDir, logging: { console: false, file: false } });
    await second.api.start();
    const favorites = await second.api.getOpenXGalleryFavorites('images');
    const recent = await second.api.getOpenXGalleryRecent('images');
    const persistedSelection = await second.api.getOpenXGallerySelection();

    assert.strictEqual(viewer.view, 'viewer');
    assert.strictEqual(viewer.photo.id, 'goaBeach');
    assert(viewer.panels.includes('related-memories'));
    assert.strictEqual(selection.ids.length, 2);
    assert.strictEqual(favorite.favorite, true);
    assert.strictEqual(accessibility.keyboardNavigation, true);
    assert(quickActions.some(action => action.id === 'open-with-assistant'));
    assert.strictEqual(favorites.items[0].id, 'goaBeach');
    assert.strictEqual(recent.items[0].photoId, 'goaBeach');
    assert.strictEqual(persistedSelection.ids.length, 2);

    await second.api.shutdown();
  });
});
