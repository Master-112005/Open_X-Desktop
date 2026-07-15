'use strict';

class RecentManager {
  constructor({ getState, saveState, configuration, events } = {}) {
    this.getState = getState;
    this.saveState = saveState;
    this.configuration = configuration;
    this.events = events;
  }

  async add(type, item) {
    const state = this.getState();
    const list = state.recent[type] || [];
    const id = item.id || item.photoId || item.memoryId || item.query || String(Date.now());
    const next = [{ ...item, id, viewedAt: new Date().toISOString() }, ...list.filter(entry => entry.id !== id)]
      .slice(0, this.configuration.performance.maxRecentItems);
    state.recent[type] = next;
    await this.saveState(state);
    this.events?.emit?.('visual-memory.gallery.recent.changed', { type, id });
    return next[0];
  }

  list(type = 'images') {
    return (this.getState().recent[type] || []).slice();
  }
}

module.exports = RecentManager;
