'use strict';

class VisualMemoryStructuredResponse {
  build(result = {}, session = {}) {
    return {
      capability: 'visual-memory',
      type: result.type || result.action || 'unknown',
      action: result.action || '',
      success: result.success === true,
      resultCount: result.data?.total || result.data?.results?.length || 0,
      topResults: result.data?.results?.slice?.(0, 5) || [],
      confidence: result.data?.topConfidence || result.data?.results?.[0]?.confidence || 0,
      requiresVerification: result.requiresVerification === true,
      verification: result.verification || null,
      session: {
        id: session.id,
        currentImage: session.currentImage,
        selectionCount: session.currentSelection?.length || 0
      }
    };
  }
}

module.exports = VisualMemoryStructuredResponse;
