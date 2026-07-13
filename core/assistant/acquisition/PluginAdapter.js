'use strict';

const BaseInputAdapter = require('./BaseInputAdapter');

class PluginAdapter extends BaseInputAdapter {
  constructor(options = {}) {
    super({
      ...options,
      id: 'plugin',
      source: 'plugin',
      aliases: ['extension'],
      sourceType: 'plugin-request',
      priority: options.priority ?? 70,
      capabilities: ['text', 'plugin-command']
    });
  }

  normalizeMetadata(metadata = {}) {
    return {
      ...metadata,
      pluginId: metadata.pluginId || metadata.id || null,
      permissionScope: metadata.permissionScope || null,
      trusted: metadata.trusted === true
    };
  }
}

module.exports = PluginAdapter;
