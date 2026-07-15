'use strict';

class FavoriteManager {
  constructor({ getState, saveState, events } = {}) {
    this.getState = getState;
    this.saveState = saveState;
    this.events = events;
  }

  async toggle(type, id, value = null) {
    const state = this.getState();
    state.favorites[type] = state.favorites[type] || {};
    const next = value === null ? !state.favorites[type][id] : Boolean(value);
    if (next) state.favorites[type][id] = { id, type, favoritedAt: new Date().toISOString() };
    else delete state.favorites[type][id];
    await this.saveState(state);
    this.events?.emit?.('visual-memory.gallery.favorite.changed', { type, id, favorite: next });
    return { type, id, favorite: next };
  }

  list(type = 'images') {
    return Object.values(this.getState().favorites[type] || {});
  }
}

module.exports = FavoriteManager;
