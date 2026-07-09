'use strict';

const EventEmitter = require('events');

class PipelineEventDispatcher extends EventEmitter {
  dispatch(type, payload = {}) {
    const event = Object.freeze({
      type,
      payload: Object.freeze({ ...(payload || {}) }),
      timestamp: Date.now()
    });
    this.emit(type, event);
    this.emit('*', event);
    return event;
  }
}

module.exports = PipelineEventDispatcher;
