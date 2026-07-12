const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function normalizeRelative(value) {
  return String(value || '').replace(/^[a-z]:/i, '').replace(/^[/\\]+/, '').replace(/[<>:"|?*]/g, '_');
}

class BackupManager {
  constructor(options = {}) {
    this.backupRoot = options.backupRoot || '';
    this.configuration = options.configuration;
    this.logger = options.logger || console;
  }

  initialize(options = {}) {
    this.backupRoot = options.backupRoot || this.backupRoot;
    if (this.backupRoot) fs.mkdirSync(this.backupRoot, { recursive: true });
  }

  createBackup(input = {}) {
    const startedAt = Date.now();
    const backupId = input.backupId || `backup-${Date.now()}`;
    if (!this.backupRoot) throw new Error('Recovery backup root is not configured.');
    if (this.configuration?.backup?.singleGeneration !== false && fs.existsSync(this.backupRoot)) {
      fs.rmSync(this.backupRoot, { recursive: true, force: true });
    }
    const filesDir = path.join(this.backupRoot, 'files');
    fs.mkdirSync(filesDir, { recursive: true });

    const sourcePaths = this._normalizeSourcePaths(input.sourcePaths || []);
    const files = [];
    for (const sourcePath of sourcePaths) {
      this._copySource(sourcePath, filesDir, files);
    }

    const manifest = {
      schemaVersion: 1,
      backupId,
      trusted: true,
      createdAt: new Date().toISOString(),
      currentVersion: String(input.currentVersion || ''),
      targetVersion: String(input.targetVersion || ''),
      files,
      durationMs: Date.now() - startedAt,
      metadata: {
        source: input.source || 'self-update',
        fileCount: files.length
      }
    };
    const manifestPath = path.join(this.backupRoot, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    this.logger.info?.('Recovery backup created', { backupId, files: files.length, durationMs: manifest.durationMs });
    return { ...manifest, manifestPath, backupRoot: this.backupRoot };
  }

  getLatestBackup() {
    const manifestPath = path.join(this.backupRoot || '', 'manifest.json');
    if (!fs.existsSync(manifestPath)) return null;
    try {
      return { ...JSON.parse(fs.readFileSync(manifestPath, 'utf8')), manifestPath, backupRoot: this.backupRoot };
    } catch (_) {
      return null;
    }
  }

  _normalizeSourcePaths(sourcePaths) {
    const unique = new Set();
    const normalized = [];
    for (const item of Array.isArray(sourcePaths) ? sourcePaths : []) {
      const filePath = typeof item === 'string' ? item : item?.path || item?.sourcePath;
      if (!filePath || !fs.existsSync(filePath)) continue;
      const resolved = path.resolve(filePath);
      if (unique.has(resolved)) continue;
      unique.add(resolved);
      normalized.push({ sourcePath: resolved, alias: typeof item === 'object' ? item.alias : null });
    }
    return normalized;
  }

  _copySource(source, filesDir, files) {
    const stats = fs.statSync(source.sourcePath);
    if (stats.isDirectory()) {
      this._copyDirectory(source.sourcePath, source.sourcePath, filesDir, files, source.alias);
      return;
    }
    if (stats.isFile()) {
      const relativePath = normalizeRelative(source.alias || path.basename(source.sourcePath));
      this._copyFile(source.sourcePath, path.join(filesDir, relativePath), relativePath, files);
    }
  }

  _copyDirectory(root, current, filesDir, files, alias) {
    const names = fs.readdirSync(current);
    for (const name of names) {
      if (this._isExcluded(name)) continue;
      const child = path.join(current, name);
      const stats = fs.statSync(child);
      if (stats.isDirectory()) {
        this._copyDirectory(root, child, filesDir, files, alias);
      } else if (stats.isFile()) {
        const relative = normalizeRelative(path.join(alias || path.basename(root), path.relative(root, child)));
        this._copyFile(child, path.join(filesDir, relative), relative, files);
      }
    }
  }

  _copyFile(sourcePath, backupPath, relativePath, files) {
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.copyFileSync(sourcePath, backupPath);
    const stats = fs.statSync(backupPath);
    files.push({
      relativePath,
      sourcePath,
      backupPath,
      size: stats.size,
      sha256: sha256(backupPath)
    });
  }

  _isExcluded(name) {
    const lower = String(name || '').toLowerCase();
    const excluded = this.configuration?.backup?.excludeNames || [];
    return excluded.map(item => String(item).toLowerCase()).includes(lower);
  }
}

module.exports = BackupManager;
