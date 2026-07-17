'use strict';

const fs = require('fs');
const path = require('path');
const { getSpecialFolderPaths } = require('../../../../../automation/common/path-utils');
const { hashPath, listFilesRecursive } = require('../utils/FileSystemUtils');
const { IMAGE_EXTENSIONS } = require('../utils/constants');

function defaultFolders() {
  const candidates = [
    ...getSpecialFolderPaths('pictures'),
    process.env.PUBLIC ? path.join(process.env.PUBLIC, 'Pictures') : ''
  ].filter(Boolean);
  return Array.from(new Set(candidates.map(folder => path.resolve(folder))))
    .filter(folder => {
      try {
        return fs.existsSync(folder) && fs.statSync(folder).isDirectory();
      } catch (_) {
        return false;
      }
    });
}

class FolderManager {
  constructor({ database, validator, events, logger } = {}) {
    this.database = database;
    this.validator = validator;
    this.events = events;
    this.logger = logger || console;
  }

  async addFolder(folderPath, options = {}) {
    const validation = await this.validator.validateFolderPath(folderPath);
    if (!validation.valid) throw new Error(validation.reason);
    const id = hashPath(validation.path);
    const existing = this.database.getTable('folders')[id];
    const record = {
      id,
      path: validation.path,
      label: options.label || path.basename(validation.path),
      enabled: options.enabled !== false,
      source: options.source || 'user',
      createdAt: existing?.createdAt || new Date().toISOString(),
      lastIndexedAt: existing?.lastIndexedAt || null
    };
    await this.database.upsert('folders', id, record);
    this.events?.emit?.(this.events.VISUAL_MEMORY_EVENTS?.FOLDER_ADDED || 'visual-memory.folder.added', record);
    return record;
  }

  async addDefaultFolders() {
    const added = [];
    const folders = defaultFolders();
    await this._removeStaleDefaultFolders(folders);
    for (const folder of folders) {
      try {
        added.push(await this.addFolder(folder, {
          source: 'default',
          label: this._defaultFolderLabel(folder)
        }));
      } catch (_) {
        // Missing default folders are normal on some Windows profiles.
      }
    }
    return added;
  }

  async _removeStaleDefaultFolders(activeDefaultFolders = []) {
    const activeKeys = new Set(activeDefaultFolders.map(folder => path.resolve(folder).toLowerCase()));
    const folders = this.database.getTable('folders');
    for (const folder of Object.values(folders)) {
      if (folder?.source !== 'default') continue;
      const folderPath = String(folder.path || '').trim();
      const folderKey = folderPath ? path.resolve(folderPath).toLowerCase() : '';
      const exists = folderPath && fs.existsSync(folderPath);
      if (exists && activeKeys.has(folderKey)) continue;
      await this.database.remove('folders', folder.id);
      this.events?.emit?.(
        this.events.VISUAL_MEMORY_EVENTS?.FOLDER_REMOVED || 'visual-memory.folder.removed',
        { ...folder, reason: exists ? 'not-current-default-folder' : 'missing-default-folder' }
      );
    }
  }

  _defaultFolderLabel(folderPath) {
    const basename = path.basename(folderPath);
    if (/^pictures$/i.test(basename)) return 'Pictures';
    const parent = path.basename(path.dirname(folderPath));
    return parent ? `${parent} ${basename}` : basename || 'Pictures';
  }

  async removeFolder(folderIdOrPath) {
    const id = this._resolveFolderId(folderIdOrPath);
    const folder = this.database.getTable('folders')[id];
    const removed = await this.database.remove('folders', id);
    if (removed) this.events?.emit?.(this.events.VISUAL_MEMORY_EVENTS?.FOLDER_REMOVED || 'visual-memory.folder.removed', folder);
    return removed;
  }

  async setFolderEnabled(folderIdOrPath, enabled) {
    const id = this._resolveFolderId(folderIdOrPath);
    const folder = this.database.getTable('folders')[id];
    if (!folder) throw new Error('Folder is not tracked');
    return this.database.upsert('folders', id, { ...folder, enabled: Boolean(enabled) });
  }

  listFolders() {
    return Object.values(this.database.getTable('folders'));
  }

  getFolder(folderIdOrPath) {
    return this.database.getTable('folders')[this._resolveFolderId(folderIdOrPath)] || null;
  }

  async getFolderStats(folderIdOrPath) {
    const folder = this.getFolder(folderIdOrPath);
    if (!folder) throw new Error('Folder is not tracked');
    const imageFiles = await listFilesRecursive(folder.path, {
      extensions: IMAGE_EXTENSIONS,
      maxDepth: 8,
      maxFiles: 50000
    });
    return { folderId: folder.id, path: folder.path, files: imageFiles.length, images: imageFiles.length, recursive: true };
  }

  _resolveFolderId(folderIdOrPath) {
    const value = String(folderIdOrPath || '').trim();
    return this.database.getTable('folders')[value] ? value : hashPath(path.resolve(value));
  }
}

module.exports = FolderManager;
