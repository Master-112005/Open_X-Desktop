'use strict';

function keyPart(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unknown';
}

class AppliancePatternLearner {
  learn(event, context = {}) {
    if (!event) return [];
    const key = [
      'home',
      keyPart(context.dayType),
      keyPart(context.timeRange),
      keyPart(event.room),
      keyPart(event.deviceType),
      keyPart(event.action)
    ].join('.');
    return [{
      category: 'pattern',
      key,
      value: `${event.deviceType}.${event.action}`,
      confidence: Math.max(0.72, Number(event.confidence || 0.8)),
      source: event.source || 'home_event',
      metadata: {
        homeLearning: true,
        deviceId: event.deviceId,
        room: event.room,
        deviceType: event.deviceType,
        action: event.action,
        dayType: context.dayType,
        timeRange: context.timeRange
      }
    }];
  }
}

module.exports = AppliancePatternLearner;
