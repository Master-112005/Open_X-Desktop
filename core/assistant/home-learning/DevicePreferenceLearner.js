'use strict';

function keyPart(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unknown';
}

class DevicePreferenceLearner {
  learn(event, context = {}) {
    if (!event) return [];
    const events = [];
    if (event.deviceType === 'fan' && /speed/.test(event.action) && event.value !== null) {
      events.push(this._preference('preferredFanSpeed', `${context.room || event.room}:${event.value}`, event, context));
    }
    if (event.deviceType === 'light' && /brightness/.test(event.action) && event.value !== null) {
      events.push(this._preference('preferredLightBrightness', `${context.room || event.room}:${event.value}`, event, context));
    }
    if (event.deviceType === 'light' && /colo(u)?r/.test(event.action) && event.value !== null) {
      events.push(this._preference('preferredLightColor', `${context.room || event.room}:${event.value}`, event, context));
    }
    if ((event.deviceType === 'television' || event.deviceType === 'tv') && /channel|open|play|select/.test(event.action) && event.value) {
      events.push(this._preference('favoriteTvChannel', String(event.value), event, context));
    }
    return events;
  }

  _preference(kind, value, event, context) {
    return {
      category: 'preference',
      key: `${kind}.${keyPart(value)}`,
      value: String(value),
      confidence: Math.max(0.72, Number(event.confidence || 0.8)),
      source: event.source || 'home_event',
      metadata: {
        homeLearning: true,
        kind,
        deviceId: event.deviceId,
        deviceType: event.deviceType,
        room: event.room,
        action: event.action,
        context
      }
    };
  }
}

module.exports = DevicePreferenceLearner;
