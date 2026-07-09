'use strict';

const BaseInputAdapter = require('./BaseInputAdapter');

class PluginAdapter extends BaseInputAdapter {
  constructor(options = {}) {
    super({ ...options, id: 'plugin', source: 'plugin', sourceType: 'plugin-request', priority: options.priority ?? 70 });
  }

  normalizeMetadata(metadata = {}) {
    return {
      ...metadata,
      pluginId: metadata.pluginId || metadata.id || null,
      permissionScope: metadata.permissionScope || null
    };
  }
}

module.exports = PluginAdapter;
