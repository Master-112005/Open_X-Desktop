'use strict';

class SelectionManager {
  constructor({ getState, saveState, validator, events } = {}) {
    this.getState = getState;
    this.saveState = saveState;
    this.validator = validator;
    this.events = events;
  }

  async setSelection(ids = [], mode = 'multiple') {
    const validation = this.validator.validateSelectionMode(mode);
    if (!validation.valid) throw new Error(validation.reason);
    const state = this.getState();
    state.selection = {
      mode: validation.mode,
      ids: Array.from(new Set(ids.filter(Boolean))),
      updatedAt: new Date().toISOString()
    };
    await this.saveState(state);
    this.events?.emit?.('visual-memory.gallery.selection.changed', state.selection);
    return state.selection;
  }

  async clear() {
    return this.setSelection([], 'multiple');
  }

  getSelection() {
    return { ...this.getState().selection };
  }
}

module.exports = SelectionManager;
