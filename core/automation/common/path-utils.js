const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const Normalizer = require('../../assistant/Data').Normalizer;

const DEFAULT_EXCLUDED_SEARCH_DIRECTORIES = new Set([
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

const PROTECTED_PATH_SEGMENTS = new Set([
  '$recycle.bin',
  'appdata',
  'application data',
  'local settings',
  'program files',
  'program files (x86)',
  'programdata',
  'system volume information',
  'windows'
]);

const WINDOWS_RESERVED_NAMES = new Set([
  'con',
  'conin$',
  'conout$',
  'prn',
  'aux',
  'nul',
  ...Array.from({ length: 10 }, (_, index) => `com${index}`),
  ...Array.from({ length: 10 }, (_, index) => `lpt${index}`)
]);

const WINDOWS_INVALID_NAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/;
const DEFAULT_MAX_WINDOWS_PATH_LENGTH = 260;
const WINDOWS_KNOWN_FOLDER_TIMEOUT_MS = 1500;
const OS_HOME_DIRECTORY = os.homedir();
const SPECIAL_FOLDER_NAMES = Object.freeze({
  desktop: 'Desktop',
  documents: 'Documents',
  downloads: 'Downloads',
  pictures: 'Pictures',
  music: 'Music',
  videos: 'Videos'
});

let specialFolderCacheKey = null;
let specialFolderCache = null;

function pathEquals(left, right) {
  if (!left || !right) return false;
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}

function cleanEntityName(value, options = {}) {
  const { stripTypeWords = false } = options;
  if (!value || typeof value !== 'string') return null;

  let result = value
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^(?:the|a|an)\s+/i, '');

  if (stripTypeWords) {
    result = result.replace(/^(?:file|folder|directory)\s+/i, '');
  }

  result = result
    .replace(/\s+(pdf|txt|docx?|xlsx?|pptx?|csv|json|xml|html?|js|ts|py|java|png|jpe?g|gif|webp|mp[34]|wav|zip|rar)$/i, '.$1')
    .trim();

  return result || null;
}

function getHomeDirectory() {
  return process.env.USERPROFILE || os.homedir();
}

function userProfileLooksOverridden() {
  const userProfile = process.env.USERPROFILE;
  const home = OS_HOME_DIRECTORY;
  return Boolean(userProfile && home && !pathEquals(userProfile, home));
}

function existingDirectoryOrNull(candidate) {
  if (!candidate) return null;
  try {
    return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()
      ? path.resolve(candidate)
      : null;
  } catch (error) {
    return null;
  }
}

function readWindowsKnownFolder(folderKey) {
  if (process.platform !== 'win32' || userProfileLooksOverridden()) {
    return null;
  }

  const specialFolderMap = {
    desktop: 'Desktop',
    documents: 'MyDocuments',
    pictures: 'MyPictures',
    music: 'MyMusic',
    videos: 'MyVideos'
  };

  const script = folderKey === 'downloads'
    ? [
        "$ErrorActionPreference = 'Stop'",
        "$value = (Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders').'{374DE290-123F-4565-9164-39C4925E467B}'",
        "if (-not $value) { $value = (Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Shell Folders').'{374DE290-123F-4565-9164-39C4925E467B}' }",
        "if ($value) { [Environment]::ExpandEnvironmentVariables($value) }"
      ].join('; ')
    : `Write-Output ([Environment]::GetFolderPath('${specialFolderMap[folderKey] || ''}'))`;

  if (!script || script.includes("''")) {
    return null;
  }

  try {
    const output = execFileSync('powershell.exe', [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script
    ], {
      encoding: 'utf8',
      timeout: WINDOWS_KNOWN_FOLDER_TIMEOUT_MS,
      windowsHide: true
    }).trim();
    return output || null;
  } catch (error) {
    return null;
  }
}

function oneDriveRoots() {
  if (userProfileLooksOverridden()) {
    return [];
  }
  return [
    process.env.OneDrive,
    process.env.OneDriveCommercial,
    process.env.OneDriveConsumer
  ].filter(Boolean);
}

function specialFolderFallbacks(folderKey) {
  const home = getHomeDirectory();
  const folderName = SPECIAL_FOLDER_NAMES[folderKey];
  if (!folderName) return [];

  const candidates = [path.join(home, folderName)];
  for (const oneDriveRoot of oneDriveRoots()) {
    candidates.push(path.join(oneDriveRoot, folderName));
  }
  return candidates;
}

function buildSpecialFolderMap() {
  const folders = { home: getHomeDirectory() };
  for (const folderKey of Object.keys(SPECIAL_FOLDER_NAMES)) {
    const fallbackCandidates = specialFolderFallbacks(folderKey);
    const existingFallback = fallbackCandidates.find(candidate => existingDirectoryOrNull(candidate));
    const candidates = dedupe([
      existingFallback,
      existingFallback ? null : readWindowsKnownFolder(folderKey),
      ...fallbackCandidates
    ]);
    folders[folderKey] =
      candidates.find(candidate => existingDirectoryOrNull(candidate)) ||
      candidates[0] ||
      path.join(getHomeDirectory(), SPECIAL_FOLDER_NAMES[folderKey]);
  }
  return folders;
}

function getSpecialFolders() {
  const cacheKey = [
    getHomeDirectory(),
    os.homedir(),
    process.env.OneDrive || '',
    process.env.OneDriveCommercial || '',
    process.env.OneDriveConsumer || ''
  ].join('|');
  if (specialFolderCache && specialFolderCacheKey === cacheKey) {
    return { ...specialFolderCache };
  }

  specialFolderCacheKey = cacheKey;
  specialFolderCache = buildSpecialFolderMap();
  return { ...specialFolderCache };
}

function getSpecialFolderPaths(folderKey) {
  const normalized = normalizeLocation(folderKey);
  if (normalized === 'home') {
    return dedupe([getHomeDirectory()]);
  }
  if (!SPECIAL_FOLDER_NAMES[normalized]) {
    return [];
  }
  const primary = getSpecialFolders()[normalized];
  const fallbackCandidates = specialFolderFallbacks(normalized);
  const existingCandidate = [primary, ...fallbackCandidates].find(candidate => existingDirectoryOrNull(candidate));
  return dedupe([
    primary,
    existingCandidate ? null : readWindowsKnownFolder(normalized),
    ...fallbackCandidates
  ]);
}

function getWorkingDirectorySearchRoot() {
  if (process.env.OPENX_INCLUDE_CWD_SEARCH !== '1') {
    return null;
  }

  const cwd = path.resolve(process.cwd());
  return isSafeUserPath(cwd, { allowRoot: true }) ? cwd : null;
}

function getDefaultSearchRoots() {
  return dedupe([
    getWorkingDirectorySearchRoot(),
    ...Object.keys(SPECIAL_FOLDER_NAMES).flatMap(folderKey => getSpecialFolderPaths(folderKey))
  ]);
}

function normalizeLocation(value) {
  if (!value || typeof value !== 'string') return '';

  return value
    .trim()
    .replace(/^(?:my|the)\s+/i, '')
    .replace(/\s+(?:folder|directory|path)$/i, '')
    .trim()
    .toLowerCase();
}

function dedupe(paths) {
  return Array.from(new Set(paths.filter(Boolean).map(candidate => path.resolve(candidate))));
}

function isUncPath(candidate) {
  return /^\\\\[^\\]+\\[^\\]+/.test(String(candidate || ''));
}

function pathKey(candidate) {
  return path.resolve(candidate).toLowerCase();
}

function isPathInside(parent, child) {
  const parentKey = pathKey(parent);
  const childKey = pathKey(child);
  return childKey === parentKey || childKey.startsWith(`${parentKey}${path.sep}`);
}

function nearestExistingPath(candidate) {
  let current = path.resolve(candidate);
  while (current && current !== path.dirname(current)) {
    if (fs.existsSync(current)) {
      return current;
    }
    current = path.dirname(current);
  }
  return fs.existsSync(current) ? current : null;
}

function realPathForSafety(candidate) {
  const existing = nearestExistingPath(candidate);
  if (!existing) return null;

  try {
    const realExisting = fs.realpathSync.native
      ? fs.realpathSync.native(existing)
      : fs.realpathSync(existing);
    const unresolvedTail = path.relative(existing, path.resolve(candidate));
    return unresolvedTail
      ? path.resolve(realExisting, unresolvedTail)
      : realExisting;
  } catch (error) {
    return null;
  }
}

function hasProtectedSegment(candidate, roots = []) {
  const resolved = path.resolve(candidate);
  const matchingRoot = roots.find(root => root && isPathInside(root, resolved));
  const relative = matchingRoot ? path.relative(matchingRoot, resolved) : resolved;
  const segments = relative
    .split(/[\\/]+/)
    .map(segment => segment.trim().toLowerCase())
    .filter(Boolean);
  return segments.some(segment => PROTECTED_PATH_SEGMENTS.has(segment));
}

function sanitizeWindowsName(value) {
  return String(value || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function validateWindowsName(input, options = {}) {
  const label = options.label || 'name';
  const raw = String(input || '').trim();
  if (!raw) {
    return { valid: false, error: `Invalid ${label}` };
  }
  if (raw.length > 255) {
    return { valid: false, error: `Invalid ${label}: Windows names cannot exceed 255 characters` };
  }
  if (WINDOWS_INVALID_NAME_CHARS.test(raw)) {
    return { valid: false, error: `Invalid ${label}: Windows names cannot contain < > : " / \\ | ? *` };
  }
  if (/[ .]$/.test(raw)) {
    return { valid: false, error: `Invalid ${label}: Windows names cannot end with a space or dot` };
  }

  const safeName = sanitizeWindowsName(raw);
  if (!safeName || safeName === '.' || safeName === '..') {
    return { valid: false, error: `Invalid ${label}` };
  }

  const baseName = path.basename(safeName, path.extname(safeName)).toLowerCase();
  if (WINDOWS_RESERVED_NAMES.has(baseName)) {
    return { valid: false, error: `Invalid ${label}: "${safeName}" is a reserved Windows device name` };
  }

  return { valid: true, name: safeName };
}

function validateWindowsPathLength(candidate, options = {}) {
  if (!candidate || options.allowLongPaths) {
    return { valid: true };
  }

  const maxPathLength = Number(options.maxPathLength) || DEFAULT_MAX_WINDOWS_PATH_LENGTH;
  if (path.resolve(candidate).length >= maxPathLength) {
    return {
      valid: false,
      error: 'That path is too long for the current Windows file configuration'
    };
  }

  return { valid: true };
}

function getSafeUserRoots() {
  return dedupe([
    getHomeDirectory(),
    ...Object.keys(SPECIAL_FOLDER_NAMES).flatMap(folderKey => getSpecialFolderPaths(folderKey))
  ]);
}

function pathSafety(candidate, options = {}) {
  if (!candidate || typeof candidate !== 'string') {
    return { safe: false, reason: 'Path is empty' };
  }
  if (/[\x00-\x1f\x7f]/.test(candidate)) {
    return { safe: false, reason: 'Path contains unsupported control characters' };
  }

  const resolved = path.resolve(candidate);
  const parsed = path.parse(resolved);
  const allowRoot = Boolean(options.allowRoot);
  if (isUncPath(candidate)) {
    return { safe: false, reason: 'Network paths are not allowed' };
  }
  if (!allowRoot && resolved.toLowerCase() === parsed.root.toLowerCase()) {
    return { safe: false, reason: 'Drive roots are not allowed' };
  }

  const roots = options.roots && options.roots.length > 0
    ? dedupe(options.roots)
    : getSafeUserRoots();
  const insideSafeRoot = roots.some(root => root && isPathInside(root, resolved));
  if (!insideSafeRoot) {
    return { safe: false, reason: 'Path is outside allowed user folders' };
  }

  const realResolved = realPathForSafety(resolved);
  if (realResolved) {
    const realRoots = roots.map(root => realPathForSafety(root) || path.resolve(root));
    const realInsideSafeRoot = realRoots.some(root => root && isPathInside(root, realResolved));
    if (!realInsideSafeRoot) {
      return { safe: false, reason: 'Path resolves outside allowed user folders' };
    }
  }

  if (hasProtectedSegment(resolved, roots)) {
    return { safe: false, reason: 'Protected system paths are not allowed' };
  }
  if (realResolved && hasProtectedSegment(realResolved, roots)) {
    return { safe: false, reason: 'Protected system paths are not allowed' };
  }

  return { safe: true, path: resolved };
}

function isSafeUserPath(candidate, options = {}) {
  return pathSafety(candidate, options).safe;
}

function requireSafeUserPath(candidate, options = {}) {
  const safety = pathSafety(candidate, options);
  if (!safety.safe) {
    throw new Error(safety.reason);
  }
  return safety.path;
}

function shouldDescendIntoSearchDirectory(name, options = {}) {
  const normalized = String(name || '').trim().toLowerCase();
  if (!normalized || normalized.startsWith('.')) {
    return false;
  }

  const excluded = options.excludedDirectories || DEFAULT_EXCLUDED_SEARCH_DIRECTORIES;
  return !excluded.has(normalized);
}

function hasSearchTimeRemaining(startedAt, maxElapsedMs) {
  return !Number.isFinite(maxElapsedMs) || maxElapsedMs <= 0 || Date.now() - startedAt < maxElapsedMs;
}

function resolveDirectory(location, options = {}) {
  const {
    baseDir = getHomeDirectory(),
    mustExist = false
  } = options;

  if (!location) {
    return mustExist || fs.existsSync(baseDir) ? path.resolve(baseDir) : null;
  }

  const raw = location.trim();
  const normalized = normalizeLocation(raw);
  const specialFolders = getSpecialFolders();

  if (specialFolders[normalized]) {
    const paths = getSpecialFolderPaths(normalized);
    const resolved = paths.find(candidate => !mustExist || existingDirectoryOrNull(candidate)) || specialFolders[normalized];
    return !mustExist || fs.existsSync(resolved) ? resolved : null;
  }

  const fuzzySpecialFolder = Normalizer.findClosestOption(normalized, Object.keys(specialFolders), {
    minSimilarity: 0.65,
    maxDistance: 2
  });
  if (fuzzySpecialFolder) {
    const paths = getSpecialFolderPaths(fuzzySpecialFolder.normalizedMatch);
    const resolved = paths.find(candidate => !mustExist || existingDirectoryOrNull(candidate)) ||
      specialFolders[fuzzySpecialFolder.normalizedMatch];
    return !mustExist || fs.existsSync(resolved) ? resolved : null;
  }

  const workingDirectoryRoot = getWorkingDirectorySearchRoot();
  const candidatePaths = dedupe([
    path.isAbsolute(raw) ? raw : null,
    path.resolve(baseDir, raw),
    workingDirectoryRoot ? path.resolve(workingDirectoryRoot, raw) : null,
    path.resolve(getHomeDirectory(), raw)
  ]).filter(candidate => isSafeUserPath(candidate, { allowRoot: true }));

  for (const candidate of candidatePaths) {
    if (!mustExist) {
      return candidate;
    }

    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }

  return null;
}

function splitNameAndLocation(value) {
  if (!value || typeof value !== 'string') {
    return { name: null, location: null };
  }

  const trimmed = value.trim();
  const match = trimmed.match(/^(.*?)(?:\s+(?:from|in|on|at)\s+(.+))?$/i);

  if (!match) {
    return { name: cleanEntityName(trimmed, { stripTypeWords: true }), location: null };
  }

  return {
    name: cleanEntityName(match[1], { stripTypeWords: true }),
    location: match[2] ? match[2].trim() : null
  };
}

function findEntryByName(name, options = {}) {
  const matches = findEntriesByName(name, options);
  return matches[0] || null;
}

function findEntriesByName(name, options = {}) {
  if (!name) return null;

  const {
    roots = [],
    type = 'file'
  } = options;

  const wantedDirectory = type === 'directory';
  const wantedName = name.toLowerCase();
  const maxMatches = options.maxMatches ?? 20;
  const maxElapsedMs = options.maxElapsedMs ?? 1200;
  const startedAt = Date.now();
  const matches = [];
  const candidateRoots = dedupe(roots.length > 0 ? roots : [
    ...getDefaultSearchRoots()
  ]);

  for (const root of candidateRoots) {
    if (!fs.existsSync(root)) continue;

    const candidate = path.join(root, name);
    if (!fs.existsSync(candidate)) continue;

    const stats = fs.statSync(candidate);
    if (wantedDirectory ? stats.isDirectory() : stats.isFile()) {
      matches.push(candidate);
      if (matches.length >= maxMatches) return dedupe(matches);
    }
  }

  const queue = candidateRoots
    .filter(root => fs.existsSync(root) && fs.statSync(root).isDirectory())
    .map(root => ({ directory: root, depth: 0 }));
  const maxDepth = options.maxDepth ?? 4;
  const maxDirectories = options.maxDirectories ?? 1500;
  const visited = new Set();
  let visitedDirectories = 0;

  for (
    let cursor = 0;
    cursor < queue.length &&
      visitedDirectories < maxDirectories &&
      hasSearchTimeRemaining(startedAt, maxElapsedMs);
    cursor += 1
  ) {
    const { directory, depth } = queue[cursor];
    const directoryKey = path.resolve(directory).toLowerCase();
    if (visited.has(directoryKey)) {
      continue;
    }
    visited.add(directoryKey);
    visitedDirectories += 1;

    let entries = [];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch (err) {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      const entryName = entry.name.toLowerCase();

      if (entryName === wantedName) {
        if (wantedDirectory ? entry.isDirectory() : entry.isFile()) {
          matches.push(entryPath);
          if (matches.length >= maxMatches) return dedupe(matches);
        }
      }

      if (
        depth < maxDepth &&
        entry.isDirectory() &&
        shouldDescendIntoSearchDirectory(entry.name, options)
      ) {
        queue.push({ directory: entryPath, depth: depth + 1 });
      }
    }
  }

  return dedupe(matches);
}

function resolveDestinationPath(destination, sourcePath, options = {}) {
  if (!destination || !sourcePath) return null;

  const {
    type = 'file'
  } = options;

  const raw = destination.trim();
  const absolute = path.isAbsolute(raw) ? path.resolve(raw) : null;
  const looksLikeFilePath = type === 'file' && path.extname(raw) !== '';

  if (absolute) {
    requireSafeUserPath(absolute);
    if (fs.existsSync(absolute) && fs.statSync(absolute).isDirectory()) {
      return path.join(absolute, path.basename(sourcePath));
    }
    return absolute;
  }

  const asDirectory = resolveDirectory(raw, { mustExist: true });
  if (asDirectory) {
    return path.join(asDirectory, path.basename(sourcePath));
  }

  if (looksLikeFilePath) {
    return requireSafeUserPath(path.resolve(raw));
  }

  const fallbackDirectory = resolveDirectory(raw, { mustExist: false });
  if (!fallbackDirectory) {
    return null;
  }

  return type === 'directory'
    ? fallbackDirectory
    : path.join(fallbackDirectory, path.basename(sourcePath));
}

module.exports = {
  findEntriesByName,
  findEntryByName,
  getDefaultSearchRoots,
  getHomeDirectory,
  getSafeUserRoots,
  getSpecialFolderPaths,
  getSpecialFolders,
  getWorkingDirectorySearchRoot,
  isSafeUserPath,
  normalizeLocation,
  pathSafety,
  requireSafeUserPath,
  resolveDestinationPath,
  resolveDirectory,
  sanitizeWindowsName,
  shouldDescendIntoSearchDirectory,
  splitNameAndLocation,
  validateWindowsName,
  validateWindowsPathLength,
  cleanEntityName
};
