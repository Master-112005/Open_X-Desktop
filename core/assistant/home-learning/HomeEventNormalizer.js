'use strict';

function cleanKey(value, fallback = 'unknown') {
  const key = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return key || fallback;
}

class HomeEventNormalizer {
  normalize(event = {}) {
    const timestamp = event.timestamp ? new Date(event.timestamp) : new Date();
    if (Number.isNaN(timestamp.getTime())) return null;
    const deviceId = cleanKey(event.deviceId || event.deviceName || event.name, '');
    const action = cleanKey(event.action || event.command || event.state, '');
    if (!deviceId || !action) return null;
    return {
      eventId: String(event.eventId || event.id || '').trim() || null,
      deviceId,
      deviceName: String(event.deviceName || event.name || deviceId).trim(),
      deviceType: cleanKey(event.deviceType || event.type || 'device'),
      room: cleanKey(event.room || event.context?.room || 'unknown'),
      action,
      state: event.state === undefined ? null : event.state,
      value: event.value === undefined ? null : event.value,
      timestamp: timestamp.toISOString(),
      source: event.source || 'home_event',
      context: event.context && typeof event.context === 'object' ? { ...event.context } : {},
      confidence: Math.max(0, Math.min(1, Number(event.confidence ?? 0.8)))
    };
  }
}

module.exports = HomeEventNormalizer;
