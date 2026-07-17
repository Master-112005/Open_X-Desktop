'use strict';

const KNOWN_FOLDERS = Object.freeze({
  desktop: 'desktop',
  downloads: 'downloads',
  documents: 'documents',
  pictures: 'pictures',
  music: 'music',
  videos: 'videos',
  home: 'home'
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
        folder.resolved = { kind: 'known-system-folder', location: KNOWN_FOLDERS[key] };
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
        value,
        url: /^https?:\/\//i.test(value)
          ? value
          : /\.[a-z]{2,}/i.test(value)
            ? `https://${value.replace(/^www\./i, '')}`
            : null
      };
    }

    for (const contact of context.entities.contacts) {
      contact.resolved = contact.resolved || { kind: 'contact-reference', name: contact.canonical || contact.value };
    }

    for (const file of context.entities.files) {
      file.resolved = file.resolved || { kind: /\.[A-Za-z0-9]{1,10}$/.test(file.value) ? 'file-name' : 'file-reference', name: file.value };
    }

    for (const pathEntity of context.entities.paths) {
      pathEntity.resolved = pathEntity.resolved || { kind: 'path-reference', path: pathEntity.value };
    }

    for (const entity of [
      ...context.entities.dates,
      ...context.entities.times,
      ...context.entities.durations,
      ...context.entities.reminders,
      ...context.entities.alarms,
      ...context.entities.timers
    ]) {
      entity.resolved = entity.resolved || { kind: `${entity.type}-reference`, value: entity.canonical || entity.value };
    }

    return context;
  }
}

module.exports = EntityResolver;
