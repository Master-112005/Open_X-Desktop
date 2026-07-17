'use strict';

const OWNER_ALIASES = Object.freeze({
  me: 'user',
  my: 'user',
  mine: 'user',
  i: 'user',
  myself: 'user',
  self: 'user',
  owner: 'user',
  our: 'shared',
  ours: 'shared',
  us: 'shared',
  family: 'family',
  friends: 'friends',
  his: 'other',
  her: 'other',
  their: 'other',
  theirs: 'other'
});

const MEDIA_ALIASES = Object.freeze({
  photos: 'photo',
  photo: 'photo',
  pictures: 'photo',
  picture: 'photo',
  pics: 'photo',
  pic: 'photo',
  images: 'image',
  image: 'image',
  screenshots: 'screenshot',
  screenshot: 'screenshot',
  snaps: 'screenshot',
  documents: 'document',
  document: 'document',
  docs: 'document',
  receipt: 'document',
  receipts: 'document',
  invoice: 'document',
  invoices: 'document',
  wallpaper: 'wallpaper',
  wallpapers: 'wallpaper',
  albums: 'album',
  album: 'album',
  gallery: 'gallery',
  galleries: 'gallery',
  selfie: 'photo',
  selfies: 'photo'
});

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeText(value) {
  return normalizeWhitespace(String(value || '').toLowerCase().replace(/[“”]/g, '"').replace(/[’]/g, "'"));
}

function titleCase(value) {
  return normalizeWhitespace(value).replace(/\b[a-z]/g, char => char.toUpperCase());
}

class VisualQueryNormalizer {
  normalizeText(value) {
    return normalizeText(value);
  }

  normalizeMedia(value) {
    const key = normalizeText(value).replace(/[^a-z0-9]+/g, ' ').trim();
    return MEDIA_ALIASES[key] || key || 'unknown';
  }

  normalizeOwner(value) {
    const key = normalizeText(value).split(/\s+/)[0] || '';
    return OWNER_ALIASES[key] || key || 'unknown';
  }

  normalizeLabel(value) {
    return titleCase(value);
  }

  confidence(base, modifiers = {}) {
    let score = Number(base || 0);
    if (modifiers.fromEntity) score += 0.08;
    if (modifiers.exact) score += 0.05;
    if (modifiers.generic) score -= 0.12;
    if (modifiers.ambiguous) score -= 0.15;
    return Math.max(0, Math.min(0.99, Number(score.toFixed(3))));
  }
}

module.exports = VisualQueryNormalizer;
