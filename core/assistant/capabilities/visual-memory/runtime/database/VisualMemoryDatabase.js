'use strict';

const path = require('path');
const { VISUAL_MEMORY_SCHEMA_VERSION, DEFAULT_VISUAL_MEMORY_SETTINGS } = require('../utils/constants');
const { ensureDir, readJson, writeJsonAtomic } = require('../utils/FileSystemUtils');

function emptySchema() {
  return {
    schemaVersion: VISUAL_MEMORY_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    photos: {},
    folders: {},
    albums: {},
    thumbnails: {},
    metadata: {},
    galleryState: { selectedPhotoIds: [], view: 'grid' },
    settings: { ...DEFAULT_VISUAL_MEMORY_SETTINGS },
    indexStatus: {},
    diagnostics: []
  };
}

class VisualMemoryDatabase {
  constructor(options = {}) {
    this.filePath = options.filePath;
    this.logger = options.logger || console;
    this.data = null;
    this.opened = false;
  }

  async open() {
    if (this.opened) return this;
    if (!this.filePath) throw new Error('Visual Memory database file path is required');
    await ensureDir(path.dirname(this.filePath));
    const loaded = await readJson(this.filePath, null);
    this.data = this._migrate(loaded || emptySchema());
    await this._persist();
    this.opened = true;
    return this;
  }

  async close() {
    if (this.opened) await this._persist();
    this.opened = false;
  }

  async reset() {
    this.data = emptySchema();
    await this._persist();
    return this.snapshot();
  }

  snapshot() {
    return JSON.parse(JSON.stringify(this.data || emptySchema()));
  }

  getTable(table) {
    this._assertOpen();
    return this.data[table] || {};
  }

  async upsert(table, id, record) {
    this._assertOpen();
    if (!this.data[table] || Array.isArray(this.data[table])) this.data[table] = {};
    this.data[table][id] = { ...(this.data[table][id] || {}), ...record, id, updatedAt: new Date().toISOString() };
    await this._persist();
    return this.data[table][id];
  }

  async remove(table, id) {
    this._assertOpen();
    if (!this.data[table]) return false;
    const existed = Object.prototype.hasOwnProperty.call(this.data[table], id);
    delete this.data[table][id];
    await this._persist();
    return existed;
  }

  async replaceTable(table, value) {
    this._assertOpen();
    this.data[table] = value;
    await this._persist();
    return this.data[table];
  }

  async appendDiagnostic(event) {
    this._assertOpen();
    const maxEvents = Number(this.data.settings?.diagnostics?.maxEvents || 500);
    this.data.diagnostics.push({ ...event, timestamp: event.timestamp || new Date().toISOString() });
    while (this.data.diagnostics.length > maxEvents) this.data.diagnostics.shift();
    await this._persist();
  }

  _migrate(data) {
    const migrated = { ...emptySchema(), ...(data || {}) };
    migrated.schemaVersion = Number(migrated.schemaVersion || 0);
    if (migrated.schemaVersion < 1) migrated.schemaVersion = 1;
    migrated.updatedAt = new Date().toISOString();
    return migrated;
  }

  async _persist() {
    if (!this.data) return;
    this.data.updatedAt = new Date().toISOString();
    await writeJsonAtomic(this.filePath, this.data);
  }

  _assertOpen() {
    if (!this.opened || !this.data) throw new Error('Visual Memory database is not open');
  }
}

module.exports = VisualMemoryDatabase;
