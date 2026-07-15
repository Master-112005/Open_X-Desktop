'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  VisualMemoryEngine,
  VisualMemoryLearningEngine,
  LearningContract,
  VISUAL_MEMORY_LEARNING_OUT_OF_SCOPE
} = require('../../core/assistant/capabilities/visual-memory');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openx-vm-learning-'));
}

describe('Visual Memory Learning Engine', () => {
  it('publishes local-first learning contracts and forbids model retraining', () => {
    assert.strictEqual(LearningContract.extendsExistingLearningEngine, true);
    assert.strictEqual(LearningContract.localOnly, true);
    assert.strictEqual(LearningContract.retrainsModels, false);
    assert.strictEqual(VISUAL_MEMORY_LEARNING_OUT_OF_SCOPE.includes('model-retraining'), true);
    assert.strictEqual(VISUAL_MEMORY_LEARNING_OUT_OF_SCOPE.includes('automatic-face-naming'), true);
  });

  it('records feedback, corrections, preferences, and produces reversible learning state', async () => {
    const engine = new VisualMemoryLearningEngine();
    await engine.initialize();

    const learned = await engine.learn({
      feedback: { type: 'selected-result', memoryId: 'memory:goa', photoId: 'goaBeach', value: 4 },
      correction: { type: 'location', memoryId: 'memory:wrong', photoId: 'wrongPhoto', from: 'Goa', to: 'Mumbai' },
      preference: { key: 'collection', type: 'collection', value: 'Travel' },
      searchPattern: { query: 'goa trip photos', constraints: ['location', 'event'] }
    });
    const dashboard = engine.getDashboard();

    assert.strictEqual(learned.learned, true);
    assert.strictEqual(dashboard.feedback.length, 1);
    assert.strictEqual(dashboard.corrections.length, 1);
    assert.strictEqual(dashboard.preferences[0].value, 'Travel');
    assert.strictEqual(dashboard.searchPatterns.length, 1);
    assert.strictEqual(dashboard.privacy.hiddenLearning, false);
  });

  it('adapts ranking from user feedback without modifying AI model outputs', async () => {
    const engine = new VisualMemoryLearningEngine();
    await engine.initialize();
    await engine.learn({ feedback: { type: 'selected-result', memoryId: 'memory:goa', photoId: 'goaBeach' } });
    await engine.learn({ feedback: { type: 'closed-immediately', memoryId: 'memory:bad', photoId: 'badPhoto' } });

    const ranked = engine.adaptRanking([
      { id: 'memory:bad', photoId: 'badPhoto', confidence: 0.8, score: 80 },
      { id: 'memory:goa', photoId: 'goaBeach', confidence: 0.75, score: 75 }
    ]);

    assert.strictEqual(ranked[0].id, 'memory:goa');
    assert(ranked[0].learnedAdjustment > 0);
    assert.strictEqual(engine.healthCheck().modelRetraining, false);
  });

  it('generates explainable recommendations and supports undo/reset/export', async () => {
    const engine = new VisualMemoryLearningEngine();
    await engine.initialize();
    const result = await engine.learn({
      preference: { key: 'collection', type: 'collection', value: 'Travel' },
      correction: { type: 'event', memoryId: 'memory:event', from: 'Birthday', to: 'College reunion' }
    });
    const recommendations = engine.getRecommendations();
    const correction = result.records.find(record => record.type === 'event');
    const undone = engine.undo(correction.id);
    const exported = engine.exportData();
    const reset = engine.reset();

    assert(recommendations.length >= 1);
    assert.strictEqual(recommendations[0].explainable, true);
    assert.strictEqual(undone.undone, true);
    assert.strictEqual(exported.configuration.privacy.localOnly, true);
    assert.strictEqual(reset.reset, true);
    assert.strictEqual(engine.getDashboard().corrections.length, 0);
  });

  it('integrates with VisualMemoryAPI and persists learning locally across restarts', async () => {
    const dataDir = tempDir();
    const first = new VisualMemoryEngine({ dataDir, logging: { console: false, file: false } });
    await first.api.start();
    await first.api.recordVisualMemoryFeedback({ type: 'selected-result', memoryId: 'memory:goa', photoId: 'goaBeach' });
    await first.api.recordVisualMemoryCorrection({ type: 'document', photoId: 'receipt1', from: 'document', to: 'receipt' });
    await first.api.setVisualMemoryPreference({ key: 'timeline-view', type: 'timeline', value: 'month' });
    await first.api.shutdown();

    const second = new VisualMemoryEngine({ dataDir, logging: { console: false, file: false } });
    await second.api.start();
    const dashboard = await second.api.getVisualMemoryLearningDashboard();
    const health = await second.api.getVisualMemoryLearningHealth();

    assert.strictEqual(dashboard.feedback.length, 1);
    assert.strictEqual(dashboard.corrections.length, 1);
    assert.strictEqual(dashboard.preferences[0].value, 'month');
    assert.strictEqual(health.localOnly, true);
    await second.api.shutdown();
  });

  it('can forward standard learning events into the existing Assistant learning engine', async () => {
    const calls = [];
    const assistantLearning = {
      async learn(response, options) {
        calls.push({ response, options });
        return { completed: true, itemsLearned: options.metadata.visualMemoryLearningEvents };
      }
    };
    const engine = new VisualMemoryLearningEngine({ assistantLearning });
    await engine.initialize();
    const result = await engine.learn({
      rawInput: 'I picked result four for Goa',
      feedback: { type: 'selected-result', memoryId: 'memory:goa' }
    });

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].options.metadata.source, 'visual-memory-learning');
    assert.strictEqual(result.committed.completed, true);
  });
});
