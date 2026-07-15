'use strict';

const VALID_VIEWS = new Set(['timeline', 'people', 'places', 'events', 'objects', 'collections', 'albums', 'favorites', 'recent', 'screenshots', 'documents', 'receipts', 'search-results', 'memory', 'viewer']);

class GalleryExperienceValidator {
  validateView(view) {
    const value = String(view || '').trim().toLowerCase();
    if (!VALID_VIEWS.has(value)) return { valid: false, reason: `Unsupported Gallery view: ${view}` };
    return { valid: true, view: value };
  }

  validateSelectionMode(mode) {
    const value = String(mode || 'multiple').toLowerCase();
    if (!['single', 'multiple', 'range', 'query'].includes(value)) return { valid: false, reason: `Unsupported selection mode: ${mode}` };
    return { valid: true, mode: value };
  }

  validateFilter(filter = {}) {
    if (!filter || typeof filter !== 'object' || Array.isArray(filter)) return { valid: false, reason: 'Gallery filter must be an object.' };
    return { valid: true, filter };
  }

  validateSearchResult(result = {}) {
    if (!result || typeof result !== 'object') return { valid: false, reason: 'Search result must be an object.' };
    if (result.success === false) return { valid: false, reason: 'Search result was not successful.' };
    return { valid: true };
  }
}

module.exports = GalleryExperienceValidator;
