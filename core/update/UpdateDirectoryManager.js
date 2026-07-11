const fs = require('fs');
const path = require('path');
const { ensureDataRoot } = require('../assistant/Data');

class UpdateDirectoryManager {
  constructor(options = {}) {
    this.config = options.config || {};
    this.rootDir = options.rootDir || path.join(ensureDataRoot(this.config).root, 'updates');
    this.downloadsDir = options.downloadsDir || path.join(this.rootDir, 'downloads');
    this.cacheDir = options.cacheDir || path.join(this.rootDir, 'cache');
  }

  ensureDirectories() {
    const directories = [this.rootDir, this.downloadsDir, this.cacheDir];
    for (const directory of directories) {
      fs.mkdirSync(directory, { recursive: true });
    }
    return Object.freeze({
      rootDir: this.rootDir,
      downloadsDir: this.downloadsDir,
      cacheDir: this.cacheDir
    });
  }

  getPaths() {
    return Object.freeze({
      rootDir: this.rootDir,
      downloadsDir: this.downloadsDir,
      cacheDir: this.cacheDir
    });
  }
}

module.exports = UpdateDirectoryManager;
