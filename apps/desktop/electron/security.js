const path = require('path');
const { fileURLToPath } = require('url');

const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const ALLOWED_COMMAND_SOURCES = new Set(['chat', 'voice']);
const UNSAFE_TEXT_CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const UNSAFE_DIRECTIONAL_PATTERN = /[\u202A-\u202E\u2066-\u2069]/;

function assertSafeString(value, name) {
  if (UNSAFE_TEXT_CONTROL_PATTERN.test(value)) {
    throw new TypeError(`${name} contains unsafe control characters`);
  }
  if (UNSAFE_DIRECTIONAL_PATTERN.test(value)) {
    throw new TypeError(`${name} contains unsafe directional characters`);
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requirePlainObject(value, name = 'payload') {
  if (!isPlainObject(value)) {
    throw new TypeError(`${name} must be a plain object`);
  }
  return value;
}

function requireString(value, name, options = {}) {
  const maxLength = options.maxLength || 5000;
  if (typeof value !== 'string') {
    throw new TypeError(`${name} must be a string`);
  }
  const normalized = value.trim();
  if (!options.allowEmpty && !normalized) {
    throw new TypeError(`${name} must not be empty`);
  }
  if (normalized.length > maxLength) {
    throw new RangeError(`${name} exceeds ${maxLength} characters`);
  }
  assertSafeString(normalized, name);
  return normalized;
}

function validateJsonValue(value, name, state = { seen: new Set(), nodes: 0 }, depth = 0) {
  state.nodes += 1;
  if (state.nodes > 2000 || depth > 12) {
    throw new RangeError(`${name} is too complex`);
  }
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${name} contains an invalid number`);
    return;
  }
  if (typeof value === 'string') {
    assertSafeString(value, name);
    return;
  }
  if (typeof value !== 'object') {
    throw new TypeError(`${name} contains an unsupported value`);
  }
  if (state.seen.has(value)) {
    throw new TypeError(`${name} must not contain circular references`);
  }
  state.seen.add(value);
  if (Array.isArray(value)) {
    if (value.length > 500) throw new RangeError(`${name} contains too many items`);
    value.forEach((item, index) => validateJsonValue(item, `${name}[${index}]`, state, depth + 1));
  } else {
    requirePlainObject(value, name);
    const entries = Object.entries(value);
    if (entries.length > 200) throw new RangeError(`${name} contains too many fields`);
    for (const [key, child] of entries) {
      if (FORBIDDEN_OBJECT_KEYS.has(key)) {
        throw new TypeError(`${name} contains a forbidden field`);
      }
      validateJsonValue(child, `${name}.${key}`, state, depth + 1);
    }
  }
  state.seen.delete(value);
}

function validateStructuredPayload(value, name, maxBytes) {
  requirePlainObject(value, name);
  validateJsonValue(value, name);
  const bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
  if (bytes > maxBytes) throw new RangeError(`${name} exceeds ${maxBytes} bytes`);
  return value;
}

function validateCommand(payload) {
  requirePlainObject(payload);
  const input = requireString(payload.input, 'input', { maxLength: 5000 });
  const source = payload.source === undefined
    ? 'chat'
    : requireString(payload.source, 'source', { maxLength: 20 });
  if (!ALLOWED_COMMAND_SOURCES.has(source)) throw new TypeError('source is not supported');
  return { input, source };
}

function validateConfirmation(payload) {
  requirePlainObject(payload);
  const commandId = requireString(payload.commandId, 'commandId', { maxLength: 128 });
  const intentId = requireString(payload.intentId, 'intentId', { maxLength: 128 });
  const entities = payload.entities === undefined
    ? {}
    : validateStructuredPayload(payload.entities, 'entities', 64 * 1024);
  return { commandId, intentId, entities };
}

function validateSpeech(payload) {
  requirePlainObject(payload);
  return { text: requireString(payload.text, 'text', { maxLength: 4000 }) };
}

function validateExternalBrowserUrl(payload) {
  requirePlainObject(payload);
  const url = requireString(payload.url, 'url', { maxLength: 2048 });
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new TypeError('url protocol is not supported');
  }
  return { url: parsed.href };
}

function validateSettings(payload) {
  return validateStructuredPayload(payload, 'settings', 256 * 1024);
}

function normalizeCloudUrl(value) {
  const relayUrl = requireString(value, 'relayUrl', { maxLength: 2048 });
  const parsed = new URL(relayUrl);
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol)) {
    throw new TypeError('relayUrl protocol is not supported');
  }
  return relayUrl;
}

function validateCloudConnect(payload) {
  requirePlainObject(payload);
  const normalized = {};
  if (payload.relayUrl !== undefined) normalized.relayUrl = normalizeCloudUrl(payload.relayUrl);
  if (payload.autoConnect !== undefined) normalized.autoConnect = payload.autoConnect === true;
  if (payload.reconnectEnabled !== undefined) normalized.reconnectEnabled = payload.reconnectEnabled !== false;
  if (payload.heartbeatEnabled !== undefined) normalized.heartbeatEnabled = payload.heartbeatEnabled !== false;
  if (payload.connectionTimeoutMs !== undefined) {
    normalized.connectionTimeoutMs = Math.max(1000, Math.min(60000, Number(payload.connectionTimeoutMs) || 10000));
  }
  if (payload.heartbeatIntervalMs !== undefined) {
    normalized.heartbeatIntervalMs = Math.max(5000, Math.min(120000, Number(payload.heartbeatIntervalMs) || 30000));
  }
  return normalized;
}

function validateCloudPairRequest(payload) {
  requirePlainObject(payload);
  const pairRequestId = requireString(payload.pairRequestId, 'pairRequestId', { maxLength: 128 });
  if (!/^[A-Za-z0-9._-]+$/.test(pairRequestId)) throw new TypeError('pairRequestId is invalid');
  return { pairRequestId };
}

function validateSecurityPasswordPayload(payload) {
  requirePlainObject(payload);
  return {
    password: requireString(payload.password, 'password', { maxLength: 256 })
  };
}

function validateSecurityPasswordUpdate(payload) {
  requirePlainObject(payload);
  return {
    currentPassword: payload.currentPassword === undefined
      ? ''
      : requireString(payload.currentPassword, 'currentPassword', { maxLength: 256, allowEmpty: true }),
    newPassword: requireString(payload.newPassword, 'newPassword', { maxLength: 256 })
  };
}

function validateScheduleAction(payload) {
  requirePlainObject(payload);
  const id = requireString(payload.id, 'id', { maxLength: 200 });
  const action = requireString(payload.action, 'action', { maxLength: 20 });
  if (!['snooze', 'stop', 'end'].includes(action)) throw new TypeError('schedule action is not supported');
  const minutes = Math.max(1, Math.min(60, Number(payload.minutes) || 5));
  return { id, action: action === 'end' ? 'stop' : action, minutes };
}

function validateVoiceOverlayCollapse(payload) {
  if (payload === undefined) return {};
  requirePlainObject(payload);
  const normalized = {};
  if (payload.statusText !== undefined) {
    normalized.statusText = requireString(payload.statusText, 'statusText', { maxLength: 80 });
  }
  if (payload.icon !== undefined) {
    normalized.icon = requireString(payload.icon, 'icon', { maxLength: 3 });
  }
  if (payload.hideAfterMs !== undefined) {
    normalized.hideAfterMs = Math.max(0, Math.min(30000, Number(payload.hideAfterMs) || 0));
  }
  if (payload.presentationClass !== undefined) {
    const presentationClass = requireString(payload.presentationClass, 'presentationClass', { maxLength: 60, allowEmpty: true });
    if (presentationClass && !/^[A-Za-z0-9_-]+$/.test(presentationClass)) throw new TypeError('presentationClass is invalid');
    normalized.presentationClass = presentationClass;
  }
  return normalized;
}

function validateTimerWidgetClose(payload) {
  if (payload !== undefined) requirePlainObject(payload);
  return {};
}

function validatePlannerView(payload) {
  requirePlainObject(payload);
  const view = requireString(payload.view || 'calendar', 'view', { maxLength: 20 });
  if (!['calendar', 'timetable'].includes(view)) throw new TypeError('planner view is not supported');
  return { view };
}

function validateGalleryView(payload) {
  requirePlainObject(payload);
  const view = requireString(payload.view || 'timeline', 'view', { maxLength: 20 });
  if (!['timeline', 'photos', 'favorites', 'recent', 'people'].includes(view)) throw new TypeError('gallery view is not supported');
  return { view };
}

function validateGalleryViewQuery(payload) {
  const data = validateGalleryView(payload);
  return {
    ...data,
    page: Math.max(1, Math.min(10000, Number(payload.page) || 1)),
    pageSize: Math.max(1, Math.min(120, Number(payload.pageSize) || 80))
  };
}

function validateGalleryPhotosQuery(payload) {
  if (payload === undefined) return { page: 1, pageSize: 80 };
  requirePlainObject(payload);
  return {
    page: Math.max(1, Math.min(10000, Number(payload.page) || 1)),
    pageSize: Math.max(1, Math.min(120, Number(payload.pageSize) || 80))
  };
}

function validateGalleryPhoto(payload) {
  requirePlainObject(payload);
  const photoId = requireString(payload.photoId, 'photoId', { maxLength: 160 });
  if (!/^[A-Za-z0-9._:-]+$/.test(photoId)) throw new TypeError('photoId is invalid');
  return { photoId };
}

function validateGalleryFavorite(payload) {
  const data = validateGalleryPhoto(payload);
  return {
    ...data,
    favorite: typeof payload.favorite === 'boolean' ? payload.favorite : null
  };
}

function validateGalleryFaceName(payload) {
  requirePlainObject(payload);
  const clusterId = requireString(payload.clusterId, 'clusterId', { maxLength: 160 });
  const name = requireString(payload.name, 'name', { maxLength: 120 }).replace(/\s+/g, ' ').trim();
  if (!/^[A-Za-z0-9._:-]+$/.test(clusterId)) throw new TypeError('clusterId is invalid');
  if (!name) throw new TypeError('name is required');
  return {
    clusterId,
    name,
    relationship: typeof payload.relationship === 'string'
      ? payload.relationship.replace(/\s+/g, ' ').trim().slice(0, 80)
      : ''
  };
}

function validateGalleryPeopleScan(payload = {}) {
  if (payload === undefined) return { maxPhotos: 10000 };
  requirePlainObject(payload);
  return {
    maxPhotos: Math.max(1, Math.min(100000, Number(payload.maxPhotos) || 10000))
  };
}

function validatePlannerEntry(payload) {
  requirePlainObject(payload);
  const type = requireString(payload.type || 'calendar', 'type', { maxLength: 20 });
  if (!['calendar', 'timetable'].includes(type)) throw new TypeError('planner entry type is not supported');
  const normalized = { type };
  for (const field of ['title', 'plannerText', 'notes', 'date', 'dateExpression', 'startTime', 'timeExpression', 'endTime']) {
    if (payload[field] !== undefined) {
      normalized[field] = requireString(payload[field], field, { maxLength: field === 'notes' ? 1000 : 200, allowEmpty: true });
    }
  }
  if (normalized.date && !/^\d{4}-\d{2}-\d{2}$/.test(normalized.date)) {
    throw new TypeError('date must use YYYY-MM-DD format');
  }
  for (const field of ['startTime', 'endTime']) {
    if (normalized[field] && !/^\d{2}:\d{2}$/.test(normalized[field])) {
      throw new TypeError(`${field} must use HH:MM format`);
    }
  }
  return normalized;
}

function validatePlannerDelete(payload) {
  requirePlainObject(payload);
  return { id: requireString(payload.id, 'id', { maxLength: 128 }) };
}

function validateCloudDevice(payload) {
  requirePlainObject(payload);
  const deviceId = requireString(payload.deviceId, 'deviceId', { maxLength: 128 });
  if (!/^[A-Za-z0-9._:-]+$/.test(deviceId)) throw new TypeError('deviceId is invalid');
  return { deviceId };
}

function validateCloudDeviceRename(payload) {
  const { deviceId } = validateCloudDevice(payload);
  const deviceName = requireString(payload.deviceName, 'deviceName', { maxLength: 100 }).replace(/\s+/g, ' ').trim();
  if (!deviceName) throw new TypeError('deviceName is required');
  return { deviceId, deviceName };
}

function validateEmpty(payload) {
  if (payload !== undefined) throw new TypeError('This channel does not accept a payload');
  return undefined;
}

const IPC_VALIDATORS = Object.freeze({
  'command:process': validateCommand,
  'command:confirm': validateConfirmation,
  'assistant:status': validateEmpty,
  'tts:speak': validateSpeech,
  'tts:stop': validateEmpty,
  'browser:openExternal': validateExternalBrowserUrl,
  'voice:start': validateEmpty,
  'voiceOverlay:collapse': validateVoiceOverlayCollapse,
  'voiceOverlay:expandLiveSchedule': validateEmpty,
  'window:openChat': validateEmpty,
  'window:openSettings': validateEmpty,
  'window:openPlanner': validatePlannerView,
  'window:closePlanner': validateEmpty,
  'window:openGallery': validateGalleryView,
  'window:closeGallery': validateEmpty,
  'config:get': validateEmpty,
  'settings:get': validateEmpty,
  'security:status': validateEmpty,
  'security:verifyAccess': validateSecurityPasswordPayload,
  'security:setPassword': validateSecurityPasswordUpdate,
  'cloud:status': validateEmpty,
  'cloud:connect': validateCloudConnect,
  'cloud:disconnect': validateEmpty,
  'cloud:pairingQR:create': validateSecurityPasswordPayload,
  'cloud:pairing:status': validateEmpty,
  'cloud:pairing:approve': validateCloudPairRequest,
  'cloud:pairing:reject': validateCloudPairRequest,
  'cloud:devices:list': validateEmpty,
  'cloud:device:rename': validateCloudDeviceRename,
  'cloud:device:remove': validateCloudDevice,
  'settings:save': validateSettings,
  'settings:reset': validateEmpty,
  'schedule:alertAction': validateScheduleAction,
  'schedule:getSnapshot': validateEmpty,
  'timerWidget:getState': validateEmpty,
  'timerWidget:close': validateTimerWidgetClose,
  'timerWidget:stopStopwatch': validateEmpty,
  'timerWidget:resumeStopwatch': validateEmpty,
  'timerWidget:resetStopwatch': validateEmpty,
  'planner:getEntries': validateEmpty,
  'planner:addEntry': validatePlannerEntry,
  'planner:deleteEntry': validatePlannerDelete,
  'gallery:getView': validateGalleryViewQuery,
  'gallery:getPhotos': validateGalleryPhotosQuery,
  'gallery:getImageData': validateGalleryPhoto,
  'gallery:openPhoto': validateGalleryPhoto,
  'gallery:showPhoto': validateGalleryPhoto,
  'gallery:toggleFavorite': validateGalleryFavorite,
  'gallery:nameFace': validateGalleryFaceName,
  'gallery:scanPeople': validateGalleryPeopleScan,
  'app:quit': validateEmpty
});

function isTrustedRendererUrl(url, rendererRoot) {
  if (typeof url !== 'string' || !url || !rendererRoot) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'file:') return false;
    const filePath = path.resolve(fileURLToPath(parsed));
    const trustedRoot = path.resolve(rendererRoot);
    const relative = path.relative(trustedRoot, filePath);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  } catch (_) {
    return false;
  }
}

function getIpcSenderUrl(event) {
  return event?.senderFrame?.url || event?.sender?.getURL?.() || '';
}

function assertTrustedIpcSender(event, rendererRoot) {
  const senderUrl = getIpcSenderUrl(event);
  if (!isTrustedRendererUrl(senderUrl, rendererRoot)) {
    throw new Error('IPC sender is not a trusted local renderer');
  }
  return senderUrl;
}

function createSecureWebPreferences(preloadPath) {
  return Object.freeze({
    preload: preloadPath,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    backgroundThrottling: false,
    allowRunningInsecureContent: false,
    enableRemoteModule: false,
    safeDialogs: true,
    navigateOnDragDrop: false,
    webviewTag: false,
    spellcheck: false
  });
}

module.exports = {
  IPC_VALIDATORS,
  assertTrustedIpcSender,
  createSecureWebPreferences,
  getIpcSenderUrl,
  isPlainObject,
  isTrustedRendererUrl,
  validateJsonValue
};
