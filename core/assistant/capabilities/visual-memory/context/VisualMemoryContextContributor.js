'use strict';

class VisualMemoryContextContributor {
  contribute(session = {}, result = null) {
    return {
      currentMemory: session.currentMemory || null,
      currentImage: session.currentImage || null,
      currentCollection: session.currentCollection || null,
      currentAlbum: session.currentAlbum || null,
      currentTimeline: session.currentTimeline || null,
      currentSearch: session.currentSearch || null,
      currentPeople: session.currentPeople || [],
      currentLocation: session.currentLocation || null,
      currentEvent: session.currentEvent || null,
      currentSelection: session.currentSelection || [],
      lastResultType: result?.type || null
    };
  }

  writeToPipeline(context, patch = {}) {
    if (!context?.set) return patch;
    context.set('assistant.visualMemory.context', patch);
    context.visualMemoryContext = patch;
    return patch;
  }
}

module.exports = VisualMemoryContextContributor;
