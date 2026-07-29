'use strict';

const ROUTINE_ALIASES = Object.freeze({
  wakeup: 'wake_up',
  wake_up: 'wake_up',
  wake: 'wake_up',
  bedtime: 'bedtime',
  sleep: 'bedtime',
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  work_start: 'work_start',
  work_finish: 'work_finish',
  music: 'music_time',
  tv: 'tv_time',
  television: 'tv_time',
  light_on: 'light_on',
  light_off: 'light_off',
  fan_on: 'fan_on',
  fan_off: 'fan_off'
});

function minutesToTime(minutes) {
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function normalizeRoutineType(value) {
  const key = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return ROUTINE_ALIASES[key] || key || 'custom';
}

function dayTypeFor(date, explicit = null) {
  const value = String(explicit || '').trim().toLowerCase();
  if (value) return value;
  const day = date.getDay();
  return day === 0 || day === 6 ? 'weekend' : 'weekday';
}

class RoutineNormalizer {
  normalize(input = {}) {
    const timestamp = input.timestamp ? new Date(input.timestamp) : new Date();
    if (Number.isNaN(timestamp.getTime())) return null;
    const explicitMinutes = Number(input.localTimeMinutes);
    const localTimeMinutes = Number.isFinite(explicitMinutes)
      ? ((Math.round(explicitMinutes) % 1440) + 1440) % 1440
      : timestamp.getHours() * 60 + timestamp.getMinutes();
    const routineType = normalizeRoutineType(input.routineType || input.type || input.kind);
    if (!routineType || routineType === 'routine_observation') return null;
    return {
      routineType,
      timestamp: timestamp.toISOString(),
      localTimeMinutes,
      localTime: minutesToTime(localTimeMinutes),
      dayOfWeek: timestamp.getDay(),
      dayType: dayTypeFor(timestamp, input.dayType),
      context: input.context && typeof input.context === 'object' ? { ...input.context } : {},
      source: input.source || 'external_event',
      confidence: Math.max(0, Math.min(1, Number(input.confidence ?? 0.8)))
    };
  }
}

module.exports = {
  RoutineNormalizer,
  normalizeRoutineType,
  minutesToTime,
  dayTypeFor
};
