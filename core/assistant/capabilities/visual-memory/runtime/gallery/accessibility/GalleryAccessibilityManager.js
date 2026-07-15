'use strict';

class GalleryAccessibilityManager {
  constructor({ configuration } = {}) {
    this.configuration = configuration;
  }

  getCapabilities() {
    return {
      keyboardNavigation: this.configuration.accessibility.keyboard,
      screenReaderLabels: this.configuration.accessibility.screenReader,
      highContrast: this.configuration.accessibility.highContrast,
      touch: this.configuration.accessibility.touch,
      shortcuts: {
        next: 'ArrowRight',
        previous: 'ArrowLeft',
        open: 'Enter',
        close: 'Escape',
        select: 'Space',
        search: 'Ctrl+F'
      }
    };
  }
}

module.exports = GalleryAccessibilityManager;
