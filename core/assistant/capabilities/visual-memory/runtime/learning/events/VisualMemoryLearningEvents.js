'use strict';

const EventEmitter = require('events');

const VISUAL_MEMORY_LEARNING_EVENTS = Object.freeze({
  INITIALIZED: 'visual-memory.learning.initialized',
  LEARNED: 'visual-memory.learning.learned',
  FEEDBACK_RECORDED: 'visual-memory.learning.feedback.recorded',
  CORRECTION_RECORDED: 'visual-memory.learning.correction.recorded',
  PREFERENCE_RECORDED: 'visual-memory.learning.preference.recorded',
  RANKING_UPDATED: 'visual-memory.learning.ranking.updated',
  RECOMMENDATION_CREATED: 'visual-memory.learning.recommendation.created',
  UNDONE: 'visual-memory.learning.undone',
  RESET: 'visual-memory.learning.reset',
  SHUTDOWN: 'visual-memory.learning.shutdown'
});

class VisualMemoryLearningEventBus {
  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
  }

  emit(event, payload = {}) {
    const envelope = Object.freeze({ event, payload: { ...(payload || {}) }, timestamp: Date.now() });
    this.emitter.emit(event, envelope);
    this.emitter.emit('*', envelope);
    return envelope;
  }

  subscribe(event, handler) {
    this.emitter.on(event, handler);
    return () => this.emitter.off(event, handler);
  }
}

module.exports = { VISUAL_MEMORY_LEARNING_EVENTS, VisualMemoryLearningEventBus };
