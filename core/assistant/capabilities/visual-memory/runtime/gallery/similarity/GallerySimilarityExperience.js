'use strict';

class GallerySimilarityExperience {
  present(memorySearchResult = {}) {
    const results = Array.isArray(memorySearchResult.results) ? memorySearchResult.results : [];
    return {
      view: 'similar-photos',
      items: results.map(result => ({
        id: result.id,
        photoId: result.photoId,
        confidence: result.confidence,
        reason: result.reason || result.memoryTitle || 'Related memory'
      })),
      computesSimilarity: false
    };
  }
}

module.exports = GallerySimilarityExperience;
