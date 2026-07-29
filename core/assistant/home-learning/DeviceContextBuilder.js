'use strict';

class DeviceContextBuilder {
  build(event = {}, device = null) {
    const timestamp = new Date(event.timestamp || Date.now());
    const hour = timestamp.getHours();
    const day = timestamp.getDay();
    return {
      room: event.room || device?.room || 'unknown',
      deviceType: event.deviceType || device?.type || 'device',
      hour,
      timeRange: this._timeRange(hour),
      dayType: day === 0 || day === 6 ? 'weekend' : 'weekday',
      source: event.source || 'home_event'
    };
  }

  _timeRange(hour) {
    if (hour < 5) return 'late_night';
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
  }
}

module.exports = DeviceContextBuilder;
