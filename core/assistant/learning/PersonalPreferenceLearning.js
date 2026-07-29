'use strict';

const BaseLearningModule = require('./BaseLearningModule');
const { normalizeLearningKey, stripLearningPunctuation } = require('./LearningLanguage');

const PREFERENCE_KIND_ALIASES = Object.freeze({
  contact: 'favoriteContact',
  song: 'favoriteSong',
  artist: 'favoriteArtist',
  album: 'favoriteAlbum',
  playlist: 'favoritePlaylist',
  music_genre: 'favoriteMusicGenre',
  genre: 'favoriteMusicGenre',
  food: 'favoriteFood',
  restaurant: 'favoriteRestaurant',
  tv_channel: 'favoriteTvChannel',
  channel: 'favoriteTvChannel',
  tv_program: 'favoriteTvProgram',
  program: 'favoriteTvProgram',
  streaming_service: 'favoriteStreamingService',
  room: 'favoriteRoom',
  wake_up_time: 'preferredWakeTime',
  wake_time: 'preferredWakeTime',
  bed_time: 'preferredBedTime',
  breakfast_time: 'preferredBreakfastTime',
  lunch_time: 'preferredLunchTime',
  dinner_time: 'preferredDinnerTime',
  music_time: 'preferredMusicTime',
  tv_time: 'preferredTvTime'
});

const EVENT_WEIGHTS = Object.freeze({
  explicit_favorite: 10,
  explicit_dislike: -10,
  selected: 3,
  played: 2,
  opened: 2,
  repeated: 1,
  completed: 1,
  ignored: -1,
  skipped: -2,
  replaced: -3,
  message_sent: 2,
  call_started: 3
});

function normalizeKind(kind) {
  const raw = String(kind || '').trim();
  if (!raw) return '';
  const camel = raw.replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase());
  if (/^(favorite|preferred)[A-Z]/.test(camel)) return camel[0].toLowerCase() + camel.slice(1);
  const key = normalizeLearningKey(raw).replace(/\./g, '_');
  return PREFERENCE_KIND_ALIASES[key] || '';
}

function preferenceFromExternalEvent(event = {}) {
  if (!event || typeof event !== 'object') return null;
  const type = String(event.type || event.event || '').trim().toLowerCase();
  if (!['preference', 'favorite', 'media_usage', 'contact_usage', 'food_usage', 'tv_usage'].includes(type)) return null;
  let kind = normalizeKind(event.kind || event.preferenceKind);
  if (!kind && type === 'media_usage') kind = normalizeKind(event.mediaType || 'song');
  if (!kind && type === 'contact_usage') kind = 'favoriteContact';
  if (!kind && type === 'food_usage') kind = 'favoriteFood';
  if (!kind && type === 'tv_usage') kind = normalizeKind(event.channel ? 'tv_channel' : 'tv_program');
  const value = stripLearningPunctuation(event.value || event.name || event.title || event.personName || event.personId || event.channel || event.service);
  if (!kind || !value) return null;
  return {
    kind,
    value,
    signal: String(event.signal || event.action || (type === 'favorite' ? 'explicit_favorite' : 'selected')).trim().toLowerCase(),
    context: event.context && typeof event.context === 'object' ? { ...event.context } : {},
    source: event.source || type,
    explicit: type === 'favorite' || event.confirmed === true || /explicit/i.test(String(event.signal || ''))
  };
}

function preferenceFromText(text) {
  const input = String(text || '').trim();
  const favorite = input.match(/\bmy\s+favou?rite\s+(contact|song|artist|album|playlist|music genre|food|restaurant|tv channel|channel|tv program|streaming service|room)\s+(?:is|=)\s+(.+)$/i);
  const preferred = input.match(/\bmy\s+(wake(?:-|\s*)up|bed|breakfast|lunch|dinner|music|tv)\s+time\s+(?:is|=|at)\s+(.+)$/i);
  if (favorite) {
    return {
      kind: normalizeKind(favorite[1]),
      value: stripLearningPunctuation(favorite[2]),
      signal: 'explicit_favorite',
      source: 'explicit-user-preference',
      explicit: true
    };
  }
  if (preferred) {
    return {
      kind: normalizeKind(`${preferred[1]} time`),
      value: stripLearningPunctuation(preferred[2]),
      signal: 'explicit_favorite',
      source: 'explicit-user-preference',
      explicit: true
    };
  }
  return null;
}

function decayedScore(existingRecord, eventWeight, decayPerWeek, nowMs) {
  const existingScore = Number(existingRecord?.metadata?.preferenceScore || 0);
  const updatedAt = Date.parse(existingRecord?.updatedAt || existingRecord?.metadata?.lastObservedAt || '');
  const ageWeeks = Number.isFinite(updatedAt) && Number.isFinite(nowMs)
    ? Math.max(0, (nowMs - updatedAt) / (7 * 24 * 60 * 60 * 1000))
    : 0;
  return existingScore * Math.pow(decayPerWeek, ageWeeks) + eventWeight;
}

class PersonalPreferenceLearning extends BaseLearningModule {
  learn(context) {
    const preference = preferenceFromExternalEvent(context.externalEvent) ||
      preferenceFromText(context.metadata.rawInput);
    if (!preference) return context;

    const key = `${preference.kind}.${normalizeLearningKey(preference.value)}`;
    const storageKey = `preference:${key}`;
    const existing = context.storage?.getRecord?.('preferences', storageKey);
    const eventWeight = EVENT_WEIGHTS[preference.signal] ?? (preference.explicit ? 10 : 1);
    const score = decayedScore(existing, eventWeight, Number(this.getOption('decayPerWeek', 0.98)), Date.parse(context.now()));
    const observations = Number(existing?.count || 0) + 1;
    const positiveEvents = Number(existing?.metadata?.positiveEvents || 0) + (eventWeight > 0 ? 1 : 0);
    const negativeEvents = Number(existing?.metadata?.negativeEvents || 0) + (eventWeight < 0 ? 1 : 0);
    const confidence = preference.explicit
      ? 0.95
      : Math.max(0.7, Math.min(0.92, observations / (observations + negativeEvents + 5)));

    context.addEvent({
      category: 'preference',
      key,
      value: preference.value,
      confidence,
      source: preference.source,
      module: this.id,
      metadata: {
        advancedPreference: true,
        kind: preference.kind,
        valueKey: normalizeLearningKey(preference.value),
        signal: preference.signal,
        eventWeight,
        preferenceScore: Number(score.toFixed(4)),
        positiveEvents,
        negativeEvents,
        totalObservations: observations,
        firstObservedAt: existing?.createdAt || context.now(),
        lastObservedAt: context.now(),
        confirmed: preference.explicit,
        context: preference.context || {}
      }
    });
    return context;
  }
}

module.exports = PersonalPreferenceLearning;
module.exports.PREFERENCE_KIND_ALIASES = PREFERENCE_KIND_ALIASES;
