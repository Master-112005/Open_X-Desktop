'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { VisualMemoryEngine, contracts } = require('../../core/assistant/capabilities/visual-memory');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openx-visual-memory-'));
}

function writeMinimalPng(filePath, width = 1, height = 1) {
  const buffer = Buffer.alloc(33);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 4, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  buffer[24] = 8;
  buffer[25] = 2;
  buffer[26] = 0;
  buffer[27] = 0;
  buffer[28] = 0;
  fs.writeFileSync(filePath, buffer);
}

describe('VisualMemoryEngine', () => {
  it('initializes as an independent local-only engine with public contracts', async () => {
    const dataDir = makeTempDir();
    const engine = new VisualMemoryEngine({ dataDir, logging: { console: false, file: false } });

    await engine.api.initialize();
    await engine.api.start();

    const status = engine.api.getStatus();
    assert.strictEqual(status.initialized, true);
    assert.strictEqual(status.localOnly, true);
    assert.strictEqual(status.lifecycle.state, 'started');
    assert(contracts.VisualMemoryContract.forbiddenCapabilities.includes('face-recognition'));
    assert(contracts.APIContract.gallery.includes('refreshGallery'));

    await engine.api.shutdown();
  });

  it('keeps start idempotent after the engine is already running', async () => {
    const dataDir = makeTempDir();
    const engine = new VisualMemoryEngine({ dataDir, logging: { console: false, file: false } });

    await engine.api.start();
    await engine.api.start();
    await engine.api.start();

    const diagnostics = engine.database.getTable('diagnostics');
    assert.strictEqual(diagnostics.filter(entry => entry.event === 'started').length, 1);
    assert.strictEqual(engine.api.getStatus().lifecycle.state, 'started');

    await engine.api.shutdown();
  });

  it('indexes folders, extracts basic metadata, and exposes gallery results', async () => {
    const dataDir = makeTempDir();
    const photoDir = path.join(dataDir, 'photos');
    fs.mkdirSync(photoDir, { recursive: true });
    const imagePath = path.join(photoDir, 'sample.png');
    writeMinimalPng(imagePath, 2, 3);

    const engine = new VisualMemoryEngine({ dataDir: path.join(dataDir, 'state'), logging: { console: false, file: false } });
    await engine.api.start();
    const folder = await engine.api.addFolder(photoDir, { label: 'Samples' });
    const summary = await engine.api.refreshGallery({ folderId: folder.id });
    const gallery = engine.api.getPhotos({ pageSize: 10 });
    const photo = gallery.items[0];
    const metadata = engine.api.getMetadata(photo.id);

    assert.strictEqual(summary.indexed, 1);
    assert.strictEqual(gallery.total, 1);
    assert.strictEqual(photo.fileName, 'sample.png');
    assert.strictEqual(metadata.width, 2);
    assert.strictEqual(metadata.height, 3);
    assert.strictEqual(metadata.folderId, folder.id);

    await engine.api.shutdown();
  });

  it('recursively indexes Pictures subfolders such as Screenshots', async () => {
    const dataDir = makeTempDir();
    const picturesDir = path.join(dataDir, 'Pictures');
    const screenshotsDir = path.join(picturesDir, 'Screenshots');
    const customAlbumDir = path.join(picturesDir, 'Family');
    fs.mkdirSync(screenshotsDir, { recursive: true });
    fs.mkdirSync(customAlbumDir, { recursive: true });
    writeMinimalPng(path.join(screenshotsDir, 'screen.png'), 4, 4);
    writeMinimalPng(path.join(customAlbumDir, 'family.png'), 5, 6);

    const engine = new VisualMemoryEngine({ dataDir: path.join(dataDir, 'state'), logging: { console: false, file: false } });
    await engine.api.start();
    const folder = await engine.api.addFolder(picturesDir, { label: 'Pictures' });
    const summary = await engine.api.refreshGallery({ folderId: folder.id });
    const gallery = engine.api.getPhotos({ pageSize: 10 });
    const names = gallery.items.map(photo => photo.fileName).sort();

    assert.strictEqual(summary.recursive, true);
    assert.strictEqual(summary.indexed, 2);
    assert.deepStrictEqual(names, ['family.png', 'screen.png']);

    await engine.api.shutdown();
  });

  it('generates thumbnail cache records without image processing dependencies', async () => {
    const dataDir = makeTempDir();
    const photoDir = path.join(dataDir, 'photos');
    fs.mkdirSync(photoDir, { recursive: true });
    const imagePath = path.join(photoDir, 'thumb.png');
    writeMinimalPng(imagePath);

    const engine = new VisualMemoryEngine({ dataDir: path.join(dataDir, 'state'), logging: { console: false, file: false } });
    await engine.api.start();
    const folder = await engine.api.addFolder(photoDir);
    await engine.api.refreshGallery({ folderId: folder.id });
    const photo = engine.api.getPhotos().items[0];
    const thumbnail = await engine.api.generateThumbnail(photo.id, 320);

    assert.strictEqual(thumbnail.photoId, photo.id);
    assert.strictEqual(thumbnail.generator, 'metadata-placeholder');
    assert(fs.existsSync(thumbnail.thumbnailPath));

    await engine.api.shutdown();
  });

  it('persists indexed state and supports privacy clearing controls', async () => {
    const tempDir = makeTempDir();
    const dataDir = path.join(tempDir, 'state');
    const photoDir = path.join(tempDir, 'photos');
    fs.mkdirSync(photoDir, { recursive: true });
    const imagePath = path.join(photoDir, 'persisted.png');
    writeMinimalPng(imagePath);

    const first = new VisualMemoryEngine({ dataDir, logging: { console: false, file: false } });
    await first.api.start();
    const folder = await first.api.addFolder(photoDir);
    await first.api.refreshGallery({ folderId: folder.id });
    const photo = first.api.getPhotos().items[0];
    await first.api.generateThumbnail(photo.id);
    await first.api.shutdown();

    const second = new VisualMemoryEngine({ dataDir, logging: { console: false, file: false } });
    await second.api.start();
    assert.strictEqual(second.api.getPhotos().total, 1);
    assert.strictEqual(second.api.getThumbnail(photo.id, 320).photoId, photo.id);

    await second.api.clearThumbnails();
    await second.api.deleteMetadata();
    assert.strictEqual(Object.keys(second.database.getTable('thumbnails')).length, 0);
    assert.strictEqual(Object.keys(second.database.getTable('metadata')).length, 0);

    await second.api.shutdown();
  });
});
