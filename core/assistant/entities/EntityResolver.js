'use strict';

const path = require('path');
const os = require('os');

const KNOWN_FOLDERS = Object.freeze({
  desktop: () => path.join(os.homedir(), 'Desktop'),
  downloads: () => path.join(os.homedir(), 'Downloads'),
  documents: () => path.join(os.homedir(), 'Documents'),
  pictures: () => path.join(os.homedir(), 'Pictures'),
  music: () => path.join(os.homedir(), 'Music'),
  videos: () => path.join(os.homedir(), 'Videos'),
  home: () => os.homedir()
});

class EntityResolver {
  constructor(options = {}) {
    this.id = options.id || 'entity.resolver';
    this.priority = Number.isFinite(options.priority) ? options.priority : 1010;
    this.providers = { ...(options.providers || {}) };
  }

  process(context) {
    for (const folder of context.entities.folders) {
      const key = String(folder.value || folder.canonical || '').toLowerCase().replace(/\s+folder$/, '');
      if (KNOWN_FOLDERS[key]) {
        folder.resolved = { kind: 'known-system-folder', path: KNOWN_FOLDERS[key]() };
      }
    }

    for (const app of context.entities.applications) {
      app.resolved = app.resolved || { kind: 'application-name', name: app.canonical || app.value };
    }

    for (const contact of context.entities.contacts) {
      contact.resolved = contact.resolved || { kind: 'contact-reference', name: contact.canonical || contact.value };
    }

    return context;
  }
}

module.exports = EntityResolver;
