'use strict';

class GallerySearchExperience {
  constructor({ recent, validator, diagnostics } = {}) {
    this.recent = recent;
    this.validator = validator;
    this.diagnostics = diagnostics;
  }

  async openResults(searchResult = {}, options = {}) {
    const validation = this.validator.validateSearchResult(searchResult);
    if (!validation.valid) throw new Error(validation.reason);
    const results = Array.isArray(searchResult.results) ? searchResult.results : [];
    const view = {
      view: 'search-results',
      queryId: options.queryId || searchResult.session?.id || null,
      results,
      total: Number(searchResult.total ?? results.length),
      hasMore: Boolean(searchResult.hasMore),
      continuationToken: searchResult.continuationToken || null,
      statistics: {
        strategies: searchResult.reasoning?.strategies || [],
        searchTimeMs: searchResult.diagnostics?.durationMs || null
      },
      performsNlp: false
    };
    await this.recent.add('searches', { id: view.queryId || `search:${Date.now()}`, total: view.total, strategies: view.statistics.strategies });
    this.diagnostics?.record?.('search-results-opened', { total: view.total, queryId: view.queryId });
    return view;
  }
}

module.exports = GallerySearchExperience;
