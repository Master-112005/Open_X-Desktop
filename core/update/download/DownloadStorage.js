const fs = require('fs');
const path = require('path');

function safeName(value, fallback = 'download.bin') {
  const base = path.basename(String(value || fallback)).replace(/[^A-Za-z0-9._ -]/g, '_').trim();
  return base || fallback;
}

class DownloadStorage {
  constructor(options = {}) {
    this.downloadsDir = options.downloadsDir;
    this.cacheDir = options.cacheDir;
  }

  ensure() {
    fs.mkdirSync(this.downloadsDir, { recursive: true });
    fs.mkdirSync(this.cacheDir, { recursive: true });
  }

  buildPaths(task) {
    this.ensure();
    const fileName = safeName(task.fileName || this.nameFromUrl(task.url));
    const destinationPath = this.uniqueCompletedPath(fileName);
    const partPath = path.join(this.cacheDir, `${task.id}.part`);
    const metadataPath = path.join(this.cacheDir, `${task.id}.json`);
    return { fileName, destinationPath, partPath, metadataPath };
  }

  nameFromUrl(url) {
    try {
      return safeName(new URL(url).pathname.split('/').pop(), 'download.bin');
    } catch (_) {
      return 'download.bin';
    }
  }

  uniqueCompletedPath(fileName) {
    let candidate = path.join(this.downloadsDir, fileName);
    const ext = path.extname(fileName);
    const stem = path.basename(fileName, ext);
    let index = 1;
    while (fs.existsSync(candidate)) {
      candidate = path.join(this.downloadsDir, `${stem}-${index}${ext}`);
      index += 1;
    }
    return candidate;
  }

  readMetadata(metadataPath) {
    try {
      return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    } catch (_) {
      return null;
    }
  }

  writeMetadata(task) {
    if (!task.metadataPath) return false;
    fs.writeFileSync(task.metadataPath, JSON.stringify(task.snapshot(), null, 2));
    return true;
  }

  removeMetadata(task) {
    if (task.metadataPath) fs.rmSync(task.metadataPath, { force: true });
  }
}

module.exports = DownloadStorage;
