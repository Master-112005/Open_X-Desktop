'use strict';

class GalleryExperienceConfiguration {
  constructor(options = {}) {
    this.layout = {
      defaultView: options.layout?.defaultView || 'timeline',
      density: options.layout?.density || 'comfortable',
      theme: options.layout?.theme || 'system'
    };
    this.thumbnails = {
      size: Math.max(96, Math.min(768, Number(options.thumbnails?.size || 256))),
      preloadWindow: Math.max(12, Number(options.thumbnails?.preloadWindow || 48))
    };
    this.timeline = {
      defaultGroup: options.timeline?.defaultGroup || 'month',
      highlightLimit: Math.max(1, Number(options.timeline?.highlightLimit || 12))
    };
    this.performance = {
      virtualPageSize: Math.max(24, Number(options.performance?.virtualPageSize || 96)),
      maxRecentItems: Math.max(10, Number(options.performance?.maxRecentItems || 100)),
      maxDiagnostics: Math.max(50, Number(options.performance?.maxDiagnostics || 300))
    };
    this.viewer = {
      filmstripSize: Math.max(5, Number(options.viewer?.filmstripSize || 21)),
      defaultZoom: Number(options.viewer?.defaultZoom || 1)
    };
    this.accessibility = {
      keyboard: options.accessibility?.keyboard !== false,
      screenReader: options.accessibility?.screenReader !== false,
      highContrast: options.accessibility?.highContrast === true,
      touch: options.accessibility?.touch !== false
    };
    this.navigation = {
      enabledViews: Array.isArray(options.navigation?.enabledViews) ? options.navigation.enabledViews.slice() : null
    };
    this.sorting = {
      defaultSortBy: options.sorting?.defaultSortBy || 'createdAt',
      defaultDirection: options.sorting?.defaultDirection || 'desc'
    };
  }

  toJSON() {
    return {
      layout: { ...this.layout },
      thumbnails: { ...this.thumbnails },
      timeline: { ...this.timeline },
      performance: { ...this.performance },
      viewer: { ...this.viewer },
      accessibility: { ...this.accessibility },
      navigation: { ...this.navigation, enabledViews: this.navigation.enabledViews ? this.navigation.enabledViews.slice() : null },
      sorting: { ...this.sorting }
    };
  }
}

module.exports = GalleryExperienceConfiguration;
