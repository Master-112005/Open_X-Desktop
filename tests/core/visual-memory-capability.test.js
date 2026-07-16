'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  VisualMemoryCapability,
  VisualMemoryCapabilityContract,
  VISUAL_MEMORY_CAPABILITY_OUT_OF_SCOPE
} = require('../../core/assistant/capabilities');
const { PipelineManager } = require('../../core/assistant/pipeline');
const { VisualMemoryEngine, VisualQueryEngine, CandidateFilterEngine } = require('../../core/assistant/capabilities/visual-memory');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openx-vm-capability-'));
}

async function seedVisualMemory(engine) {
  await engine.database.replaceTable('photos', {
    goaBeach: { id: 'goaBeach', fileName: 'beach.jpg', filePath: 'C:/Pictures/Goa Trip/beach.jpg', fileType: 'jpg', createdAt: '2025-12-18T10:00:00.000Z', folderId: 'goa' },
    goaHotel: { id: 'goaHotel', fileName: 'hotel.jpg', filePath: 'C:/Pictures/Goa Trip/hotel.jpg', fileType: 'jpg', createdAt: '2025-12-19T10:00:00.000Z', folderId: 'goa' }
  });
  await engine.database.replaceTable('metadata', {
    goaBeach: { id: 'goaBeach', photoId: 'goaBeach', createdAt: '2025-12-18T10:00:00.000Z', city: 'Goa', width: 2000, height: 1200 },
    goaHotel: { id: 'goaHotel', photoId: 'goaHotel', createdAt: '2025-12-19T10:00:00.000Z', city: 'Goa', width: 1600, height: 1000 }
  });
  await engine.database.replaceTable('folders', {
    goa: { id: 'goa', label: 'Goa Trip', path: 'C:/Pictures/Goa Trip' }
  });
}

function visualPipelineContext(engine, input = 'show photos from my Goa trip') {
  const visualQuery = new VisualQueryEngine().understand({
    rawInput: input,
    normalizedInput: input.toLowerCase(),
    resolvedContext: { confidence: 0.8 }
  });
  const candidatePool = new CandidateFilterEngine().buildCandidatePool({
    visualQuery,
    databaseSnapshot: engine.database.snapshot()
  });
  return { visualQuery, candidatePool };
}

describe('Assistant Visual Memory Capability', () => {
  it('publishes first-class assistant capability contracts without duplicating assistant systems', () => {
    assert.strictEqual(VisualMemoryCapabilityContract.firstClassCapability, true);
    assert.strictEqual(VisualMemoryCapabilityContract.owner, 'assistant');
    assert.strictEqual(VisualMemoryCapabilityContract.usesPublicApisOnly, true);
    assert.strictEqual(VISUAL_MEMORY_CAPABILITY_OUT_OF_SCOPE.includes('new-nlp'), true);
    assert.strictEqual(VISUAL_MEMORY_CAPABILITY_OUT_OF_SCOPE.includes('new-context-engine'), true);
  });

  it('routes a visual memory search through public APIs and stores assistant session context', async () => {
    const engine = new VisualMemoryEngine({ dataDir: tempDir(), logging: { console: false, file: false } });
    await engine.api.start();
    await seedVisualMemory(engine);
    const { visualQuery, candidatePool } = visualPipelineContext(engine);
    const search = await engine.api.searchMemories({ visualQuery, candidatePool });
    const context = {
      conversationId: 'chat-1',
      rawInput: 'show photos from my Goa trip',
      normalizedInput: 'show photos from my goa trip',
      visualQuery,
      visualMemorySearch: search,
      values: new Map(),
      get(key, fallback) { return this.values.has(key) ? this.values.get(key) : fallback; },
      set(key, value) { this.values.set(key, value); return this; },
      getCommandInput() { return this.normalizedInput; }
    };
    const capability = new VisualMemoryCapability({ visualMemoryApi: engine.api });
    await capability.initialize();

    const output = await capability.handlePipelineContext(context);

    assert.strictEqual(output.request.action, 'search');
    assert.strictEqual(output.response.capability, 'visual-memory');
    assert.strictEqual(output.response.resultCount, 2);
    assert.strictEqual(output.session.currentImage, search.results[0].photoId);
    assert.deepStrictEqual(output.session.currentSelection, search.results.map(result => result.photoId));
    assert.strictEqual(context.get('assistant.visualMemory.context').currentImage, search.results[0].photoId);
    assert.strictEqual(output.response.requiresVerification, false);

    await engine.api.shutdown();
  });

  it('keeps multi-turn visual memory continuity for ordinal open and favorite actions', async () => {
    const engine = new VisualMemoryEngine({ dataDir: tempDir(), logging: { console: false, file: false } });
    await engine.api.start();
    await seedVisualMemory(engine);
    const { visualQuery, candidatePool } = visualPipelineContext(engine);
    const search = await engine.api.searchMemories({ visualQuery, candidatePool });
    const capability = new VisualMemoryCapability({ visualMemoryApi: engine.api });
    await capability.initialize();
    const makeContext = input => ({
      conversationId: 'chat-2',
      rawInput: input,
      normalizedInput: input,
      visualQuery: input.includes('goa') ? visualQuery : null,
      visualMemorySearch: input.includes('goa') ? search : null,
      values: new Map(),
      get(key, fallback) { return this.values.has(key) ? this.values.get(key) : fallback; },
      set(key, value) { this.values.set(key, value); return this; },
      getCommandInput() { return this.normalizedInput; }
    });

    await capability.handlePipelineContext(makeContext('show photos from my goa trip'));
    const opened = await capability.handlePipelineContext(makeContext('open the second one'));
    const favorite = await capability.handlePipelineContext(makeContext('favorite it'));

    assert.strictEqual(opened.request.action, 'open');
    assert.strictEqual(opened.session.currentImage, search.results[1].photoId);
    assert.strictEqual(favorite.request.action, 'favorite');
    assert.strictEqual(favorite.result.success, true);

    await engine.api.shutdown();
  });

  it('requires verification for high-risk delete requests instead of executing directly', async () => {
    const capability = new VisualMemoryCapability({ visualMemoryApi: { openOpenXGallerySearchResults() {} } });
    await capability.initialize();
    capability.sessions.update('chat-3', { currentImage: 'goaBeach', currentSelection: ['goaBeach'] });
    const context = {
      conversationId: 'chat-3',
      rawInput: 'delete this photo',
      normalizedInput: 'delete this photo',
      values: new Map(),
      get(key, fallback) { return this.values.has(key) ? this.values.get(key) : fallback; },
      set(key, value) { this.values.set(key, value); return this; },
      getCommandInput() { return this.normalizedInput; }
    };

    const output = await capability.handlePipelineContext(context);

    assert.strictEqual(output.request.action, 'delete');
    assert.strictEqual(output.result.requiresVerification, true);
    assert.strictEqual(output.response.requiresVerification, true);
  });

  it('registers in the assistant pipeline after Visual Memory Intelligence and before reasoning', async () => {
    let openedSearch = false;
    const fakeApi = {
      async buildCandidatePool() {
        return { candidates: [{ photoId: 'goaBeach', path: 'C:/Pictures/Goa Trip/beach.jpg', metadata: {}, photo: {} }], rejected: [] };
      },
      async searchMemories() {
        return {
          success: true,
          total: 1,
          reasoning: { strategies: ['memory-search'] },
          results: [{ id: 'memory:goaBeach', photoId: 'goaBeach', confidence: 0.9 }]
        };
      },
      async openOpenXGallerySearchResults(result) {
        openedSearch = true;
        return { view: 'search-results', total: result.total, results: result.results };
      }
    };
    const manager = new PipelineManager({
      visualMemoryApi: fakeApi,
      commandExecutor: null,
      logger: { debug() {}, info() {}, warn() {}, error() {} }
    });
    const ids = manager.builder.registry.list({ includeDisabled: true }).map(stage => stage.id);

    assert(ids.indexOf('assistant.capability.visualMemory') > ids.indexOf('assistant.visualMemory.intelligence'));
    assert(ids.indexOf('assistant.capability.visualMemory') < ids.indexOf('assistant.goalIntent.reasoning'));

    const output = await manager.process({ input: 'show me photos from my Goa trip', source: 'chat' });
    const capabilityStage = output.stageResults.find(item => item.stageId === 'assistant.capability.visualMemory');

    assert.strictEqual(openedSearch, true);
    assert(capabilityStage);
    assert.strictEqual(capabilityStage.output.action, 'search');
    assert.strictEqual(output.context.shared['assistant.visualMemoryCapability.active'], true);

    await manager.destroy();
  });
});
