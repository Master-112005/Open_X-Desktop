'use strict';

const RECENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

class RecentManager {
  constructor({ getState, saveState, configuration, events } = {}) {
    this.getState = getState;
    this.saveState = saveState;
    this.configuration = configuration;
    this.events = events;
  }

  async add(type, item) {
    const state = this.getState();
    const list = this._filterRecent(state.recent[type] || []);
    const id = item.id || item.photoId || item.memoryId || item.query || String(Date.now());
    const next = [{ ...item, id, viewedAt: new Date().toISOString() }, ...list.filter(entry => entry.id !== id)]
      .slice(0, this.configuration.performance.maxRecentItems);
    state.recent[type] = next;
    await this.saveState(state);
    this.events?.emit?.('visual-memory.gallery.recent.changed', { type, id });
    return next[0];
  }

  list(type = 'images') {
    return this._filterRecent(this.getState().recent[type] || []);
  }

  _filterRecent(list = []) {
    const cutoff = Date.now() - RECENT_WINDOW_MS;
    return list.filter(entry => {
      const viewedAt = Date.parse(entry.viewedAt || entry.updatedAt || entry.createdAt || 0);
      return Number.isFinite(viewedAt) && viewedAt >= cutoff;
    });
  }
}

RecentManager.RECENT_WINDOW_MS = RECENT_WINDOW_MS;

module.exports = RecentManager;
