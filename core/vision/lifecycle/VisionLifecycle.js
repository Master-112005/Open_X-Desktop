'use strict';

const { ENGINE_STATES } = require('../contracts/VisionContracts');

class VisionLifecycle {
  constructor({ events = null, diagnostics = null } = {}) {
    this.events = events;
    this.diagnostics = diagnostics;
    this.state = ENGINE_STATES.CREATED;
  }

  transition(state, payload = {}) {
    this.state = state;
    this.diagnostics?.record?.('lifecycle-transition', { state, ...payload });
    this.events?.emit?.(`vision.${state}`, payload);
    return this.getState();
  }

  getState() {
    return { state: this.state, ready: this.state === ENGINE_STATES.READY || this.state === ENGINE_STATES.RUNNING };
  }
}

module.exports = VisionLifecycle;
