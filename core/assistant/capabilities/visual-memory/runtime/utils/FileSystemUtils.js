'use strict';

const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
  return dirPath;
}

async function pathExists(targetPath) {
  try {
    await fsp.access(targetPath);
    return true;
  } catch (_) {
    return false;
  }
}

async function safeStat(targetPath) {
  try {
    return await fsp.stat(targetPath);
  } catch (error) {
    error.code = error.code || 'stat_failed';
    return null;
  }
}

async function resolvePath(targetPath) {
  return path.resolve(String(targetPath || '').trim());
}

function hashPath(targetPath) {
  return crypto.createHash('sha256').update(String(targetPath || '').toLowerCase()).digest('hex');
}

function isSubPath(childPath, parentPath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return relative === '' || (relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

async function listFilesShallow(folderPath) {
  const entries = await fsp.readdir(folderPath, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile())
    .map(entry => path.join(folderPath, entry.name));
}

async function listFilesRecursive(folderPath, options = {}) {
  const root = path.resolve(folderPath);
  const maxDepth = Math.max(0, Math.min(20, Number(options.maxDepth ?? 8)));
  const maxFiles = Math.max(1, Math.min(250000, Number(options.maxFiles ?? 50000)));
  const extensions = options.extensions
    ? new Set(options.extensions.map(item => String(item).toLowerCase()))
    : null;
  const excludedFolders = (options.excludedFolders || [])
    .map(item => path.resolve(String(item || '').trim()))
    .filter(Boolean);
  const files = [];
  const queue = [{ dir: root, depth: 0 }];
  const visited = new Set();

  while (queue.length && files.length < maxFiles) {
    const current = queue.shift();
    const resolvedDir = path.resolve(current.dir);
    const normalizedDir = resolvedDir.toLowerCase();
    if (visited.has(normalizedDir)) continue;
    visited.add(normalizedDir);
    if (excludedFolders.some(excluded => isSubPath(resolvedDir, excluded))) continue;

    let entries = [];
    try {
      entries = await fsp.readdir(resolvedDir, { withFileTypes: true });
    } catch (_) {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(resolvedDir, entry.name);
      if (entry.isDirectory()) {
        if (current.depth < maxDepth) queue.push({ dir: entryPath, depth: current.depth + 1 });
        continue;
      }
      if (!entry.isFile()) continue;
      if (extensions && !extensions.has(path.extname(entry.name).toLowerCase())) continue;
      files.push(entryPath);
      if (files.length >= maxFiles) break;
    }
  }

  return files;
}

module.exports = {
  ensureDir,
  hashPath,
  isSubPath,
  listFilesRecursive,
  listFilesShallow,
  pathExists,
  resolvePath,
  safeStat,
  fs
};
