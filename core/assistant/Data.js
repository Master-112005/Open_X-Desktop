const dataRootModule = (() => {
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const DATA_ROOT_NAME = 'OpenX_Data';
const LEGACY_DATA_ROOT_NAME = '.OpenX';
const JSON_BACKUP_SUFFIX = '.bak';
const DEFAULT_JSON_MAX_BYTES = 5 * 1024 * 1024;
const PRIVATE_FILE_MODE = 0o600;
const PRIVATE_DIRECTORY_MODE = 0o700;
const SECURE_JSON_FORMAT = 'OPENX_SECURE_JSON_V1';
const SECURE_JSON_ALGORITHM = 'aes-256-gcm';
const DATA_KEY_BYTES = 32;
const DATA_IV_BYTES = 12;
const DATA_TAG_BYTES = 16;
const securedDirectories = new Set();
const OS_HOME_DIRECTORY = os.homedir();
let documentsDirectoryCacheKey = null;
let documentsDirectoryCache = null;
const dataEncryptionKeys = new Map();

function pathEquals(left, right) {
  if (!left || !right) return false;
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}

function userProfileLooksOverridden() {
  const userProfile = process.env.USERPROFILE;
  return Boolean(userProfile && OS_HOME_DIRECTORY && !pathEquals(userProfile, OS_HOME_DIRECTORY));
}

function existingDirectory(candidate) {
  if (!candidate) return null;
  try {
    return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()
      ? path.resolve(candidate)
      : null;
  } catch (_) {
    return null;
  }
}

function readWindowsDocumentsDirectory() {
  if (process.platform !== 'win32' || userProfileLooksOverridden()) return null;
  try {
    const output = execFileSync('powershell.exe', [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      "Write-Output ([Environment]::GetFolderPath('MyDocuments'))"
    ], {
      encoding: 'utf8',
      timeout: 1200,
      windowsHide: true
    }).trim();
    return output || null;
  } catch (_) {
    return null;
  }
}

function resolveDocumentsDirectory() {
  const home = process.env.USERPROFILE || os.homedir();
  const cacheKey = [
    home,
    OS_HOME_DIRECTORY,
    process.env.OneDrive || '',
    process.env.OneDriveCommercial || '',
    process.env.OneDriveConsumer || ''
  ].join('|');
  if (documentsDirectoryCache && documentsDirectoryCacheKey === cacheKey) {
    return documentsDirectoryCache;
  }

  const fallbackCandidates = [
    path.join(home, 'Documents'),
    ...(userProfileLooksOverridden()
    ? []
    : [process.env.OneDrive, process.env.OneDriveCommercial, process.env.OneDriveConsumer]
        .filter(Boolean)
        .map(root => path.join(root, 'Documents')))
  ];
  const existingFallback = fallbackCandidates.find(candidate => existingDirectory(candidate));
  const candidates = [
    existingFallback,
    existingFallback ? null : readWindowsDocumentsDirectory(),
    ...fallbackCandidates
  ].filter(Boolean);
  documentsDirectoryCache =
    candidates.find(candidate => existingDirectory(candidate)) ||
    candidates[0] ||
    path.join(home, 'Documents');
  documentsDirectoryCacheKey = cacheKey;
  return documentsDirectoryCache;
}

function resolveDataRoot(config = {}) {
  const configured = String(config?.app?.dataDir || process.env.OPENX_DATA_DIR || '').trim();
  return path.resolve(configured || path.join(os.homedir(), DATA_ROOT_NAME));
}

function resolveLegacyDataRoot(config = {}) {
  const configured = String(config?.app?.legacyDataDir || '').trim();
  return path.resolve(configured || path.join(os.homedir(), LEGACY_DATA_ROOT_NAME));
}

function buildDataPaths(config = {}) {
  const root = resolveDataRoot(config);
  const runtimeDir = path.join(root, 'runtime');
  const voiceDir = path.join(root, 'voice');
  const cloudDir = path.join(root, 'cloud');
  const securityDir = path.join(root, 'security');
  const visualMemoryDir = path.join(root, 'visual-memory');
  const personalDir = path.join(root, 'personal');
  const homeLearningDir = path.join(root, 'home-learning');
  const configuredReceivedDir = String(config?.app?.cloudReceivedDir || process.env.OPENX_RECEIVED_FILES_DIR || '').trim();
  const cloudReceivedDir = path.resolve(configuredReceivedDir || path.join(resolveDocumentsDirectory(), 'OpenX'));

  return {
    root,
    settingsPath: path.join(root, 'settings.json'),
    assistantChatHistoryPath: path.join(root, 'assistant-chat-history.json'),
    chatAccountPath: path.join(root, 'chat-account.json'),
    chatDevicePath: path.join(root, 'chat-device.json'),
    chatConversationsPath: path.join(root, 'chat-conversations.json'),
    chatMessagesPath: path.join(root, 'chat-messages.json'),
    chatMailboxSequencesPath: path.join(root, 'chat-mailbox-sequences.json'),
    chatSyncCursorsPath: path.join(root, 'chat-sync-cursors.json'),
    chatHistorySyncPath: path.join(root, 'chat-history-sync.json'),
    chatMultiDevicePath: path.join(root, 'chat-multi-device.json'),
    chatFileTransfersPath: path.join(root, 'chat-file-transfers.json'),
    chatCryptoSecretsPath: path.join(root, 'chat-crypto-secrets.json'),
    chatRequestNicknamesPath: path.join(root, 'chat-request-nicknames.json'),
    uiStatePath: path.join(root, 'ui-state.json'),
    learningPath: path.join(root, 'learning.json'),
    schedulesPath: path.join(root, 'schedules.json'),
    plannerPath: path.join(root, 'planner.json'),
    screenshotsDir: path.join(root, 'screenshots'),
    learningDir: path.join(root, 'learning'),
    learningAliasesPath: path.join(root, 'learning', 'aliases.json'),
    learningPreferencesPath: path.join(root, 'learning', 'preferences.json'),
    learningCorrectionsPath: path.join(root, 'learning', 'corrections.json'),
    learningWorkflowsPath: path.join(root, 'learning', 'workflows.json'),
    learningUsageStatsPath: path.join(root, 'learning', 'usage_stats.json'),
    personalDir,
    personalVaultPath: path.join(personalDir, 'personal-vault.db'),
    personalVaultKeyPath: path.join(personalDir, 'personal-vault.key'),
    homeLearningDir,
    homeLearningDatabasePath: path.join(homeLearningDir, 'home-learning.db'),
    homeLearningDeviceRegistryPath: path.join(homeLearningDir, 'devices.json'),
    homeLearningPatternPath: path.join(homeLearningDir, 'patterns.json'),
    homeLearningSequencePath: path.join(homeLearningDir, 'sequences.json'),
    routineLearningDir: path.join(root, 'learning', 'routines'),
    routineObservationPath: path.join(root, 'learning', 'routines', 'observations.jsonl'),
    routineSummaryPath: path.join(root, 'learning', 'routines', 'summaries.json'),
    logsDir: path.join(root, 'logs'),
    runtimeDir,
    electronProfileDir: path.join(runtimeDir, 'electron-profile'),
    cacheDir: path.join(root, 'cache'),
    mediaProfileDir: path.join(runtimeDir, 'chrome-media-profile'),
    voiceDir,
    voiceDiagnosticsDir: path.join(voiceDir, 'diagnostics'),
    cloudDir,
    cloudLogPath: path.join(cloudDir, 'connection.log'),
    cloudReceivedDir,
    cloudTempDir: path.join(runtimeDir, 'cloud-transfer'),
    securityDir,
    dataEncryptionKeyPath: path.join(securityDir, 'openx-data.key'),
    visualMemoryDir,
    visualMemoryDatabasePath: path.join(visualMemoryDir, 'visual-memory-db.json'),
    visualMemoryThumbnailDir: path.join(visualMemoryDir, 'thumbnails')
  };
}

function ensureDirectory(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
  const resolved = path.resolve(dir);
  if (!securedDirectories.has(resolved)) {
    try { fs.chmodSync(resolved, PRIVATE_DIRECTORY_MODE); } catch (_) {}
    securedDirectories.add(resolved);
  }
}

function timestampForFilename(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function safeBackupPath(filePath) {
  return `${filePath}${JSON_BACKUP_SUFFIX}`;
}

function cloneJsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function isSecureJsonEnvelope(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    value.format === SECURE_JSON_FORMAT &&
    value.algorithm === SECURE_JSON_ALGORITHM &&
    typeof value.iv === 'string' &&
    typeof value.tag === 'string' &&
    typeof value.ciphertext === 'string'
  );
}

function inferManagedRootFromPath(filePath) {
  const basename = path.basename(filePath).toLowerCase();
  if ([
    'learning.json',
    'assistant-chat-history.json',
    'settings.json',
    'schedules.json',
    'planner.json',
    'chat-account.json',
    'chat-device.json',
    'chat-conversations.json',
    'chat-messages.json',
    'chat-mailbox-sequences.json',
    'chat-sync-cursors.json',
    'chat-history-sync.json',
    'chat-multi-device.json',
    'chat-file-transfers.json',
    'chat-crypto-secrets.json',
    'chat-request-nicknames.json',
    'ui-state.json',
    'crash-recovery.json'
  ].includes(basename)) {
    return path.dirname(path.resolve(filePath));
  }

  let current = path.resolve(path.dirname(filePath));
  while (current && current !== path.dirname(current)) {
    const name = path.basename(current).toLowerCase();
    if (['learning', 'home-learning', 'personal', 'runtime', 'cloud', 'voice', 'security', 'visual-memory'].includes(name)) {
      return path.dirname(current);
    }
    current = path.dirname(current);
  }
  return null;
}

function resolveDataEncryptionKeyPath(config = {}, options = {}) {
  const configured = String(
    options.keyPath ||
    config?.security?.dataEncryptionKeyPath ||
    process.env.OPENX_DATA_ENCRYPTION_KEY_PATH ||
    ''
  ).trim();
  if (configured) return path.resolve(configured);

  const inferredRoot = options.filePath ? inferManagedRootFromPath(options.filePath) : null;
  if (inferredRoot) return path.join(inferredRoot, 'security', 'openx-data.key');

  return buildDataPaths(config).dataEncryptionKeyPath;
}

function readOrCreateDataEncryptionKey(config = {}, options = {}) {
  const keyPath = resolveDataEncryptionKeyPath(config, options);
  const cacheKey = path.resolve(keyPath).toLowerCase();
  if (dataEncryptionKeys.has(cacheKey)) return dataEncryptionKeys.get(cacheKey);

  ensureDirectory(path.dirname(keyPath));
  if (fs.existsSync(keyPath)) {
    const existing = Buffer.from(fs.readFileSync(keyPath, 'utf8').trim(), 'base64');
    if (existing.length === DATA_KEY_BYTES) {
      dataEncryptionKeys.set(cacheKey, existing);
      try { fs.chmodSync(keyPath, PRIVATE_FILE_MODE); } catch (_) {}
      return existing;
    }
  }

  const generated = crypto.randomBytes(DATA_KEY_BYTES);
  writeFileAtomic(keyPath, `${generated.toString('base64')}\n`);
  dataEncryptionKeys.set(cacheKey, generated);
  return generated;
}

function secureJsonAad() {
  return Buffer.from(SECURE_JSON_FORMAT, 'utf8');
}

function encryptDataPayload(value, options = {}) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new TypeError('Value is not JSON serializable');
  const key = readOrCreateDataEncryptionKey(options.config || {}, options);
  const iv = crypto.randomBytes(DATA_IV_BYTES);
  const cipher = crypto.createCipheriv(SECURE_JSON_ALGORITHM, key, iv);
  cipher.setAAD(secureJsonAad());
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(serialized, 'utf8')),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return {
    format: SECURE_JSON_FORMAT,
    version: 1,
    protected: true,
    algorithm: SECURE_JSON_ALGORITHM,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    createdAt: new Date().toISOString()
  };
}

function decryptDataPayload(payload, options = {}) {
  if (!isSecureJsonEnvelope(payload)) {
    throw new Error('Unsupported secure JSON payload');
  }
  const key = readOrCreateDataEncryptionKey(options.config || {}, options);
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');
  if (iv.length !== DATA_IV_BYTES || tag.length !== DATA_TAG_BYTES) {
    throw new Error('Invalid secure JSON payload');
  }
  const decipher = crypto.createDecipheriv(SECURE_JSON_ALGORITHM, key, iv);
  decipher.setAAD(secureJsonAad());
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext);
}

function parseJsonPath(sourcePath, options = {}) {
  const maxBytes = Number(options.maxBytes) > 0 ? Number(options.maxBytes) : DEFAULT_JSON_MAX_BYTES;
  const stats = fs.statSync(sourcePath);
  const maxStoredBytes = Math.max(maxBytes * 2, maxBytes + 4096);
  if (!stats.isFile() || stats.size > maxStoredBytes) {
    throw new Error('JSON file is invalid or exceeds its size limit');
  }
  const source = fs.readFileSync(sourcePath, 'utf8').trim();
  if (!source) throw new Error('JSON file is empty');
  const parsed = JSON.parse(source);
  if (isSecureJsonEnvelope(parsed)) {
    return {
      value: decryptDataPayload(parsed, {
        config: options.config || {},
        keyPath: options.keyPath,
        filePath: sourcePath
      }),
      protected: true
    };
  }
  return { value: parsed, protected: false };
}

function writeFileAtomic(filePath, content) {
  ensureDirectory(path.dirname(filePath));
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`
  );

  let fd = null;
  try {
    fd = fs.openSync(tempPath, 'wx', PRIVATE_FILE_MODE);
    fs.writeFileSync(fd, content, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(tempPath, filePath);
    try { fs.chmodSync(filePath, PRIVATE_FILE_MODE); } catch (_) {}
  } catch (err) {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch (_) {
        // Best effort cleanup below handles the temp file.
      }
    }
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch (_) {
      // Leave cleanup to the next maintenance pass if Windows still holds it.
    }
    throw err;
  }
}

function writeJsonAtomic(filePath, value, options = {}) {
  const spacing = Number.isInteger(options.spacing) ? options.spacing : 2;
  const backup = options.backup !== false;
  const maxBytes = Number(options.maxBytes) > 0 ? Number(options.maxBytes) : DEFAULT_JSON_MAX_BYTES;
  const json = JSON.stringify(value, null, spacing);
  if (json === undefined) throw new TypeError('Value is not JSON serializable');
  const serialized = `${json}\n`;
  if (Buffer.byteLength(serialized, 'utf8') > maxBytes) {
    throw new Error(`JSON data exceeds the ${maxBytes} byte limit`);
  }
  ensureDirectory(path.dirname(filePath));

  if (backup && fs.existsSync(filePath)) {
    const backupPath = safeBackupPath(filePath);
    fs.copyFileSync(filePath, backupPath);
    try { fs.chmodSync(backupPath, PRIVATE_FILE_MODE); } catch (_) {}
  }

  writeFileAtomic(filePath, serialized);
}

function readJsonFile(filePath, fallbackValue = {}, options = {}) {
  const fallback = typeof fallbackValue === 'function' ? fallbackValue() : fallbackValue;
  const backupPath = safeBackupPath(filePath);
  const preserveCorrupt = options.preserveCorrupt !== false;
  const maxBytes = Number(options.maxBytes) > 0 ? Number(options.maxBytes) : DEFAULT_JSON_MAX_BYTES;
  const validate = typeof options.validate === 'function' ? options.validate : () => true;

  const parsePath = sourcePath => {
    const stats = fs.statSync(sourcePath);
    if (!stats.isFile() || stats.size > maxBytes) {
      throw new Error('JSON file is invalid or exceeds its size limit');
    }
    const source = fs.readFileSync(sourcePath, 'utf8').trim();
    if (!source) {
      throw new Error('JSON file is empty');
    }
    const parsed = JSON.parse(source);
    if (!validate(parsed)) throw new Error('JSON schema validation failed');
    return parsed;
  };

  if (!fs.existsSync(filePath)) {
    if (options.createIfMissing !== false) {
      writeJsonAtomic(filePath, fallback, { backup: false, spacing: options.spacing, maxBytes });
    }
    return fallback;
  }

  try {
    return parsePath(filePath);
  } catch (primaryError) {
    if (preserveCorrupt) {
      const corruptPath = `${filePath}.corrupt-${timestampForFilename()}`;
      try {
        fs.renameSync(filePath, corruptPath);
      } catch (_) {
        // If the file is locked, keep going and try the backup.
      }
    }

    if (fs.existsSync(backupPath)) {
      try {
        const recovered = parsePath(backupPath);
        writeJsonAtomic(filePath, recovered, { backup: false, spacing: options.spacing, maxBytes });
        return recovered;
      } catch (_) {
        // Fall through to a clean fallback file.
      }
    }

    writeJsonAtomic(filePath, fallback, { backup: false, spacing: options.spacing, maxBytes });
    return fallback;
  }
}

function quarantineSecureFile(sourcePath, corruptPath, options = {}) {
  try {
    const raw = fs.readFileSync(sourcePath, 'utf8');
    writeSecureJsonAtomic(corruptPath, {
      format: 'OPENX_CORRUPT_DATA_V1',
      capturedAt: new Date().toISOString(),
      originalName: path.basename(sourcePath),
      raw
    }, {
      backup: false,
      spacing: options.spacing,
      maxBytes: Math.max(Number(options.maxBytes) || DEFAULT_JSON_MAX_BYTES, Buffer.byteLength(raw, 'utf8') + 4096),
      config: options.config || {},
      keyPath: options.keyPath
    });
    fs.unlinkSync(sourcePath);
    return true;
  } catch (_) {
    try {
      fs.renameSync(sourcePath, corruptPath);
      try { fs.chmodSync(corruptPath, PRIVATE_FILE_MODE); } catch (_) {}
      return true;
    } catch (_) {
      return false;
    }
  }
}

function writeSecureJsonAtomic(filePath, value, options = {}) {
  const spacing = Number.isInteger(options.spacing) ? options.spacing : 2;
  const backup = options.backup !== false;
  const maxBytes = Number(options.maxBytes) > 0 ? Number(options.maxBytes) : DEFAULT_JSON_MAX_BYTES;
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new TypeError('Value is not JSON serializable');
  if (Buffer.byteLength(serialized, 'utf8') > maxBytes) {
    throw new Error(`JSON data exceeds the ${maxBytes} byte limit`);
  }
  ensureDirectory(path.dirname(filePath));

  if (backup && fs.existsSync(filePath)) {
    const backupPath = safeBackupPath(filePath);
    fs.copyFileSync(filePath, backupPath);
    try { fs.chmodSync(backupPath, PRIVATE_FILE_MODE); } catch (_) {}
  }

  const envelope = encryptDataPayload(value, {
    config: options.config || {},
    keyPath: options.keyPath,
    filePath
  });
  const content = `${JSON.stringify(envelope, null, spacing)}\n`;
  writeFileAtomic(filePath, content);
}

function readSecureJsonFile(filePath, fallbackValue = {}, options = {}) {
  const makeFallback = () => cloneJsonValue(
    typeof fallbackValue === 'function' ? fallbackValue() : fallbackValue
  );
  const backupPath = safeBackupPath(filePath);
  const preserveCorrupt = options.preserveCorrupt !== false;
  const maxBytes = Number(options.maxBytes) > 0 ? Number(options.maxBytes) : DEFAULT_JSON_MAX_BYTES;
  const validate = typeof options.validate === 'function' ? options.validate : () => true;
  const keyPath = options.keyPath || resolveDataEncryptionKeyPath(options.config || {}, { filePath });

  const parseAndValidate = sourcePath => {
    const parsed = parseJsonPath(sourcePath, {
      config: options.config || {},
      keyPath,
      filePath,
      maxBytes
    });
    if (!validate(parsed.value)) throw new Error('JSON schema validation failed');
    return parsed;
  };

  if (!fs.existsSync(filePath)) {
    const fallback = makeFallback();
    if (options.createIfMissing !== false) {
      writeSecureJsonAtomic(filePath, fallback, {
        backup: false,
        spacing: options.spacing,
        maxBytes,
        config: options.config || {},
        keyPath
      });
    }
    return fallback;
  }

  try {
    const parsed = parseAndValidate(filePath);
    if (!parsed.protected && options.migratePlaintext !== false) {
      writeSecureJsonAtomic(filePath, parsed.value, {
        backup: false,
        spacing: options.spacing,
        maxBytes,
        config: options.config || {},
        keyPath
      });
    }
    return parsed.value;
  } catch (_) {
    if (preserveCorrupt) {
      const corruptPath = `${filePath}.corrupt-${timestampForFilename()}`;
      quarantineSecureFile(filePath, corruptPath, {
        spacing: options.spacing,
        maxBytes,
        config: options.config || {},
        keyPath
      });
    }

    if (fs.existsSync(backupPath)) {
      try {
        const recoveredParsed = parseAndValidate(backupPath);
        const recovered = recoveredParsed.value;
        writeSecureJsonAtomic(filePath, recovered, {
          backup: false,
          spacing: options.spacing,
          maxBytes,
          config: options.config || {},
          keyPath
        });
        if (!recoveredParsed.protected) {
          writeSecureJsonAtomic(backupPath, recovered, {
            backup: false,
            spacing: options.spacing,
            maxBytes,
            config: options.config || {},
            keyPath
          });
        }
        return recovered;
      } catch (_) {
        // Fall through to a clean encrypted fallback file.
      }
    }

    const fallback = makeFallback();
    writeSecureJsonAtomic(filePath, fallback, {
      backup: false,
      spacing: options.spacing,
      maxBytes,
      config: options.config || {},
      keyPath
    });
    return fallback;
  }
}

function appendSecureJsonLine(filePath, value, options = {}) {
  ensureDirectory(path.dirname(filePath));
  const envelope = encryptDataPayload(value, {
    config: options.config || {},
    keyPath: options.keyPath,
    filePath
  });
  const content = `${JSON.stringify(envelope).replace(/\r?\n/g, ' ')}\n`;
  const maxBytes = Number(options.maxBytes) > 0 ? Number(options.maxBytes) : DEFAULT_JSON_MAX_BYTES;
  if (Buffer.byteLength(content, 'utf8') > Math.max(maxBytes * 2, maxBytes + 4096)) {
    throw new Error(`JSON line exceeds the ${maxBytes} byte limit`);
  }
  fs.appendFileSync(filePath, content, { mode: PRIVATE_FILE_MODE });
  try { fs.chmodSync(filePath, PRIVATE_FILE_MODE); } catch (_) {}
}

function readSecureJsonLines(filePath, options = {}) {
  if (!fs.existsSync(filePath)) return [];
  const maxBytes = Number(options.maxBytes) > 0 ? Number(options.maxBytes) : DEFAULT_JSON_MAX_BYTES * 20;
  const stats = fs.statSync(filePath);
  if (!stats.isFile() || stats.size > maxBytes) {
    throw new Error('JSONL file is invalid or exceeds its size limit');
  }
  const validate = typeof options.validate === 'function' ? options.validate : () => true;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  const values = [];
  let sawPlaintext = false;
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      const value = isSecureJsonEnvelope(parsed)
        ? decryptDataPayload(parsed, {
            config: options.config || {},
            keyPath: options.keyPath,
            filePath
          })
        : parsed;
      if (!isSecureJsonEnvelope(parsed)) sawPlaintext = true;
      if (validate(value)) values.push(value);
    } catch (_) {
      // Ignore bad event lines; callers handle missing observations as no-op.
    }
  }
  if (sawPlaintext && options.migratePlaintext !== false) {
    const content = values
      .map(value => JSON.stringify(encryptDataPayload(value, {
        config: options.config || {},
        keyPath: options.keyPath,
        filePath
      })))
      .join('\n');
    writeFileAtomic(filePath, content ? `${content}\n` : '');
  }
  return values;
}

function purgeDeprecatedContactStorage(root) {
  const sourceRoot = String(root || '').trim();
  if (!sourceRoot) return [];
  const resolvedRoot = path.resolve(sourceRoot);
  if (!fs.existsSync(resolvedRoot)) return [];

  const removed = [];
  for (const name of fs.readdirSync(resolvedRoot)) {
    if (!/^contacts\.json(?:\.bak|\.corrupt-.+)?$|^\.contacts\.json\..+\.tmp$/i.test(name)) continue;
    const target = path.resolve(resolvedRoot, name);
    if (path.dirname(target) !== resolvedRoot) continue;
    fs.unlinkSync(target);
    removed.push(target);
  }
  return removed;
}

function legacyQuarantinePath(paths, label) {
  const safeLabel = String(label || 'legacy-data')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'legacy-data';
  return path.join(paths.runtimeDir, 'legacy-data', `${safeLabel}-${timestampForFilename()}`);
}

function moveDirectoryIntoManagedData(sourcePath, targetPath) {
  const resolvedSource = path.resolve(sourcePath);
  const resolvedTarget = path.resolve(targetPath);
  if (!fs.existsSync(resolvedSource) || resolvedSource === resolvedTarget) {
    return { moved: false, reason: 'missing-or-same-path' };
  }
  if (resolvedTarget.startsWith(`${resolvedSource}${path.sep}`)) {
    return {
      moved: false,
      sourcePath: resolvedSource,
      targetPath: resolvedTarget,
      reason: 'target-inside-source'
    };
  }

  ensureDirectory(path.dirname(resolvedTarget));
  try {
    fs.renameSync(resolvedSource, resolvedTarget);
    return { moved: true, sourcePath: resolvedSource, targetPath: resolvedTarget };
  } catch (renameError) {
    try {
      fs.cpSync(resolvedSource, resolvedTarget, { recursive: true, errorOnExist: false, force: true });
      fs.rmSync(resolvedSource, { recursive: true, force: true });
      return { moved: true, sourcePath: resolvedSource, targetPath: resolvedTarget, fallback: 'copy-remove' };
    } catch (copyError) {
      return {
        moved: false,
        sourcePath: resolvedSource,
        targetPath: resolvedTarget,
        reason: 'move-failed',
        error: copyError.message || renameError.message
      };
    }
  }
}

function ensureDataRoot(config = {}) {
  const paths = buildDataPaths(config);
  [
    paths.root,
    paths.logsDir,
    paths.learningDir,
    paths.runtimeDir,
    paths.electronProfileDir,
    paths.cacheDir,
    paths.mediaProfileDir,
    paths.screenshotsDir,
    paths.voiceDir,
    paths.voiceDiagnosticsDir,
    paths.cloudDir,
    paths.cloudReceivedDir,
    paths.cloudTempDir,
    paths.securityDir,
    paths.personalDir,
    paths.homeLearningDir,
    paths.visualMemoryDir,
    paths.visualMemoryThumbnailDir
  ].forEach(ensureDirectory);
  purgeDeprecatedContactStorage(paths.root);
  return paths;
}

function copyFileIfMissing(sourcePath, targetPath, migrated, skipped) {
  if (!fs.existsSync(sourcePath)) {
    skipped.push({ sourcePath, reason: 'missing-source' });
    return;
  }

  if (fs.existsSync(targetPath)) {
    skipped.push({ sourcePath, targetPath, reason: 'target-exists' });
    return;
  }

  ensureDirectory(path.dirname(targetPath));
  const content = fs.readFileSync(sourcePath, 'utf8');
  try {
    writeSecureJsonAtomic(targetPath, JSON.parse(content), { backup: false });
  } catch (_) {
    writeFileAtomic(targetPath, content);
  }
  migrated.push({ sourcePath, targetPath });
}

function migrateJsonArrayFile(sourcePath, targetPath, options = {}) {
  const migrated = [];
  const skipped = [];
  const resolvedSource = path.resolve(sourcePath);
  const resolvedTarget = path.resolve(targetPath);
  const removeSource = options.removeSource !== false;
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 1000;
  const normalizeItem = typeof options.normalizeItem === 'function' ? options.normalizeItem : item => item;

  if (resolvedSource === resolvedTarget) {
    skipped.push({ sourcePath: resolvedSource, targetPath: resolvedTarget, reason: 'same-path' });
    return { migrated, skipped, targetPath: resolvedTarget };
  }

  if (!fs.existsSync(resolvedSource)) {
    skipped.push({ sourcePath: resolvedSource, reason: 'missing-source' });
    return { migrated, skipped, targetPath: resolvedTarget };
  }

  const sourceItems = readJsonFile(resolvedSource, [], {
    createIfMissing: false,
    validate: value => Array.isArray(value)
  });
  const targetItems = readSecureJsonFile(resolvedTarget, [], {
    createIfMissing: false,
    validate: value => Array.isArray(value)
  });
  const merged = [...targetItems, ...sourceItems]
    .map(normalizeItem)
    .filter(Boolean)
    .slice(-limit);
  writeSecureJsonAtomic(resolvedTarget, merged, { backup: true });
  if (removeSource) {
    try {
      fs.unlinkSync(resolvedSource);
    } catch (error) {
      skipped.push({ sourcePath: resolvedSource, reason: 'remove-failed', error: error.message });
    }
  }
  migrated.push({ sourcePath: resolvedSource, targetPath: resolvedTarget, count: sourceItems.length });
  return { migrated, skipped, targetPath: resolvedTarget };
}

function migrateLegacyData(config = {}) {
  const paths = ensureDataRoot(config);
  const legacyRoot = resolveLegacyDataRoot(config);
  const migrated = [];
  const skipped = [];

  if (path.resolve(legacyRoot) === path.resolve(paths.root)) {
    return { dataRoot: paths.root, legacyRoot, migrated, skipped };
  }

  if (!fs.existsSync(legacyRoot)) {
    return { dataRoot: paths.root, legacyRoot, migrated, skipped };
  }

  purgeDeprecatedContactStorage(legacyRoot);

  copyFileIfMissing(path.join(legacyRoot, 'settings.json'), paths.settingsPath, migrated, skipped);
  copyFileIfMissing(path.join(legacyRoot, 'assistant-chat-history.json'), paths.assistantChatHistoryPath, migrated, skipped);
  copyFileIfMissing(path.join(legacyRoot, 'chat-history.json'), paths.assistantChatHistoryPath, migrated, skipped);
  copyFileIfMissing(path.join(legacyRoot, 'ui-state.json'), paths.uiStatePath, migrated, skipped);
  copyFileIfMissing(path.join(legacyRoot, 'learning.json'), paths.learningPath, migrated, skipped);
  copyFileIfMissing(path.join(legacyRoot, 'schedules.json'), paths.schedulesPath, migrated, skipped);
  copyFileIfMissing(path.join(legacyRoot, 'planner.json'), paths.plannerPath, migrated, skipped);

  const quarantine = moveDirectoryIntoManagedData(
    legacyRoot,
    legacyQuarantinePath(paths, path.basename(legacyRoot) || 'legacy-assistant-data')
  );
  if (quarantine.moved) {
    migrated.push({ ...quarantine, reason: 'legacy-root-quarantined' });
  } else if (quarantine.reason !== 'missing-or-same-path') {
    skipped.push(quarantine);
  }

  return { dataRoot: paths.root, legacyRoot, migrated, skipped };
}

return {
  DATA_ROOT_NAME,
  LEGACY_DATA_ROOT_NAME,
  resolveDataRoot,
  resolveLegacyDataRoot,
  resolveDocumentsDirectory,
  buildDataPaths,
  ensureDataRoot,
  purgeDeprecatedContactStorage,
  legacyQuarantinePath,
  moveDirectoryIntoManagedData,
  readJsonFile,
  readSecureJsonFile,
  writeFileAtomic,
  writeJsonAtomic,
  writeSecureJsonAtomic,
  appendSecureJsonLine,
  readSecureJsonLines,
  encryptDataPayload,
  decryptDataPayload,
  migrateJsonArrayFile,
  migrateLegacyData
};

})();

const eventsModule = (() => {
const EventEmitter = require('events');

const EVENTS = Object.freeze({
  COMMAND_RECEIVED: 'command.received',
  VOICE_ACTIVATED: 'voice.activated',
  LISTENER_STARTED: 'listener.started',
  LISTENER_STOPPED: 'listener.stopped',
  SPEECH_DETECTED: 'speech.detected',
  UTTERANCE_FINALIZED: 'utterance.finalized',
  STT_COMPLETED: 'stt.completed',
  INTENT_DETECTED: 'intent.detected',
  COMMAND_EXECUTED: 'command.executed',
  RESPONSE_GENERATED: 'response.generated',
  RESPONSE_STARTED: 'response.started',
  RESPONSE_COMPLETED: 'response.completed',
  SCHEDULE_DUE: 'schedule.due',
  SCHEDULE_CHANGED: 'schedule.changed',
  UI_STATE_CHANGED: 'ui.state.changed',
  VOICE_STATE_CHANGED: 'voice.state.changed',
  VOICE_SESSION_STARTED: 'voice.sessionStarted',
  VOICE_SESSION_ENDED: 'voice.sessionEnded',
  VOICE_PARTIAL_TRANSCRIPT: 'voice.partialTranscript',
  VOICE_FINAL_TRANSCRIPT: 'voice.finalTranscript',
  VOICE_PROCESSING_STARTED: 'voice.processingStarted',
  VOICE_PROCESSING_FINISHED: 'voice.processingFinished',
  VOICE_ERROR: 'voice.error'
});

class AssistantEventBus extends EventEmitter {
  constructor(options = {}) {
    super();
    this.historyLimit = Number(options.historyLimit) > 0 ? Number(options.historyLimit) : 250;
    this.history = [];
  }

  publish(event, payload = {}) {
    const envelope = {
      event,
      payload,
      timestamp: new Date().toISOString()
    };

    this.history.push(envelope);
    if (this.history.length > this.historyLimit) {
      this.history.splice(0, this.history.length - this.historyLimit);
    }

    this.emit(event, envelope);
    this.emit('*', envelope);
    return envelope;
  }

  subscribe(event, handler) {
    this.on(event, handler);
    return () => this.off(event, handler);
  }

  getRecentEvents(limit = 50) {
    if (limit <= 0) {
      return [];
    }

    return this.history.slice(-limit);
  }
}

return {
  AssistantEventBus,
  EVENTS
};

})();

const sharedModule = ((eventsModule, dataRootModule) => {
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { AssistantEventBus, EVENTS } = eventsModule;
const { buildDataPaths } = dataRootModule;

const DEFAULT_MAX_LOG_SIZE = 10 * 1024 * 1024;
const DEFAULT_MAX_LOG_FILES = 5;
const SENSITIVE_KEY_PATTERN = /(?:password|passcode|pin|otp|verificationcode|developmentcode|token|secret|authorization|cookie|credential|private|key|api[_-]?key)/i;
const PRIVATE_TEXT_KEYS = new Set(['audio', 'pcm', 'buffer', 'sample', 'samples', 'text', 'input', 'response']);
const PRIVATE_TEXT_KEY_PATTERN = /(?:transcript|input(?:text)?|command(?:text)?|rawcommand|response|spokenresponse|pcm|buffer|samples?|utterance|speechtext)/i;
const VOICE_PRIVATE_KEY_PATTERN = /(?:transcript|input|text|response|pcm|buffer|sample|samples)/i;

function dateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function ensureDirectory(dir) {
  if (!dir || fs.existsSync(dir)) return;
  fs.mkdirSync(dir, { recursive: true });
}

function isPrivateLogKey(key, value) {
  const normalizedKey = String(key || '');
  if (PRIVATE_TEXT_KEYS.has(normalizedKey)) return true;
  if (!PRIVATE_TEXT_KEY_PATTERN.test(normalizedKey)) return false;
  return value === null || typeof value !== 'number' && typeof value !== 'boolean';
}

class Logger {
  constructor(config) {
    this.level = config?.level || 'info';
    this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
    const configuredDirectory = config?.directory || config?.logsDir || process.env.OPENX_LOG_DIR;
    this.directory = configuredDirectory || buildDataPaths(config).logsDir;
    this.maxFileSize = Number(config?.maxFileSize || DEFAULT_MAX_LOG_SIZE);
    this.maxFiles = Number(config?.maxFiles || DEFAULT_MAX_LOG_FILES);
    this.console = config?.console !== false;
    this.file = config?.file === true || (config?.file !== false && Boolean(configuredDirectory));
    this.lastCleanupByType = new Map();
    this.rotationSequence = 0;
  }

  _log(level, message, data) {
    if (this.levels[level] > this.levels[this.level]) return;
    const redactedData = this._redact(data || null);
    const summary = redactedData && typeof redactedData === 'object'
      ? this._formatHumanData(redactedData)
      : '';
    const suffix = this._formatData(redactedData, message);
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      summary: summary || null,
      data: redactedData
    };
    if (this.console) {
      if (level === 'error') {
        console.error(`[${entry.timestamp}] [${level.toUpperCase()}] ${message}${suffix}`);
      } else {
        console.log(`[${entry.timestamp}] [${level.toUpperCase()}] ${message}${suffix}`);
      }
    }
    this._writeEntry(level === 'error' ? 'error' : 'app', entry);
  }

  _formatData(data, message = '') {
    if (data === undefined || data === null || data === '') {
      return '';
    }

    if (typeof data === 'string') {
      return ` ${data}`;
    }

    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const summary = this._formatHumanData(data);
      if (summary) return ` | ${summary}`;
    }
    return ` | value=${this._formatHumanValue('value', data)}`;
  }

  _formatHumanData(data) {
    const pairs = [];
    const push = (key, value) => {
      if (pairs.length >= 14 || value === undefined || value === null || value === '') return;
      pairs.push(`${key}=${this._formatHumanValue(key, value)}`);
    };

    const preferredKeys = [
      'state',
      'from',
      'to',
      'reason',
      'phase',
      'runId',
      'sessionId',
      'recognitionCycleId',
      'frameIndex',
      'audioFrames',
      'processedFrames',
      'sttFrames',
      'partialTranscripts',
      'finalTranscripts',
      'endpointDetections',
      'droppedFrames',
      'error'
    ];

    for (const key of preferredKeys) {
      if (Object.prototype.hasOwnProperty.call(data, key)) push(this._humanKey(key), data[key]);
    }

    if (data.session && typeof data.session === 'object') {
      push('session', data.session.sessionId || data.session.id || data.session.state || 'active');
    }
    if (data.recognitionCycle && typeof data.recognitionCycle === 'object') {
      push('cycle', data.recognitionCycle.id || data.recognitionCycle.phase || 'active');
    }
    if (data.counters && typeof data.counters === 'object') {
      const counters = data.counters;
      const compactCounters = [
        ['audio', counters.audioFrames],
        ['processed', counters.processedFrames],
        ['stt', counters.sttFrames],
        ['partial', counters.partialTranscripts],
        ['final', counters.finalTranscripts],
        ['busy', counters.audioFramesWhileBusy],
        ['stale', counters.staleAudioFrames],
        ['endpoints', counters.endpointDetections]
      ]
        .filter(([, value]) => Number(value) > 0)
        .map(([name, value]) => `${name}:${value}`)
        .join(',');
      push('pipeline', compactCounters || 'idle');
    }

    for (const [key, value] of Object.entries(data)) {
      if (pairs.length >= 14) break;
      if (preferredKeys.includes(key) || ['session', 'recognitionCycle', 'counters'].includes(key)) continue;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        push(this._humanKey(key), this._formatHumanObject(value));
      } else {
        push(this._humanKey(key), value);
      }
    }

    return pairs.join(' | ');
  }

  _formatHumanValue(key, value) {
    const normalizedKey = String(key || '');
    if ((PRIVATE_TEXT_KEYS.has(normalizedKey) || VOICE_PRIVATE_KEY_PATTERN.test(normalizedKey)) &&
        value !== null &&
        typeof value !== 'number' &&
        typeof value !== 'boolean') {
      if (typeof value === 'string' && /^\[(?:\d+ chars|\d+ items|\d+ bytes|REDACTED)\]$/i.test(value)) {
        return value;
      }
      if (typeof value === 'string') return `[${value.length} chars]`;
      if (Array.isArray(value)) return `[${value.length} items]`;
      if (Buffer.isBuffer(value)) return `[${value.length} bytes]`;
      return '[redacted]';
    }
    if (value instanceof Error) return value.message;
    if (typeof value === 'boolean') return value ? 'yes' : 'no';
    if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(3);
    if (typeof value === 'string') {
      const normalized = value.replace(/\s+/g, ' ').trim();
      if (!normalized) return 'empty';
      return /[\s|=]/.test(normalized) ? `"${normalized.slice(0, 120)}"` : normalized.slice(0, 120);
    }
    if (Array.isArray(value)) return `[${value.length} items]`;
    if (value && typeof value === 'object') return this._formatHumanObject(value);
    return String(value);
  }

  _formatHumanObject(value) {
    const direct = value.message || value.name || value.id || value.status || value.state;
    if (direct) return this._formatHumanValue('summary', direct);

    const preferred = [
      'role',
      'engine',
      'model',
      'runtime',
      'provider',
      'language',
      'modelStatus',
      'preload',
      'files',
      'version',
      'platform',
      'release',
      'reason',
      'code'
    ];
    const pairs = [];
    const append = key => {
      if (pairs.length >= 5 || !Object.prototype.hasOwnProperty.call(value, key)) return;
      const child = value[key];
      if (child === undefined || child === null || child === '') return;
      if (child && typeof child === 'object') return;
      pairs.push(`${this._humanKey(key)}:${this._formatHumanValue(key, child)}`);
    };

    for (const key of preferred) append(key);
    for (const key of Object.keys(value)) {
      if (pairs.length >= 5) break;
      if (preferred.includes(key)) continue;
      append(key);
    }

    return pairs.length ? `{${pairs.join(',')}}` : '[object]';
  }

  _humanKey(key) {
    return String(key || '')
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[_\s]+/g, '-')
      .toLowerCase();
  }

  _redact(value, depth = 0) {
    if (value === null || value === undefined) return value;
    if (depth > 6) return '[MaxDepth]';
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: typeof value.stack === 'string' ? value.stack.slice(0, 4000) : null
      };
    }
    if (Array.isArray(value)) {
      return value.slice(0, 50).map(item => this._redact(item, depth + 1));
    }
    if (typeof value === 'object') {
      const output = {};
      for (const [key, child] of Object.entries(value)) {
        if (SENSITIVE_KEY_PATTERN.test(key)) {
          output[key] = '[REDACTED]';
        } else if (isPrivateLogKey(key, child)) {
          output[key] = this._redactPrivateValue(child);
        } else {
          output[key] = this._redact(child, depth + 1);
        }
      }
      return output;
    }
    if (typeof value === 'string' && value.length > 2000) {
      return `${value.slice(0, 2000)}...[truncated]`;
    }
    return value;
  }

  _redactPrivateValue(value) {
    if (typeof value === 'string') return `[${value.length} chars]`;
    if (Array.isArray(value)) return `[${value.length} items]`;
    if (Buffer.isBuffer(value)) return `[${value.length} bytes]`;
    if (value && typeof value === 'object') return '[REDACTED]';
    if (value === null || value === undefined) return value;
    return '[REDACTED]';
  }

  _writeEntry(type, entry) {
    if (!this.file || !this.directory) return;
    try {
      ensureDirectory(this.directory);
      const logPath = path.join(this.directory, `${type}-${dateStamp()}.log`);
      const rotated = this._rotateIfNeeded(logPath, type);
      dataRootModule.appendSecureJsonLine(logPath, entry);
      this._cleanupOldLogs(type, rotated);
    } catch (_) {
      // Logging must never break assistant execution.
    }
  }

  _rotateIfNeeded(logPath, type) {
    if (!fs.existsSync(logPath)) return false;
    const maxFileSize = Number.isFinite(this.maxFileSize) && this.maxFileSize > 0
      ? this.maxFileSize
      : DEFAULT_MAX_LOG_SIZE;
    const stats = fs.statSync(logPath);
    if (stats.size < maxFileSize) return false;

    let rotatedPath;
    do {
      rotatedPath = path.join(
        this.directory,
        `${type}-${dateStamp()}-${Date.now()}-${this.rotationSequence++}.log`
      );
    } while (fs.existsSync(rotatedPath));
    fs.renameSync(logPath, rotatedPath);
    return true;
  }

  _cleanupOldLogs(type, force = false) {
    const today = dateStamp();
    if (!force && this.lastCleanupByType.get(type) === today) return;
    this.lastCleanupByType.set(type, today);

    const maxFiles = Number.isFinite(this.maxFiles) && this.maxFiles > 0
      ? this.maxFiles
      : DEFAULT_MAX_LOG_FILES;
    const prefix = `${type}-`;
    const files = fs.readdirSync(this.directory)
      .filter(name => name.startsWith(prefix) && name.endsWith('.log'))
      .map(name => {
        const filePath = path.join(this.directory, name);
        const stats = fs.statSync(filePath);
        return { filePath, mtimeMs: stats.mtimeMs };
      })
      .sort((left, right) => right.mtimeMs - left.mtimeMs);

    for (const stale of files.slice(maxFiles)) {
      try {
        fs.unlinkSync(stale.filePath);
      } catch (_) {
        // Ignore locked files; the next cleanup pass can retry.
      }
    }
  }

  static writeCrashSync(error, context = {}, config = {}) {
    const logger = new Logger({ ...config, console: false });
    try {
      ensureDirectory(logger.directory);
      const payload = {
        timestamp: new Date().toISOString(),
        level: 'crash',
        message: error?.message || String(error || 'Unknown crash'),
        stack: error?.stack || null,
        context: logger._redact(context)
      };
      const logPath = path.join(logger.directory, `crash-${dateStamp()}.log`);
      const rotated = logger._rotateIfNeeded(logPath, 'crash');
      dataRootModule.appendSecureJsonLine(logPath, payload);
      logger._cleanupOldLogs('crash', rotated);
    } catch (_) {
      // Last-resort crash logging cannot throw.
    }
  }

  error(message, data) { this._log('error', message, data); }
  warn(message, data) { this._log('warn', message, data); }
  info(message, data) { this._log('info', message, data); }
  debug(message, data) { this._log('debug', message, data); }
}

class Validator {
  static isString(value) {
    return typeof value === 'string';
  }

  static isNumber(value) {
    return typeof value === 'number' && !Number.isNaN(value);
  }

  static isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
  }

  static isInRange(value, min, max) {
    return value >= min && value <= max;
  }

  static isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  static sanitizePath(input) {
    if (typeof input !== 'string') return '';
    return input.replace(/[<>:"|?*]/g, '').trim();
  }

  static sanitizeCommand(input) {
    if (typeof input !== 'string') return '';
    return input.replace(/[;&|`$(){}\n\r]/g, '').trim();
  }

  static isValidFilename(name) {
    if (typeof name !== 'string') return false;
    if (name.length === 0 || name.length > 255) return false;
    return !/[<>:"/\\|?*\x00-\x1f]/.test(name);
  }
}

class IdGenerator {
  static generate() {
    return crypto.randomUUID();
  }

  static short() {
    return crypto.randomBytes(4).toString('hex');
  }
}

class Normalizer {
  static normalizeWhitespace(input) {
    if (typeof input !== 'string') return '';
    return input.replace(/\s+/g, ' ').trim();
  }

  static normalizeText(input) {
    if (typeof input !== 'string') return '';
    return this.normalizeWhitespace(
      input
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
    );
  }

  static extractNumber(text) {
    const match = text.match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  }

  static extractPercentage(text) {
    const match = text.match(/(\d+)\s*%/);
    return match ? parseInt(match[0], 10) : null;
  }

  static tokenize(text) {
    const normalized = this.normalizeText(text);
    if (!normalized) return [];
    return normalized.split(/\s+/).filter(Boolean);
  }

  static expandContractions(text) {
    if (typeof text !== 'string') return '';

    const contractions = {
      "can't": 'cannot',
      "won't": 'will not',
      "don't": 'do not',
      "didn't": 'did not',
      "doesn't": 'does not',
      "i'm": 'i am',
      "it's": 'it is',
      "that's": 'that is',
      "what's": 'what is',
      "whats": 'what is',
      "you're": 'you are',
      "couldn't": 'could not',
      "shouldn't": 'should not',
      "wouldn't": 'would not'
    };

    let result = text;
    for (const [from, to] of Object.entries(contractions)) {
      result = result.replace(new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), to);
    }
    return result;
  }

  static damerauLevenshtein(a, b) {
    const source = a || '';
    const target = b || '';

    if (source === target) return 0;
    if (!source.length) return target.length;
    if (!target.length) return source.length;

    const matrix = Array.from({ length: source.length + 1 }, () => new Array(target.length + 1).fill(0));

    for (let i = 0; i <= source.length; i += 1) matrix[i][0] = i;
    for (let j = 0; j <= target.length; j += 1) matrix[0][j] = j;

    for (let i = 1; i <= source.length; i += 1) {
      for (let j = 1; j <= target.length; j += 1) {
        const cost = source[i - 1] === target[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );

        if (
          i > 1 &&
          j > 1 &&
          source[i - 1] === target[j - 2] &&
          source[i - 2] === target[j - 1]
        ) {
          matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost);
        }
      }
    }

    return matrix[source.length][target.length];
  }

  static similarity(a, b) {
    const source = this.normalizeText(a);
    const target = this.normalizeText(b);

    if (!source && !target) return 1;
    if (!source || !target) return 0;

    const distance = this.damerauLevenshtein(source, target);
    return 1 - (distance / Math.max(source.length, target.length));
  }

  static findClosestOption(input, options, config = {}) {
    const normalizedInput = this.normalizeText(input);
    if (!normalizedInput || !Array.isArray(options) || options.length === 0) {
      return null;
    }

    const minSimilarity = config.minSimilarity ?? 0.72;
    const maxDistance = config.maxDistance ?? (normalizedInput.length >= 7 ? 2 : 1);
    let best = null;

    for (const option of options) {
      const normalizedOption = this.normalizeText(option);
      if (!normalizedOption) continue;

      const distance = this.damerauLevenshtein(normalizedInput, normalizedOption);
      const similarity = 1 - (distance / Math.max(normalizedInput.length, normalizedOption.length));

      if (distance > maxDistance || similarity < minSimilarity) {
        continue;
      }

      if (
        !best ||
        similarity > best.similarity ||
        (similarity === best.similarity && distance < best.distance)
      ) {
        best = {
          match: option,
          normalizedMatch: normalizedOption,
          similarity,
          distance
        };
      }
    }

    return best;
  }
}

return {
  Logger,
  Validator,
  IdGenerator,
  Normalizer,
  AssistantEventBus,
  EVENTS
};

})(eventsModule, dataRootModule);

module.exports = {
  ...sharedModule,
  ...eventsModule,
  ...dataRootModule
};
