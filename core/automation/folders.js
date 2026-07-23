const fs = require('fs');
const path = require('path');
const Logger = require('../assistant/Data').Logger;
const Normalizer = require('../assistant/Data').Normalizer;
const Validator = require('../assistant/Data').Validator;
const {
  findEntriesByName,
  findEntryByName,
  getDefaultSearchRoots,
  getHomeDirectory,
  getSpecialFolders,
  normalizeLocation,
  requireSafeUserPath,
  resolveDestinationPath,
  resolveDirectory,
  splitNameAndLocation,
  validateWindowsName,
  validateWindowsPathLength
} = require('./common/path-utils');
const { launchTarget } = require('./common/launcher');

const EXCLUDED_SEARCH_DIRECTORIES = new Set([
  '$recycle.bin',
  '.git',
  '.hg',
  '.svn',
  'appdata',
  'application data',
  'cache',
  'cookies',
  'local settings',
  'node_modules',
  'program files',
  'program files (x86)',
  'programdata',
  'system volume information',
  'windows'
]);

const FOLDER_SEARCH_LIMITS = Object.freeze({
  maxDepth: 7,
  maxDirectories: 2500,
  maxElapsedMs: 1200,
  maxResults: 40
});

const SEARCH_CACHE_TTL_MS = 5000;
const SEARCH_CACHE_LIMIT = 64;
const DEFAULT_MAX_WINDOWS_PATH_LENGTH = 260;

function uniquePaths(paths) {
  const seen = new Set();
  const result = [];
  for (const candidate of paths || []) {
    if (!candidate) continue;
    const resolved = path.resolve(candidate);
    const key = resolved.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(resolved);
  }
  return result;
}

function searchRoots() {
  return uniquePaths(getDefaultSearchRoots());
}

function hasSearchTimeRemaining(startedAt, maxElapsedMs) {
  return !Number.isFinite(maxElapsedMs) || maxElapsedMs <= 0 || Date.now() - startedAt < maxElapsedMs;
}

function cloneCacheValue(value) {
  if (Array.isArray(value)) {
    return [...value];
  }
  return JSON.parse(JSON.stringify(value));
}

function pathLocationLabel(folderPath) {
  const normalized = String(folderPath || '').toLowerCase();
  if (normalized.includes(`${path.sep}desktop${path.sep}`) || normalized.endsWith(`${path.sep}desktop`)) return 'Desktop';
  if (normalized.includes(`${path.sep}documents${path.sep}`) || normalized.endsWith(`${path.sep}documents`)) return 'Documents';
  if (normalized.includes(`${path.sep}downloads${path.sep}`) || normalized.endsWith(`${path.sep}downloads`)) return 'Downloads';
  if (normalized.includes(`${path.sep}pictures${path.sep}`) || normalized.endsWith(`${path.sep}pictures`)) return 'Pictures';
  if (normalized.includes(`${path.sep}music${path.sep}`) || normalized.endsWith(`${path.sep}music`)) return 'Music';
  if (normalized.includes(`${path.sep}videos${path.sep}`) || normalized.endsWith(`${path.sep}videos`)) return 'Videos';
  return path.dirname(folderPath);
}

class FolderController {
  constructor(config) {
    this.config = config || {};
    this.logger = new Logger(config?.logging || { level: 'info' });
    this.folderOptions = {
      allowLongPaths: Boolean(config?.folders?.allowLongPaths),
      maxPathLength: Number(config?.folders?.maxPathLength) || DEFAULT_MAX_WINDOWS_PATH_LENGTH
    };
    this._searchCache = new Map();
    this._matchCache = new Map();
  }

  _cacheKey(kind, parts = {}) {
    return `${kind}:${JSON.stringify(parts)}`;
  }

  _readCache(cache, key) {
    const entry = cache.get(key);
    if (!entry || Date.now() - entry.createdAt > SEARCH_CACHE_TTL_MS) {
      cache.delete(key);
      return null;
    }
    return cloneCacheValue(entry.value);
  }

  _rememberCache(cache, key, value) {
    cache.set(key, { createdAt: Date.now(), value: cloneCacheValue(value) });
    while (cache.size > SEARCH_CACHE_LIMIT) {
      cache.delete(cache.keys().next().value);
    }
    return value;
  }

  _clearSearchCaches() {
    this._searchCache.clear();
    this._matchCache.clear();
  }

  _normalizeFsError(error, fallback = 'Folder operation failed') {
    const code = error?.code || '';
    const message = String(error?.message || fallback);
    if (code === 'ENOENT') return 'Folder not found';
    if (code === 'EEXIST') return 'That folder already exists';
    if (code === 'EACCES' || code === 'EPERM') return 'Permission denied for that folder operation';
    if (code === 'ENAMETOOLONG') return 'That folder path is too long for this system';
    if (code === 'ENOSPC') return 'There is not enough disk space to complete that folder operation';
    if (code === 'EBUSY') return 'That folder is currently busy or locked by another app';
    if (/directory not empty/i.test(message)) return 'That folder could not be removed because it is still not empty';
    return message;
  }

  _failure(error, fallback, data = {}) {
    const message = typeof error === 'string'
      ? error
      : this._normalizeFsError(error, fallback);
    return {
      success: false,
      error: message,
      data: {
        ...data,
        controllerVerified: false,
        validationStatus: 'failed',
        verification: {
          status: 'failed',
          check: `folder-${data.operation || 'operation'}`,
          reason: message
        }
      }
    };
  }

  _validateWindowsFolderName(input, label = 'folder name') {
    return validateWindowsName(input, { label });
  }

  _validateFolderPathLength(candidate) {
    const validation = validateWindowsPathLength(candidate, this.folderOptions);
    return validation.valid ? validation : {
      ...validation,
      error: validation.error.replace(/^That path/, 'That folder path')
    };
  }

  _verifiedData(operation, folderPath, extra = {}) {
    const primaryPath = folderPath || extra.destination || extra.path || extra.source || '';
    if (['create', 'delete', 'move'].includes(operation)) {
      this._clearSearchCaches();
    }
    return {
      operation,
      controllerVerified: true,
      validationStatus: 'passed',
      verification: {
        status: 'passed',
        check: `folder-${operation}`,
        path: primaryPath || null
      },
      location: primaryPath ? pathLocationLabel(primaryPath) : null,
      responseVariantSeed: `${operation}:${primaryPath || extra.folderName || ''}:${Date.now()}`,
      ...extra
    };
  }

  search(query, options = {}) {
    const cleanQuery = this._cleanSearchQuery(query);
    if (!cleanQuery) {
      return { success: false, error: 'No folder search query provided' };
    }

    const cacheKey = this._cacheKey('search', {
      query: cleanQuery.toLowerCase(),
      maxDepth: options.maxDepth,
      maxDirectories: options.maxDirectories,
      maxElapsedMs: options.maxElapsedMs,
      maxResults: options.maxResults
    });
    const cached = this._readCache(this._searchCache, cacheKey);
    if (cached) {
      return cached;
    }

    const roots = searchRoots();
    const results = [];
    const visitedDirectories = new Set();
    const startedAt = Date.now();
    const maxResults = Number.isFinite(options.maxResults) ? options.maxResults : FOLDER_SEARCH_LIMITS.maxResults;
    const limits = {
      maxDepth: Number.isFinite(options.maxDepth) ? options.maxDepth : FOLDER_SEARCH_LIMITS.maxDepth,
      maxDirectories: Number.isFinite(options.maxDirectories) ? options.maxDirectories : FOLDER_SEARCH_LIMITS.maxDirectories,
      maxElapsedMs: Number.isFinite(options.maxElapsedMs) ? options.maxElapsedMs : FOLDER_SEARCH_LIMITS.maxElapsedMs,
      maxResults: Math.max(100, maxResults * 4),
      visitedDirectories,
      startedAt
    };

    for (const root of roots) {
      this._searchFoldersRecursive(root, cleanQuery.toLowerCase(), results, limits);
      if (!hasSearchTimeRemaining(startedAt, limits.maxElapsedMs) || results.length >= limits.maxResults) {
        break;
      }
    }

    const ranked = uniquePaths(results)
      .map(resultPath => ({
        path: resultPath,
        score: this._folderNameMatchScore(path.basename(resultPath), cleanQuery),
        depth: resultPath.split(path.sep).length
      }))
      .filter(entry => entry.score > 0)
      .sort((left, right) => right.score - left.score || left.depth - right.depth || left.path.localeCompare(right.path))
      .slice(0, Math.min(maxResults, 20));
    const partialByTime = !hasSearchTimeRemaining(startedAt, limits.maxElapsedMs);
    const partialByDirectory = visitedDirectories.size >= limits.maxDirectories;

    return this._rememberCache(this._searchCache, cacheKey, {
      success: true,
      data: {
        query: cleanQuery,
        results: ranked.map(entry => entry.path),
        entries: ranked.map(entry => ({
          name: path.basename(entry.path),
          type: 'folder',
          path: entry.path,
          location: pathLocationLabel(entry.path),
          matchScore: entry.score
        })),
        count: ranked.length,
        searchStats: {
          kind: 'folder.search',
          roots: roots.length,
          visitedDirectories: visitedDirectories.size,
          partial: partialByTime || partialByDirectory,
          partialReason: partialByTime ? 'time-budget' : partialByDirectory ? 'directory-limit' : null,
          elapsedMs: Date.now() - startedAt
        }
      }
    });
  }

  _resolveFolderPath(folderName, targetPath = null) {
    if (!folderName) return null;

    if (path.isAbsolute(folderName) && fs.existsSync(folderName) && fs.statSync(folderName).isDirectory()) {
      return requireSafeUserPath(folderName, { allowRoot: true });
    }

    const parsed = splitNameAndLocation(folderName);
    const requestedName = parsed.name || folderName;
    const explicitDirectory = targetPath || parsed.location;

    const specialFolders = getSpecialFolders();
    const asSpecialFolder = specialFolders[normalizeLocation(requestedName)];
    if (asSpecialFolder && fs.existsSync(asSpecialFolder)) {
      return asSpecialFolder;
    }

    const safeName = Validator.sanitizePath(requestedName);

    if (explicitDirectory) {
      const baseDir = resolveDirectory(explicitDirectory, { mustExist: true });
      if (!baseDir) return null;

      const candidate = path.join(baseDir, safeName);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }

      return null;
    }

    return findEntryByName(safeName, {
      roots: searchRoots(),
      type: 'directory'
    });
  }

  create(folderName, targetPath) {
    if (!folderName) {
      return { success: false, error: 'No folder name provided' };
    }

    const validation = this._validateWindowsFolderName(folderName);
    if (!validation.valid) {
      return this._failure(validation.error, 'Invalid folder name', {
        operation: 'create',
        folderName: String(folderName || '').trim()
      });
    }

    try {
      const dir = requireSafeUserPath(resolveDirectory(targetPath, { mustExist: false }) || getHomeDirectory(), { allowRoot: true });
      const fullPath = path.join(dir, validation.name);
      const pathValidation = this._validateFolderPathLength(fullPath);
      if (!pathValidation.valid) {
        return this._failure(pathValidation.error, pathValidation.error, {
          operation: 'create',
          path: fullPath,
          folderName: validation.name
        });
      }

      if (fs.existsSync(fullPath)) {
        return this._failure('Folder already exists', 'Folder already exists', {
          operation: 'create',
          path: fullPath,
          folderName: validation.name
        });
      }

      fs.mkdirSync(fullPath, { recursive: true });
      if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
        return this._failure('Could not verify that the folder was created', 'Could not verify folder creation', {
          operation: 'create',
          path: fullPath,
          folderName: validation.name
        });
      }

      return {
        success: true,
        data: this._verifiedData('create', fullPath, {
          path: fullPath,
          folderName: validation.name
        })
      };
    } catch (err) {
      this.logger.error('Failed to create folder', err);
      return this._failure(err, 'Failed to create folder', {
        operation: 'create',
        folderName: validation.name
      });
    }
  }

  delete(folderName, targetPath = null) {
    if (!folderName) {
      return { success: false, error: 'No folder name provided' };
    }

    try {
      const fullPath = this._resolveFolderPath(folderName, targetPath);
      if (!fullPath) {
        return { success: false, error: 'Folder not found' };
      }
      requireSafeUserPath(fullPath);

      const stats = fs.statSync(fullPath);
      if (!stats.isDirectory()) {
        return { success: false, error: 'Path is a file, use file operations' };
      }

      fs.rmSync(fullPath, { recursive: true, force: true });
      if (fs.existsSync(fullPath)) {
        return this._failure('Could not verify that the folder was deleted', 'Could not verify folder deletion', {
          operation: 'delete',
          path: fullPath,
          folderName: path.basename(fullPath)
        });
      }

      return {
        success: true,
        data: this._verifiedData('delete', fullPath, {
          path: fullPath,
          folderName: path.basename(fullPath)
        })
      };
    } catch (err) {
      this.logger.error('Failed to delete folder', err);
      return this._failure(err, 'Failed to delete folder', { operation: 'delete', folderName });
    }
  }

  move(source, destination) {
    if (!source || !destination) {
      return { success: false, error: 'Source and destination required' };
    }

    try {
      const sourcePath = this._resolveFolderPath(source);
      if (!sourcePath) {
        return { success: false, error: 'Source folder not found' };
      }
      requireSafeUserPath(sourcePath);

      const finalPath = resolveDestinationPath(destination, sourcePath, { type: 'directory' });
      if (!finalPath) {
        return { success: false, error: 'Destination could not be resolved' };
      }
      requireSafeUserPath(finalPath);
      const pathValidation = this._validateFolderPathLength(finalPath);
      if (!pathValidation.valid) {
        return this._failure(pathValidation.error, pathValidation.error, {
          operation: 'move',
          source: sourcePath,
          destination: finalPath
        });
      }

      if (path.resolve(sourcePath).toLowerCase() === path.resolve(finalPath).toLowerCase()) {
        return this._failure('Source and destination are the same folder', 'Invalid move destination', {
          operation: 'move',
          source: sourcePath,
          destination: finalPath
        });
      }

      if (path.resolve(finalPath).toLowerCase().startsWith(`${path.resolve(sourcePath).toLowerCase()}${path.sep}`)) {
        return this._failure('Cannot move a folder inside itself', 'Invalid move destination', {
          operation: 'move',
          source: sourcePath,
          destination: finalPath
        });
      }

      fs.mkdirSync(path.dirname(finalPath), { recursive: true });
      const overwroteExisting = fs.existsSync(finalPath);

      try {
        fs.renameSync(sourcePath, finalPath);
      } catch (err) {
        fs.cpSync(sourcePath, finalPath, { recursive: true, force: true });
        fs.rmSync(sourcePath, { recursive: true, force: true });
      }

      if (fs.existsSync(sourcePath) || !fs.existsSync(finalPath) || !fs.statSync(finalPath).isDirectory()) {
        return this._failure('Could not verify the folder move because the original folder is still there', 'Could not verify folder move', {
          operation: 'move',
          source: sourcePath,
          destination: finalPath
        });
      }

      return {
        success: true,
        data: this._verifiedData('move', finalPath, {
          source: sourcePath,
          destination: finalPath,
          folderName: path.basename(sourcePath),
          destinationName: path.basename(finalPath),
          overwroteExisting
        })
      };
    } catch (err) {
      this.logger.error('Failed to move folder', err);
      return this._failure(err, 'Failed to move folder', {
        operation: 'move',
        source,
        destination
      });
    }
  }

  open(folderName, options = {}) {
    if (!folderName) {
      return { success: false, error: 'No folder name provided' };
    }

    try {
      const selectedPath = options.selectedPath || options.targetPath;
      if (selectedPath && path.isAbsolute(selectedPath) && fs.existsSync(selectedPath) && fs.statSync(selectedPath).isDirectory()) {
        const safeSelectedPath = requireSafeUserPath(selectedPath, { allowRoot: true });
        this._openFolderPath(safeSelectedPath, options);
        return {
          success: true,
          data: this._verifiedData('open', safeSelectedPath, {
            path: safeSelectedPath,
            folderName: path.basename(safeSelectedPath),
            openWith: options.openWith || null
          })
        };
      }

      const matches = this._findFolderMatches(folderName);
      if (matches.length > 1) {
        const choices = matches.slice(0, 8).map((folderPath, index) => ({
          index: index + 1,
          title: `${path.basename(folderPath)} - ${folderPath}`,
          path: folderPath,
          entities: { selectedPath: folderPath }
        }));

        return {
          success: false,
          needsClarification: true,
          error: this._buildAmbiguousFolderMessage(folderName, choices),
          data: {
            clarificationType: 'folder.open',
            folderName,
            matchCount: matches.length,
            choices
          }
        };
      }

      if (matches.length === 1) {
        if (!this._shouldOpenSingleFolderMatch(folderName, matches[0], options)) {
          const choices = [{
            index: 1,
            title: `${path.basename(matches[0])} - ${matches[0]}`,
            path: matches[0],
            entities: { selectedPath: matches[0] }
          }];

          return {
            success: false,
            needsClarification: true,
            error: this._buildPossibleFolderMessage(folderName, choices[0]),
            data: {
              clarificationType: 'folder.open',
              folderName,
              matchCount: 1,
              choices
            }
          };
        }

        const matchedPath = requireSafeUserPath(matches[0], { allowRoot: true });
        this._openFolderPath(matchedPath, options);
        return {
          success: true,
          data: this._verifiedData('open', matchedPath, {
            path: matchedPath,
            folderName: path.basename(matchedPath),
            openWith: options.openWith || null
          })
        };
      }

      const fullPath = this._resolveFolderPath(folderName);
      if (!fullPath) {
        return { success: false, error: 'Folder not found' };
      }
      requireSafeUserPath(fullPath, { allowRoot: true });

      this._openFolderPath(fullPath, options);
      return {
        success: true,
        data: this._verifiedData('open', fullPath, {
          path: fullPath,
          folderName: path.basename(fullPath),
          openWith: options.openWith || null
        })
      };
    } catch (err) {
      this.logger.error('Failed to open folder', err);
      return this._failure(err, 'Failed to open folder', { operation: 'open', folderName });
    }
  }

  _openFolderPath(folderPath, options = {}) {
    const openWith = String(options.openWith || '').trim().toLowerCase();
    if (openWith === 'code' || openWith === 'vscode' || openWith === 'vs code') {
      launchTarget('code', [folderPath]);
      return;
    }

    launchTarget(folderPath);
  }

  _findFolderMatches(folderName) {
    if (!folderName) {
      return [];
    }

    if (path.isAbsolute(folderName) && fs.existsSync(folderName) && fs.statSync(folderName).isDirectory()) {
      return [requireSafeUserPath(folderName, { allowRoot: true })];
    }

    const parsed = splitNameAndLocation(folderName);
    const requestedName = parsed.name || folderName;
    if (parsed.location) {
      const resolved = this._resolveFolderPath(folderName);
      return resolved ? [resolved] : [];
    }

    const specialFolders = getSpecialFolders();
    const asSpecialFolder = specialFolders[normalizeLocation(requestedName)];
    if (asSpecialFolder && fs.existsSync(asSpecialFolder)) {
      return [asSpecialFolder];
    }

    const safeName = Validator.sanitizePath(requestedName);
    const cacheKey = this._cacheKey('matches', { name: safeName.toLowerCase() });
    const cached = this._readCache(this._matchCache, cacheKey);
    if (cached) {
      return cached;
    }

    const exactMatches = findEntriesByName(safeName, {
      roots: searchRoots(),
      type: 'directory',
      maxDepth: FOLDER_SEARCH_LIMITS.maxDepth,
      maxDirectories: FOLDER_SEARCH_LIMITS.maxDirectories,
      maxElapsedMs: FOLDER_SEARCH_LIMITS.maxElapsedMs,
      maxMatches: 12
    }) || [];
    if (exactMatches.length > 0) {
      return this._rememberCache(this._matchCache, cacheKey, exactMatches);
    }

    return this._rememberCache(this._matchCache, cacheKey, this._findFuzzyFolderMatches(safeName));
  }

  _findFuzzyFolderMatches(folderName) {
    const results = [];
    const roots = searchRoots();
    const lowerQuery = String(folderName || '').trim().toLowerCase();
    const visitedDirectories = new Set();

    for (const root of roots) {
      this._searchFoldersRecursive(root, lowerQuery, results, {
        ...FOLDER_SEARCH_LIMITS,
        maxResults: 100,
        visitedDirectories
      });
      if (results.length >= 12) {
        break;
      }
    }

    return uniquePaths(results)
      .map(resultPath => ({ path: resultPath, score: this._folderNameMatchScore(path.basename(resultPath), folderName) }))
      .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
      .slice(0, 12)
      .map(entry => entry.path);
  }

  _shouldOpenSingleFolderMatch(folderName, folderPath, options = {}) {
    if (!folderName || !folderPath) {
      return false;
    }

    const selectedPath = options.selectedPath || options.targetPath;
    if (selectedPath && path.resolve(selectedPath).toLowerCase() === path.resolve(folderPath).toLowerCase()) {
      return true;
    }

    if (path.isAbsolute(folderName) && path.resolve(folderName).toLowerCase() === path.resolve(folderPath).toLowerCase()) {
      return true;
    }

    const parsed = splitNameAndLocation(folderName);
    const requestedName = parsed.name || folderName;
    const explicitLocation = Boolean(parsed.location);
    const specialFolders = getSpecialFolders();
    if (specialFolders[normalizeLocation(requestedName)] === folderPath) {
      return true;
    }

    const score = this._folderNameMatchScore(path.basename(folderPath), requestedName);
    return score >= (explicitLocation ? 72 : 76);
  }

  _searchFoldersRecursive(root, lowerQuery, results, options = {}) {
    if (!root || !fs.existsSync(root) || results.length >= (options.maxResults || 12)) {
      return;
    }

    const queue = [{ directory: root, depth: 0 }];
    const visitedDirectories = options.visitedDirectories || new Set();
    const maxDepth = options.maxDepth ?? 6;
    const maxDirectories = options.maxDirectories ?? 1500;
    const maxElapsedMs = options.maxElapsedMs ?? FOLDER_SEARCH_LIMITS.maxElapsedMs;
    const startedAt = options.startedAt || Date.now();
    let visited = 0;

    for (
      let cursor = 0;
      cursor < queue.length && visited < maxDirectories && results.length < (options.maxResults || 12);
      cursor += 1
    ) {
      if (!hasSearchTimeRemaining(startedAt, maxElapsedMs)) {
        break;
      }

      const { directory, depth } = queue[cursor];
      const directoryKey = path.resolve(directory).toLowerCase();
      if (visitedDirectories.has(directoryKey)) {
        continue;
      }
      visitedDirectories.add(directoryKey);
      visited += 1;

      let entries = [];
      try {
        entries = fs.readdirSync(directory, { withFileTypes: true });
      } catch (err) {
        continue;
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const entryPath = path.join(directory, entry.name);
        if (!this._shouldDescendIntoDirectory(entry.name)) {
          continue;
        }
        if (this._folderNameMatchesQuery(entry.name, lowerQuery)) {
          results.push(entryPath);
          if (results.length >= (options.maxResults || 12)) {
            break;
          }
        }

        if (depth < maxDepth) {
          queue.push({ directory: entryPath, depth: depth + 1 });
        }
      }
    }
  }

  _shouldDescendIntoDirectory(name) {
    const normalized = String(name || '').trim().toLowerCase();
    return Boolean(normalized) &&
      !normalized.startsWith('.') &&
      !EXCLUDED_SEARCH_DIRECTORIES.has(normalized);
  }

  _folderNameMatchesQuery(entryName, lowerQuery) {
    return this._folderNameMatchScore(entryName, lowerQuery) > 0;
  }

  _folderNameMatchScore(entryName, lowerQuery) {
    const query = String(lowerQuery || '').trim().toLowerCase();
    const name = String(entryName || '').trim().toLowerCase();
    if (!query || !name) {
      return 0;
    }

    const normalizedName = Normalizer.normalizeText(name.replace(/[_-]+/g, ' '));
    const normalizedQuery = Normalizer.normalizeText(query.replace(/[_-]+/g, ' '));
    const compactName = normalizedName.replace(/\s+/g, '');
    const compactQuery = normalizedQuery.replace(/\s+/g, '');
    if (normalizedName === normalizedQuery) return 100;
    if (normalizedName.startsWith(normalizedQuery)) return 90;
    if (normalizedName.includes(normalizedQuery)) return 82;
    if (compactQuery.length >= 4 && compactName === compactQuery) return 88;
    if (compactQuery.length >= 4 && compactName.includes(compactQuery)) return 78;

    const nameTokens = normalizedName.split(/\s+/).filter(Boolean);
    const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
    const matchedTokens = queryTokens.filter(token => (
      nameTokens.some(nameToken => (
        nameToken.includes(token) ||
        (nameToken.length >= 4 && nameToken.length / token.length >= 0.6 && token.includes(nameToken))
      )) ||
      Normalizer.findClosestOption(token, nameTokens, {
        minSimilarity: token.length >= 7 ? 0.64 : 0.7,
        maxDistance: token.length >= 7 ? 3 : 2
      })
    )).length;
    if (queryTokens.length > 0 && matchedTokens === queryTokens.length) {
      return 60 + Math.round((matchedTokens / queryTokens.length) * 15);
    }
    if (queryTokens.length >= 3 && matchedTokens >= queryTokens.length - 1) {
      return 50 + matchedTokens;
    }

    return normalizedQuery.length >= 4 && Normalizer.findClosestOption(normalizedQuery, [normalizedName], {
      minSimilarity: normalizedQuery.length >= 8 ? 0.64 : 0.7,
      maxDistance: normalizedQuery.length >= 8 ? 3 : 2
    }) ? 55 : 0;
  }

  _cleanSearchQuery(query) {
    return String(query || '')
      .trim()
      .replace(/^(?:locate|find|search|serch|seach|searh|saerch|serach)(?:\s+for)?\s+/i, '')
      .replace(/^(?:look\s+for)\s+/i, '')
      .replace(/^(?:(?:the|a|an|my)\s+)?(?:folder|foldr|floder|foler|directory|diretory|dirctory)\s+/i, '')
      .replace(/^(?:the|a|an|my)\s+/i, '')
      .replace(/\s+(?:folder|foldr|floder|foler|directory|diretory|dirctory|location|path)$/i, '')
      .trim();
  }

  _buildAmbiguousFolderMessage(folderName, choices) {
    return `I found ${choices.length} matching folders for "${folderName}". Choose a number to open one.`;
  }

  _buildPossibleFolderMessage(folderName, choice) {
    return `I found one possible folder for "${folderName}": ${choice.title}. Choose 1 to open it.`;
  }
}

module.exports = FolderController;
