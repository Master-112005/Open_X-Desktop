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

const CHAT_HISTORY_ENTRY_LIMIT = 300;

function validateChatHistorySave(payload) {
  requirePlainObject(payload, 'chatHistory');
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  if (entries.length > CHAT_HISTORY_ENTRY_LIMIT) throw new RangeError('chatHistory contains too many entries');
  return {
    entries: entries.map((entry, index) => {
      requirePlainObject(entry, `chatHistory.entries[${index}]`);
      const type = requireString(entry.type || 'system', `chatHistory.entries[${index}].type`, { maxLength: 20 });
      if (!['user', 'assistant', 'system'].includes(type)) throw new TypeError('chat history entry type is not supported');
      return {
        type,
        text: requireString(entry.text || '', `chatHistory.entries[${index}].text`, { maxLength: 4000 }),
        meta: requireString(entry.meta === undefined || entry.meta === null ? '' : entry.meta, `chatHistory.entries[${index}].meta`, { maxLength: 120, allowEmpty: true }),
        createdAt: Math.max(0, Number(entry.createdAt) || Date.now())
      };
    })
  };
}

function requireDesktopChatConversationId(value, name = 'conversationId') {
  const id = requireString(value, name, { maxLength: 100 }).toLowerCase();
  if (!/^conv_[a-f0-9]{64}$/.test(id)) throw new TypeError(`${name} is invalid`);
  return id;
}

function validateDesktopChatList(payload = {}) {
  requirePlainObject(payload, 'desktopChat');
  const query = payload.query === undefined
    ? ''
    : requireString(payload.query, 'desktopChat.query', { maxLength: 120, allowEmpty: true });
  const limit = Math.max(1, Math.min(50, Number(payload.limit || 30)));
  if (!Number.isFinite(limit)) throw new TypeError('desktopChat.limit is invalid');
  return { query, limit };
}

function validateDesktopChatOpen(payload) {
  requirePlainObject(payload, 'desktopChat');
  return {
    conversationId: requireDesktopChatConversationId(payload.conversationId)
  };
}

function validateDesktopChatCreate(payload = {}) {
  requirePlainObject(payload, 'desktopChat');
  const title = requireString(payload.peerName || payload.name || payload.title || 'New Chat', 'desktopChat.title', { maxLength: 80 });
  const peerHandle = payload.peerHandle === undefined && payload.openxId === undefined && payload.identifier === undefined
    ? ''
    : requireString(payload.peerHandle || payload.openxId || payload.identifier, 'desktopChat.peerHandle', { maxLength: 120 });
  const peerType = payload.peerType === undefined
    ? 'openx'
    : requireString(payload.peerType, 'desktopChat.peerType', { maxLength: 40 });
  const output = {
    title,
    peerName: title,
    peerHandle,
    peerType
  };
  return output;
}

function validateDesktopChatUpdate(payload = {}) {
  requirePlainObject(payload, 'desktopChat');
  const titleValue = payload.peerName !== undefined
    ? payload.peerName
    : (payload.name !== undefined ? payload.name : payload.title);
  const peerHandleValue = payload.peerHandle !== undefined
    ? payload.peerHandle
    : (payload.openxId !== undefined ? payload.openxId : payload.identifier);
  const title = requireString(titleValue, 'desktopChat.title', { maxLength: 80 });
  const peerHandle = requireString(peerHandleValue, 'desktopChat.peerHandle', { maxLength: 120 });
  const peerType = payload.peerType === undefined
    ? 'openx'
    : requireString(payload.peerType, 'desktopChat.peerType', { maxLength: 40 });
  return {
    conversationId: requireDesktopChatConversationId(payload.conversationId),
    title,
    peerName: title,
    peerHandle,
    peerType
  };
}

function validateDesktopChatSend(payload) {
  requirePlainObject(payload, 'desktopChat');
  return {
    conversationId: requireDesktopChatConversationId(payload.conversationId),
    text: requireString(payload.text, 'desktopChat.text', { maxLength: 1200 })
  };
}

function validateDesktopChatQuickReply(payload) {
  requirePlainObject(payload, 'desktopChat.quickReply');
  return {
    conversationId: requireDesktopChatConversationId(payload.conversationId),
    text: requireString(payload.text || 'OK', 'desktopChat.text', { maxLength: 120 })
  };
}

function validateDesktopChatUiState(payload = {}) {
  requirePlainObject(payload, 'desktopChat.uiState');
  const output = {
    visible: payload.visible === true,
    threadOpen: payload.threadOpen === true
  };
  if (payload.activeConversationId || payload.conversationId) {
    output.activeConversationId = requireDesktopChatConversationId(payload.activeConversationId || payload.conversationId);
  } else {
    output.activeConversationId = '';
  }
  return output;
}

function requireDesktopChatRequestId(value, name = 'requestId') {
  const id = requireString(value, name, { maxLength: 100 }).toLowerCase();
  if (!/^creq_[a-f0-9]{64}$/.test(id)) throw new TypeError(`${name} is invalid`);
  return id;
}

function validateDesktopChatRequestAction(payload = {}) {
  requirePlainObject(payload, 'desktopChat.request');
  const output = {
    requestId: requireDesktopChatRequestId(payload.requestId)
  };
  if (payload.peerName !== undefined && payload.peerName !== null && payload.peerName !== '') {
    output.peerName = requireString(payload.peerName, 'desktopChat.peerName', { maxLength: 80 });
  }
  if (payload.peerHandle !== undefined && payload.peerHandle !== null && payload.peerHandle !== '') {
    output.peerHandle = requireString(payload.peerHandle, 'desktopChat.peerHandle', { maxLength: 120 });
  }
  if (payload.reason !== undefined && payload.reason !== null && payload.reason !== '') {
    output.reason = requireString(payload.reason, 'desktopChat.reason', { maxLength: 160 });
  }
  return output;
}

function normalizeOptionalChatApiBaseUrl(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const apiBaseUrl = requireString(value, 'desktopChat.apiBaseUrl', { maxLength: 240 });
  const parsed = new URL(apiBaseUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new TypeError('desktopChat.apiBaseUrl protocol is not supported');
  }
  parsed.hash = '';
  parsed.search = '';
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  return parsed.href.replace(/\/+$/, '');
}

function requireDesktopChatUsername(value, name = 'desktopChat.username') {
  const rawUsername = requireString(value, name, { maxLength: 33 });
  const username = rawUsername.startsWith('@') ? rawUsername.slice(1).trim() : rawUsername;
  if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) {
    throw new TypeError(`${name} must be 3-32 letters, numbers, dots, hyphens, or underscores, with an optional leading @`);
  }
  return username;
}

function requireDesktopChatPassword(value, name = 'desktopChat.password') {
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`);
  if (value.length < 10 || value.length > 128) {
    throw new RangeError(`${name} must be 10-128 characters`);
  }
  return value;
}

function validateDesktopChatRegistrationStart(payload = {}) {
  requirePlainObject(payload, 'desktopChat.registration');
  const output = {
    username: requireDesktopChatUsername(payload.username),
    password: requireDesktopChatPassword(payload.password),
    apiBaseUrl: normalizeOptionalChatApiBaseUrl(payload.apiBaseUrl)
  };
  if (payload.pin !== undefined && payload.pin !== null && payload.pin !== '') {
    output.pin = requireString(payload.pin, 'desktopChat.pin', { maxLength: 24 });
  }
  return output;
}

function validateDesktopChatPasswordUpdate(payload = {}) {
  requirePlainObject(payload, 'desktopChat.profile');
  return {
    currentPassword: requireDesktopChatPassword(payload.currentPassword, 'desktopChat.currentPassword'),
    newPassword: requireDesktopChatPassword(payload.newPassword, 'desktopChat.newPassword')
  };
}

function validateUiState(payload) {
  requirePlainObject(payload, 'uiState');
  const schedules = Array.isArray(payload.schedules) ? payload.schedules : [];
  const notifications = Array.isArray(payload.notifications) ? payload.notifications : [];
  if (schedules.length > 80) throw new RangeError('uiState contains too many schedules');
  if (notifications.length > 30) throw new RangeError('uiState contains too many notifications');
  return {
    assistantMuted: payload.assistantMuted === true,
    schedules: schedules.map((entry, index) => {
      requirePlainObject(entry, `uiState.schedules[${index}]`);
      return {
        id: requireString(entry.id || '', `uiState.schedules[${index}].id`, { maxLength: 160 }),
        kind: requireString(entry.kind || 'Reminder', `uiState.schedules[${index}].kind`, { maxLength: 40 }),
        message: requireString(entry.message || entry.title || 'Reminder', `uiState.schedules[${index}].message`, { maxLength: 500 }),
        category: requireString(entry.category || '', `uiState.schedules[${index}].category`, { maxLength: 80, allowEmpty: true }) || null,
        symbol: requireString(entry.symbol || '', `uiState.schedules[${index}].symbol`, { maxLength: 16, allowEmpty: true }) || null,
        dueAt: requireString(entry.dueAt || '', `uiState.schedules[${index}].dueAt`, { maxLength: 80 }),
        recurrence: requireString(entry.recurrence || '', `uiState.schedules[${index}].recurrence`, { maxLength: 160, allowEmpty: true }),
        status: requireString(entry.status || 'scheduled', `uiState.schedules[${index}].status`, { maxLength: 40 }),
        createdAt: requireString(entry.createdAt || new Date(0).toISOString(), `uiState.schedules[${index}].createdAt`, { maxLength: 80 }),
        source: requireString(entry.source || '', `uiState.schedules[${index}].source`, { maxLength: 80, allowEmpty: true }) || null
      };
    }),
    notifications: notifications.map((entry, index) => {
      requirePlainObject(entry, `uiState.notifications[${index}]`);
      return {
        id: requireString(entry.id || '', `uiState.notifications[${index}].id`, { maxLength: 160 }),
        title: requireString(entry.title || 'Assistant', `uiState.notifications[${index}].title`, { maxLength: 160 }),
        message: requireString(entry.message || '', `uiState.notifications[${index}].message`, { maxLength: 1000, allowEmpty: true }),
        tone: requireString(entry.tone || 'info', `uiState.notifications[${index}].tone`, { maxLength: 40 }),
        createdAt: requireString(entry.createdAt || new Date(0).toISOString(), `uiState.notifications[${index}].createdAt`, { maxLength: 80 })
      };
    })
  };
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
  if (!['snooze', 'stop', 'end', 'remove'].includes(action)) throw new TypeError('schedule action is not supported');
  const minutes = Math.max(1, Math.min(60, Number(payload.minutes) || 5));
  return { id, action: action === 'end' ? 'stop' : action, minutes };
}

function validateRemoteControl(payload = {}) {
  requirePlainObject(payload, 'remote');
  const targetId = requireString(payload.targetId || payload.target || '', 'remote.targetId', { maxLength: 40 });
  const action = requireString(payload.action || payload.command || '', 'remote.action', { maxLength: 40 });
  const allowedActions = new Set([
    'up',
    'down',
    'left',
    'right',
    'center',
    'playPause',
    'back',
    'fullscreen',
    'previous',
    'next',
    'seekBack',
    'seekForward',
    'slideshow',
    'exit'
  ]);
  if (!allowedActions.has(action)) throw new TypeError('remote action is not supported');
  const normalized = { targetId, action };
  if (payload.windowTitle !== undefined) {
    normalized.windowTitle = requireString(payload.windowTitle, 'remote.windowTitle', { maxLength: 220, allowEmpty: true });
  }
  if (payload.tabTitle !== undefined) {
    normalized.tabTitle = requireString(payload.tabTitle, 'remote.tabTitle', { maxLength: 220, allowEmpty: true });
  }
  const targetHandle = Number(payload.targetHandle || payload.handle || payload.matchedHandle || 0);
  if (Number.isSafeInteger(targetHandle) && targetHandle > 0) {
    normalized.targetHandle = targetHandle;
  }
  const targetProcessId = Number(payload.targetProcessId || payload.processId || 0);
  if (Number.isSafeInteger(targetProcessId) && targetProcessId > 0) {
    normalized.targetProcessId = targetProcessId;
  }
  if (payload.processName !== undefined) {
    normalized.processName = requireString(payload.processName, 'remote.processName', { maxLength: 80, allowEmpty: true });
  }
  return normalized;
}

function validateHomeDeviceId(payload = {}) {
  requirePlainObject(payload, 'homeOnboarding');
  const deviceId = requireString(payload.deviceId || '', 'homeOnboarding.deviceId', { maxLength: 160 });
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(deviceId)) throw new TypeError('homeOnboarding.deviceId is invalid');
  return { deviceId };
}

function validateHomeOnboardingSession(payload = {}) {
  requirePlainObject(payload, 'homeOnboarding');
  const sessionId = requireString(payload.sessionId || '', 'homeOnboarding.sessionId', { maxLength: 220 });
  if (!/^[A-Za-z0-9._:-]+$/.test(sessionId)) throw new TypeError('homeOnboarding.sessionId is invalid');
  return { sessionId };
}

function validateHomeOnboardingConfiguration(payload = {}) {
  const { sessionId } = validateHomeOnboardingSession(payload);
  const ssid = requireString(payload.ssid || '', 'homeOnboarding.ssid', { maxLength: 64 });
  const password = requireString(payload.password || '', 'homeOnboarding.password', { maxLength: 256 });
  const serverAddress = normalizeCloudUrl(payload.serverAddress || '');
  return { sessionId, ssid, password, serverAddress };
}

function validateHomeOnboardingApproval(payload = {}) {
  const { sessionId } = validateHomeOnboardingSession(payload);
  const ownerId = payload.ownerId === undefined
    ? undefined
    : requireString(payload.ownerId, 'homeOnboarding.ownerId', { maxLength: 160 });
  if (ownerId !== undefined && !/^[A-Za-z0-9._:-]{3,160}$/.test(ownerId)) throw new TypeError('homeOnboarding.ownerId is invalid');
  return { sessionId, ownerId };
}

function validateHomeDeviceOwnerId(payload = {}) {
  return payload.ownerId === undefined
    ? undefined
    : requireString(payload.ownerId, 'homeOnboarding.ownerId', { maxLength: 160 });
}

function validateHomeDeviceRename(payload = {}) {
  const { deviceId } = validateHomeDeviceId(payload);
  const deviceName = requireString(payload.deviceName || '', 'homeOnboarding.deviceName', { maxLength: 100 });
  const ownerId = validateHomeDeviceOwnerId(payload);
  return { deviceId, deviceName, ownerId };
}

function validateHomeDeviceRemoval(payload = {}) {
  const { deviceId } = validateHomeDeviceId(payload);
  const ownerId = validateHomeDeviceOwnerId(payload);
  return { deviceId, ownerId };
}

function validateHomeDiscoveredDevice(payload = {}) {
  requirePlainObject(payload, 'homeDevice');
  const deviceId = requireString(payload.deviceId || '', 'homeDevice.deviceId', { maxLength: 160 });
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(deviceId)) throw new TypeError('homeDevice.deviceId is invalid');
  const normalized = {
    deviceId,
    deviceName: requireString(payload.deviceName || payload.name || 'OpenX Home Device', 'homeDevice.deviceName', { maxLength: 100 }),
    firmwareVersion: requireString(payload.firmwareVersion || 'unknown', 'homeDevice.firmwareVersion', { maxLength: 80, allowEmpty: true }),
    protocolVersion: requireString(payload.protocolVersion || 'openx-home-v1', 'homeDevice.protocolVersion', { maxLength: 40, allowEmpty: true }),
    deviceStatus: requireString(payload.deviceStatus || payload.status || 'ready_for_setup', 'homeDevice.deviceStatus', { maxLength: 60, allowEmpty: true })
  };
  if (payload.connectionStatus !== undefined) {
    normalized.connectionStatus = requireString(payload.connectionStatus, 'homeDevice.connectionStatus', { maxLength: 40, allowEmpty: true });
  }
  if (payload.pairingStatus !== undefined) {
    normalized.pairingStatus = requireString(payload.pairingStatus, 'homeDevice.pairingStatus', { maxLength: 40, allowEmpty: true });
  }
  if (payload.configurationUrl !== undefined) {
    normalized.configurationUrl = normalizeCloudUrl(payload.configurationUrl);
  }
  if (payload.ipAddress !== undefined) {
    normalized.ipAddress = requireString(payload.ipAddress, 'homeDevice.ipAddress', { maxLength: 80, allowEmpty: true });
  }
  if (payload.discoverySource !== undefined || payload.source !== undefined) {
    normalized.discoverySource = requireString(
      payload.discoverySource || payload.source || '',
      'homeDevice.discoverySource',
      { maxLength: 80, allowEmpty: true }
    );
  }
  if (payload.transport !== undefined) {
    normalized.transport = requireString(payload.transport, 'homeDevice.transport', { maxLength: 40, allowEmpty: true });
  }
  if (payload.bluetoothDeviceId !== undefined) {
    normalized.bluetoothDeviceId = requireString(payload.bluetoothDeviceId, 'homeDevice.bluetoothDeviceId', { maxLength: 180, allowEmpty: true });
  }
  if (Array.isArray(payload.capabilities)) {
    normalized.capabilities = payload.capabilities
      .slice(0, 50)
      .map((capability, index) => requireString(String(capability || ''), `homeDevice.capabilities[${index}]`, { maxLength: 80, allowEmpty: true }))
      .filter(Boolean);
  }
  return normalized;
}

function validateCloudFileTransferAction(payload) {
  requirePlainObject(payload);
  const transferId = requireString(payload.transferId, 'transferId', { maxLength: 160 });
  const action = requireString(payload.action, 'action', { maxLength: 20 });
  if (!/^[A-Za-z0-9._:-]+$/.test(transferId)) throw new TypeError('transferId is invalid');
  if (!['accept', 'reject'].includes(action)) throw new TypeError('file transfer action is not supported');
  return { transferId, action };
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

function validateGalleryFaceAssign(payload) {
  requirePlainObject(payload);
  const clusterId = requireString(payload.clusterId, 'clusterId', { maxLength: 160 });
  const identityId = requireString(payload.identityId, 'identityId', { maxLength: 160 });
  if (!/^[A-Za-z0-9._:-]+$/.test(clusterId)) throw new TypeError('clusterId is invalid');
  if (!/^[A-Za-z0-9._:-]+$/.test(identityId)) throw new TypeError('identityId is invalid');
  return { clusterId, identityId };
}

function validateGalleryFaceRelationship(payload) {
  requirePlainObject(payload);
  const identityId = requireString(payload.identityId, 'identityId', { maxLength: 160 });
  if (!/^[A-Za-z0-9._:-]+$/.test(identityId)) throw new TypeError('identityId is invalid');
  return {
    identityId,
    relationship: typeof payload.relationship === 'string'
      ? payload.relationship.replace(/\s+/g, ' ').trim().slice(0, 80)
      : ''
  };
}

function validateGalleryFacePersonUpdate(payload) {
  const data = validateGalleryFaceRelationship(payload);
  const name = requireString(payload.name, 'name', { maxLength: 120 }).replace(/\s+/g, ' ').trim();
  if (!name) throw new TypeError('name is required');
  return { ...data, name };
}

function validateGalleryFaceIdentity(payload) {
  requirePlainObject(payload);
  const identityId = requireString(payload.identityId, 'identityId', { maxLength: 160 });
  if (!/^[A-Za-z0-9._:-]+$/.test(identityId)) throw new TypeError('identityId is invalid');
  return { identityId };
}

function validateGalleryFaceCluster(payload) {
  requirePlainObject(payload);
  const clusterId = requireString(payload.clusterId, 'clusterId', { maxLength: 160 });
  if (!/^[A-Za-z0-9._:-]+$/.test(clusterId)) throw new TypeError('clusterId is invalid');
  return { clusterId };
}

function validateGalleryPeopleScan(payload = {}) {
  if (payload === undefined) return { maxPhotos: null };
  requirePlainObject(payload);
  const requestedMaxPhotos = Number(payload.maxPhotos);
  return {
    maxPhotos: Number.isFinite(requestedMaxPhotos) && requestedMaxPhotos > 0
      ? Math.max(1, Math.min(500000, Math.floor(requestedMaxPhotos)))
      : null,
    rescan: payload.rescan === true,
    incremental: payload.incremental === false ? false : true
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
  'window:hideChat': validateEmpty,
  'window:openPeopleChat': validateEmpty,
  'window:openSettings': validateEmpty,
  'window:openPlanner': validatePlannerView,
  'window:closePlanner': validateEmpty,
  'window:openGallery': validateGalleryView,
  'window:closeGallery': validateEmpty,
  'config:get': validateEmpty,
  'settings:get': validateEmpty,
  'assistantChatHistory:get': validateEmpty,
  'assistantChatHistory:getSync': validateEmpty,
  'assistantChatHistory:save': validateChatHistorySave,
  'assistantChatHistory:saveSync': validateChatHistorySave,
  'assistantChatHistory:clear': validateEmpty,
  'desktopChat:list': validateDesktopChatList,
  'desktopChat:open': validateDesktopChatOpen,
  'desktopChat:create': validateDesktopChatCreate,
  'desktopChat:update': validateDesktopChatUpdate,
  'desktopChat:delete': validateDesktopChatOpen,
  'desktopChat:send': validateDesktopChatSend,
  'desktopChat:quickReply': validateDesktopChatQuickReply,
  'desktopChat:contacts:list': validateEmpty,
  'desktopChat:contacts:accept': validateDesktopChatRequestAction,
  'desktopChat:contacts:delete': validateDesktopChatRequestAction,
  'desktopChat:contacts:cancel': validateDesktopChatRequestAction,
  'desktopChat:registration:get': validateEmpty,
  'desktopChat:registration:start': validateDesktopChatRegistrationStart,
  'desktopChat:profile:password': validateDesktopChatPasswordUpdate,
  'desktopChat:uiState': validateDesktopChatUiState,
  'remote:listTargets': validateEmpty,
  'remote:control': validateRemoteControl,
  'homeOnboarding:snapshot': validateEmpty,
  'homeOnboarding:getBluetoothSelection': validateEmpty,
  'homeOnboarding:startDiscovery': validateEmpty,
  'homeOnboarding:stopDiscovery': validateEmpty,
  'homeOnboarding:addDiscoveredDevice': validateHomeDiscoveredDevice,
  'homeOnboarding:start': validateHomeDeviceId,
  'homeOnboarding:configure': validateHomeOnboardingConfiguration,
  'homeOnboarding:waitForConnection': validateHomeOnboardingSession,
  'homeOnboarding:approve': validateHomeOnboardingApproval,
  'homeOnboarding:renameDevice': validateHomeDeviceRename,
  'homeOnboarding:removeDevice': validateHomeDeviceRemoval,
  'homeOnboarding:refreshDevice': validateHomeDeviceId,
  'homeOnboarding:finish': validateHomeOnboardingSession,
  'homeOnboarding:cancel': validateHomeOnboardingSession,
  'uiState:get': validateEmpty,
  'uiState:save': validateUiState,
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
  'cloud:fileTransferAction': validateCloudFileTransferAction,
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
  'gallery:setFaceRelationship': validateGalleryFaceRelationship,
  'gallery:updateFacePerson': validateGalleryFacePersonUpdate,
  'gallery:deleteFacePerson': validateGalleryFaceIdentity,
  'gallery:addFaceToPerson': validateGalleryFaceAssign,
  'gallery:removeFaceCluster': validateGalleryFaceCluster,
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
