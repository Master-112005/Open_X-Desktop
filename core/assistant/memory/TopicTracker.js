'use strict';

const BaseMemoryProvider = require('./BaseMemoryProvider');

const TOPIC_TYPES = new Set(['media', 'website', 'application', 'browser', 'file', 'folder', 'contact', 'person', 'device']);

class TopicTracker extends BaseMemoryProvider {
  apply(context) {
    const topicEntity = context.entities.find(entity => TOPIC_TYPES.has(entity.type));
    const topic = topicEntity
      ? {
          label: topicEntity.canonical || topicEntity.value,
          type: topicEntity.type,
          confidence: topicEntity.confidence,
          timestamp: Date.now()
        }
      : context.state.lastTopic || null;
    context.topic = topic;
    if (topic) context.state.lastTopic = topic;
    return context;
  }
}

module.exports = TopicTracker;
