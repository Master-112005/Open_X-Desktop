'use strict';

class VisualMemoryLearningLifecycle {
  constructor({ events = null, diagnostics = null } = {}) {
    this.events = events;
    this.diagnostics = diagnostics;
    this.state = 'created';
    this.ready = false;
  }

  transition(state, details = {}) {
    this.state = state;
    this.ready = ['ready', 'learning', 'paused'].includes(state);
    const snapshot = this.getState();
    this.diagnostics?.record?.(`lifecycle-${state}`, details);
    this.events?.emit?.(`visual-memory.learning.lifecycle.${state}`, { ...snapshot, details });
    return snapshot;
  }

  getState() {
    return { state: this.state, ready: this.ready };
  }
}

module.exports = VisualMemoryLearningLifecycle;
