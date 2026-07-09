'use strict';

const CANONICAL = Object.freeze({
  application: {
    chrome: 'Google Chrome',
    msedge: 'Microsoft Edge',
    edge: 'Microsoft Edge',
    firefox: 'Mozilla Firefox',
    vscode: 'Visual Studio Code',
    'vs code': 'Visual Studio Code',
    notepad: 'Notepad'
  },
  browser: {
    chrome: 'Google Chrome',
    edge: 'Microsoft Edge',
    msedge: 'Microsoft Edge',
    firefox: 'Mozilla Firefox'
  },
  website: {
    yt: 'YouTube',
    youtube: 'YouTube',
    github: 'GitHub',
    google: 'Google',
    gmail: 'Gmail'
  },
  folder: {
    docs: 'Documents',
    documents: 'Documents',
    desktop: 'Desktop Folder',
    downloads: 'Downloads',
    pictures: 'Pictures',
    videos: 'Videos',
    music: 'Music'
  }
});

class EntityNormalizer {
  constructor(options = {}) {
    this.id = options.id || 'entity.normalizer';
    this.priority = Number.isFinite(options.priority) ? options.priority : 1000;
    this.maps = { ...CANONICAL, ...(options.maps || {}) };
  }

  process(context) {
    for (const entity of context.allEntities()) {
      const key = String(entity.value || '').toLowerCase();
      entity.canonical = this.maps[entity.type]?.[key] || entity.canonical || entity.value;
    }
    return context;
  }
}

module.exports = EntityNormalizer;
