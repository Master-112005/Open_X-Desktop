'use strict';

function compactText(value, maxLength = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

class MediaContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.media');
    this.priority = Number.isFinite(options.priority) ? options.priority : 180;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    const media = context.snapshots?.media || {};
    const topic = context.topic?.type === 'media' ? context.topic.label : null;
    context.context.media = {
      state: media.state || media.playbackState || 'unknown',
      title: compactText(media.title || media.track || topic || '', 180) || null,
      artist: compactText(media.artist || '', 120) || null,
      album: compactText(media.album || '', 120) || null,
      source: compactText(media.source || media.player || media.platform || '', 80) || null,
      lastQuery: compactText(media.lastQuery || topic || '', 180) || null,
      volume: Number.isFinite(Number(media.volume)) ? Number(media.volume) : null,
      canControl: media.canControl !== false
    };
    return context;
  }
}

module.exports = MediaContext;
