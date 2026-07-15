'use strict';

const { DEFAULT_VISUAL_MEMORY_SETTINGS, VISUAL_MEMORY_STATE_VERSION } = require('../utils/constants');

function mergeSettings(base, patch) {
  const output = { ...(base || {}) };
  for (const [key, value] of Object.entries(patch || {})) {
    output[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? mergeSettings(output[key] || {}, value)
      : value;
  }
  return output;
}

class SettingsManager {
  constructor({ database, validator, events, logger } = {}) {
    this.database = database;
    this.validator = validator;
    this.events = events;
    this.logger = logger || console;
  }

  getSettings() {
    const settings = this.database.getTable('settings');
    return mergeSettings(DEFAULT_VISUAL_MEMORY_SETTINGS, settings);
  }

  async updateSettings(patch = {}) {
    const validation = this.validator.validateSettings(patch);
    if (!validation.valid) throw new Error(validation.reason);
    const next = mergeSettings(this.getSettings(), patch);
    next.version = VISUAL_MEMORY_STATE_VERSION;
    await this.database.replaceTable('settings', next);
    this.events?.emit?.(this.events.VISUAL_MEMORY_EVENTS?.SETTINGS_UPDATED || 'visual-memory.settings.updated', { settings: next });
    return next;
  }

  async resetSettings() {
    await this.database.replaceTable('settings', mergeSettings({}, DEFAULT_VISUAL_MEMORY_SETTINGS));
    return this.getSettings();
  }
}

module.exports = SettingsManager;
