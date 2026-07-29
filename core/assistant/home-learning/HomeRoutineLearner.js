'use strict';

class HomeRoutineLearner {
  learn(event, context = {}) {
    if (!event || !['turn_on', 'turn_off', 'on', 'off'].includes(event.action)) return [];
    return [{
      category: 'habit',
      key: `home.routine.${event.room}.${event.deviceType}.${event.action}.${context.dayType}.${context.timeRange}`,
      value: `${event.deviceType}.${event.action}`,
      confidence: Math.max(0.72, Number(event.confidence || 0.8)),
      source: event.source || 'home_event',
      metadata: {
        homeRoutine: true,
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

module.exports = HomeRoutineLearner;
