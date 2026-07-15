'use strict';

const path = require('path');
const { IMAGE_EXTENSIONS } = require('../utils/constants');
const { safeStat } = require('../utils/FileSystemUtils');

class VisualMemoryValidator {
  constructor(options = {}) {
    this.allowedExtensions = new Set((options.allowedExtensions || IMAGE_EXTENSIONS).map(item => String(item).toLowerCase()));
    this.maxPageSize = Number(options.maxPageSize || 250);
  }

  async validateFolderPath(folderPath) {
    const resolved = path.resolve(String(folderPath || '').trim());
    if (!resolved || resolved === path.parse(resolved).root) {
      return { valid: false, reason: 'Folder path is empty or too broad', path: resolved };
    }
    const stat = await safeStat(resolved);
    if (!stat) return { valid: false, reason: 'Folder does not exist', path: resolved };
    if (!stat.isDirectory()) return { valid: false, reason: 'Path is not a folder', path: resolved };
    return { valid: true, path: resolved };
  }

  validateImagePath(filePath) {
    const resolved = path.resolve(String(filePath || '').trim());
    const extension = path.extname(resolved).toLowerCase();
    if (!this.allowedExtensions.has(extension)) {
      return { valid: false, reason: 'Unsupported image type', path: resolved, extension };
    }
    return { valid: true, path: resolved, extension };
  }

  validateGalleryQuery(query = {}) {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.max(1, Math.min(this.maxPageSize, Number(query.pageSize || 60)));
    const sortBy = ['createdAt', 'modifiedAt', 'fileName', 'fileSize', 'indexedAt'].includes(query.sortBy)
      ? query.sortBy
      : 'createdAt';
    const sortDirection = String(query.sortDirection || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    return { page, pageSize, sortBy, sortDirection, folderId: query.folderId || null, fileType: query.fileType || null };
  }

  validateSettings(settings = {}) {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return { valid: false, reason: 'Settings must be an object' };
    }
    return { valid: true };
  }
}

module.exports = VisualMemoryValidator;
