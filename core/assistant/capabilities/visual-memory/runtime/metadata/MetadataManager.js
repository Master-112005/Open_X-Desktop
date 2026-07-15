'use strict';

const fs = require('fs/promises');
const path = require('path');
const { hashPath, safeStat } = require('../utils/FileSystemUtils');

async function readDimensions(filePath, extension) {
  try {
    const handle = await fs.open(filePath, 'r');
    const buffer = Buffer.alloc(65536);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    await handle.close();
    const data = buffer.subarray(0, bytesRead);
    if (extension === '.png' && data.length >= 24 && data.toString('ascii', 1, 4) === 'PNG') {
      return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
    }
    if ((extension === '.jpg' || extension === '.jpeg') && data[0] === 0xFF && data[1] === 0xD8) {
      let offset = 2;
      while (offset + 9 < data.length) {
        if (data[offset] !== 0xFF) break;
        const marker = data[offset + 1];
        const length = data.readUInt16BE(offset + 2);
        if ([0xC0, 0xC2].includes(marker)) {
          return { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7) };
        }
        offset += 2 + length;
      }
    }
  } catch (_) {}
  return { width: null, height: null };
}

class MetadataManager {
  constructor({ database, validator, events, logger } = {}) {
    this.database = database;
    this.validator = validator;
    this.events = events;
    this.logger = logger || console;
  }

  async indexFile(filePath, options = {}) {
    const validation = this.validator.validateImagePath(filePath);
    if (!validation.valid) throw new Error(validation.reason);
    const stat = await safeStat(validation.path);
    if (!stat || !stat.isFile()) throw new Error('Image file does not exist');
    const dimensions = await readDimensions(validation.path, validation.extension);
    const id = hashPath(validation.path);
    const metadata = {
      id,
      photoId: id,
      fileName: path.basename(validation.path),
      filePath: validation.path,
      fileType: validation.extension.replace('.', ''),
      fileSize: stat.size,
      createdAt: stat.birthtime.toISOString(),
      modifiedAt: stat.mtime.toISOString(),
      indexedAt: new Date().toISOString(),
      folderId: options.folderId || null,
      width: dimensions.width,
      height: dimensions.height,
      orientation: null,
      camera: null,
      gps: null,
      exif: {}
    };
    await this.database.upsert('metadata', id, metadata);
    await this.database.upsert('photos', id, {
      id,
      folderId: metadata.folderId,
      fileName: metadata.fileName,
      filePath: metadata.filePath,
      fileType: metadata.fileType,
      fileSize: metadata.fileSize,
      createdAt: metadata.createdAt,
      modifiedAt: metadata.modifiedAt,
      indexedAt: metadata.indexedAt,
      width: metadata.width,
      height: metadata.height
    });
    this.events?.emit?.(this.events.VISUAL_MEMORY_EVENTS?.PHOTO_INDEXED || 'visual-memory.photo.indexed', { photoId: id });
    return metadata;
  }

  getMetadata(photoId) {
    return this.database.getTable('metadata')[photoId] || null;
  }
}

module.exports = MetadataManager;
