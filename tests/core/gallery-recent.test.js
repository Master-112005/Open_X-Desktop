'use strict';

const assert = require('assert');
const RecentManager = require('../../core/assistant/capabilities/visual-memory/runtime/gallery/recent/RecentManager');

describe('Gallery Recent Manager', () => {
  it('keeps only photos viewed in the last 3 days', async () => {
    let state = {
      recent: {
        images: [
          { id: 'fresh', photoId: 'fresh', viewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
          { id: 'old', photoId: 'old', viewedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() }
        ]
      }
    };
    const manager = new RecentManager({
      getState: () => state,
      saveState: next => {
        state = next;
      },
      configuration: { performance: { maxRecentItems: 20 } }
    });

    assert.deepStrictEqual(manager.list('images').map(item => item.id), ['fresh']);

    await manager.add('images', { id: 'new', photoId: 'new' });

    assert.deepStrictEqual(manager.list('images').map(item => item.id), ['new', 'fresh']);
    assert(!manager.list('images').some(item => item.id === 'old'));
  });
});
