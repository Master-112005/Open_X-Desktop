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

function normalizeList(values) {
  return new Set((Array.isArray(values) ? values : []).map(value => String(value || '').toLowerCase().trim()).filter(Boolean));
}

class EntityResolver {
  constructor(options = {}) {
    this.id = options.id || 'entity.resolver';
    this.priority = Number.isFinite(options.priority) ? options.priority : 1010;
    this.providers = { ...(options.providers || {}) };
    this.installedApplications = normalizeList(this.providers.installedApplications || this.providers.applications);
    this.knownBrowsers = normalizeList(this.providers.browsers || ['Google Chrome', 'Microsoft Edge', 'Mozilla Firefox']);
  }

  process(context) {
    for (const folder of context.entities.folders) {
      const key = String(folder.value || folder.canonical || '').toLowerCase().replace(/\s+folder$/, '');
      if (KNOWN_FOLDERS[key]) {
        folder.resolved = { kind: 'known-system-folder', path: KNOWN_FOLDERS[key]() };
      }
    }

    for (const app of context.entities.applications) {
      const name = app.canonical || app.value;
      const key = String(name).toLowerCase();
      app.resolved = app.resolved || {
        kind: this.installedApplications.size === 0 || this.installedApplications.has(key)
          ? 'installed-application'
          : 'application-name',
        name
      };
    }

    for (const browser of context.entities.browsers) {
      const name = browser.canonical || browser.value;
      browser.resolved = browser.resolved || {
        kind: this.knownBrowsers.has(String(name).toLowerCase()) ? 'known-browser' : 'browser-reference',
        name
      };
    }

    for (const website of context.entities.websites) {
      const value = website.canonical || website.value;
      website.resolved = website.resolved || {
        kind: /^https?:\/\//i.test(value) || /\.[a-z]{2,}/i.test(value) ? 'url' : 'known-website',
        value
      };
    }

    for (const contact of context.entities.contacts) {
      contact.resolved = contact.resolved || { kind: 'contact-reference', name: contact.canonical || contact.value };
    }

    return context;
  }
}

module.exports = EntityResolver;
