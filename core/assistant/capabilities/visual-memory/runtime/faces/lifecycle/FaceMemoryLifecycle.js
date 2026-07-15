'use strict';

const { FACE_MEMORY_STATES } = require('../contracts/FaceMemoryContracts');

class FaceMemoryLifecycle {
  constructor({ events = null, diagnostics = null } = {}) {
    this.events = events;
    this.diagnostics = diagnostics;
    this.state = FACE_MEMORY_STATES.CREATED;
  }

  transition(state, payload = {}) {
    this.state = state;
    this.diagnostics?.record?.('lifecycle-transition', { state, ...payload });
    this.events?.emit?.(`visual-memory.faces.${state}`, payload);
    return this.getState();
  }

  getState() {
    return { state: this.state, ready: this.state === FACE_MEMORY_STATES.READY };
  }
}

module.exports = FaceMemoryLifecycle;
