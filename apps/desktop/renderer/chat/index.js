const messagesEl = document.getElementById('messages');
const inputBox = document.getElementById('input-box');
const sendBtn = document.getElementById('send-btn');
const closeBtn = document.getElementById('close-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const settingsNavEl = document.getElementById('settings-nav');
const settingsNavButtons = document.querySelectorAll('.settings-nav-chip');
const settingsSections = document.querySelectorAll('[data-settings-section]');
const systemOptionsEl = document.getElementById('system-options');
const systemOptionButtons = document.querySelectorAll('.system-option');
const systemBlocks = document.querySelectorAll('[data-system-block]');
const themeGrid = document.getElementById('theme-grid');
const settingsStatusEl = document.getElementById('settings-status');
const modeGridEl = document.getElementById('mode-grid');
const modeUsageEl = document.getElementById('mode-usage');
const modeAddBtn = document.getElementById('mode-add-btn');
const profileEditBtn = document.getElementById('profile-edit-btn');
const profileEditorEl = document.getElementById('profile-editor');
const profileSummaryListEl = document.getElementById('profile-summary-list');
const cloudConnectionStateEl = document.getElementById('cloud-connection-state');
const cloudRelayUrlEl = document.getElementById('cloud-relay-url');
const cloudAutoConnectEl = document.getElementById('cloud-auto-connect');
const cloudReconnectEnabledEl = document.getElementById('cloud-reconnect-enabled');
const cloudHeartbeatEnabledEl = document.getElementById('cloud-heartbeat-enabled');
const cloudConnectionTimeoutEl = document.getElementById('cloud-connection-timeout');
const cloudLastConnectedEl = document.getElementById('cloud-last-connected');
const cloudDurationEl = document.getElementById('cloud-duration');
const cloudPingEl = document.getElementById('cloud-ping');
const cloudReconnectAttemptsEl = document.getElementById('cloud-reconnect-attempts');
const cloudConnectBtn = document.getElementById('cloud-connect-btn');
const cloudFriendlyStatusEl = document.getElementById('cloud-friendly-status');
const cloudGenerateQrBtn = document.getElementById('cloud-generate-qr-btn');
const cloudPairingStatusEl = document.getElementById('cloud-pairing-status');
const cloudPairingQrEl = document.getElementById('cloud-pairing-qr');
const cloudPairingExpiryEl = document.getElementById('cloud-pairing-expiry');
const cloudPairingCountdownEl = document.getElementById('cloud-pairing-countdown');
const cloudPairingRequestsEl = document.getElementById('cloud-pairing-requests');
const mobileSettingsToggle = document.getElementById('mobile-settings-toggle');
const mobileServerDetailsOverlay = document.getElementById('mobile-server-info-overlay');
const mobileServerDetailsCloseBtn = document.getElementById('mobile-server-details-close');
const mobileView = document.getElementById('mobile-view');
const mobileAppCloseBtn = document.getElementById('mobile-app-close-btn');
const mobileAppPanelEl = document.getElementById('mobile-app-panel');
const mobileQrStageEl = document.getElementById('mobile-qr-stage');
const mobileConnectedSummaryEl = document.getElementById('mobile-connected-summary');
const mobileConnectedDeviceNameEl = document.getElementById('mobile-connected-device-name');
const mobileConnectedDeviceMetaEl = document.getElementById('mobile-connected-device-meta');
const securityLockStatusEl = document.getElementById('security-lock-status');
const securityRefreshBtn = document.getElementById('security-refresh-btn');
const securityCurrentPasswordEl = document.getElementById('security-current-password');
const securityNewPasswordEl = document.getElementById('security-new-password');
const securityConfirmPasswordEl = document.getElementById('security-confirm-password');
const securitySavePasswordBtn = document.getElementById('security-save-password-btn');
const securityPasswordMessageEl = document.getElementById('security-password-message');
const clearChatHistoryBtn = document.getElementById('clear-chat-history-btn');
const chatStorageStatusEl = document.getElementById('chat-storage-status');
const phoneDeviceListEl = document.getElementById('phone-device-list');
const deviceSearchEl = document.getElementById('device-search');
const deviceFilterEl = document.getElementById('device-filter');
const deviceSortEl = document.getElementById('device-sort');
const deviceRefreshBtn = document.getElementById('device-refresh-btn');
const phonePanels = document.querySelectorAll('[data-phone-panel]');
const phoneDeviceRemoveDialog = document.getElementById('phone-device-remove-dialog');
const phoneDeviceRemoveMessage = document.getElementById('phone-device-remove-message');
const phoneDeviceRemoveCancel = document.getElementById('phone-device-remove-cancel');
const phoneDeviceRemoveConfirm = document.getElementById('phone-device-remove-confirm');
const securityUnlockDialog = document.getElementById('security-unlock-dialog');
const securityUnlockMessage = document.getElementById('security-unlock-message');
const securityUnlockPasswordEl = document.getElementById('security-unlock-password');
const securityUnlockCancel = document.getElementById('security-unlock-cancel');
const securityUnlockConfirm = document.getElementById('security-unlock-confirm');
const viewSwitcherEl = document.getElementById('view-switcher');
const chatViewBtn = document.getElementById('chat-view-btn');
const activityViewBtn = document.getElementById('activity-view-btn');
const appsViewBtn = document.getElementById('apps-view-btn');
const remoteViewBtn = document.getElementById('remote-view-btn');
const calendarAppBtn = document.getElementById('calendar-app-btn');
const remindersAppBtn = document.getElementById('reminders-app-btn');
const mobileAppBtn = document.getElementById('mobile-app-btn');
const homeAutomationAppBtn = document.getElementById('home-automation-app-btn');
const settingsAppBtn = document.getElementById('settings-app-btn');
const conversationView = document.getElementById('conversation-view');
const activityView = document.getElementById('activity-view');
const remindersView = document.getElementById('reminders-view');
const remoteView = document.getElementById('remote-view');
const homeAutomationView = document.getElementById('home-automation-view');
const homeAutomationCloseBtn = document.getElementById('home-automation-close-btn');
const homeDiscoveryStatusEl = document.getElementById('home-discovery-status');
const homeDiscoveryRefreshBtn = document.getElementById('home-discovery-refresh-btn');
const homeFoundCountEl = document.getElementById('home-found-count');
const homeOnlineCountEl = document.getElementById('home-online-count');
const homePairedCountEl = document.getElementById('home-paired-count');
const homeDiscoveryBannerEl = document.getElementById('home-discovery-banner');
const homeDiscoveryBannerDetailEl = document.getElementById('home-discovery-banner-detail');
const homeDiscoveryConfigureBtn = document.getElementById('home-discovery-configure-btn');
const homeDeviceListEl = document.getElementById('home-device-list');
const homeConnectedListEl = document.getElementById('home-connected-list');
const homeOnboardingProgressEl = document.getElementById('home-onboarding-progress');
const homeWizardEmptyEl = document.getElementById('home-wizard-empty');
const homeWizardSteps = document.querySelectorAll('[data-home-step]');
const homeWizardDeviceNameInputEl = document.getElementById('home-wizard-device-name-input');
const homeWizardDeviceIdHintEl = document.getElementById('home-wizard-device-id-hint');
const homeWizardDeviceFirmwareEl = document.getElementById('home-wizard-device-firmware');
const homeDeviceNextBtn = document.getElementById('home-device-next-btn');
const homeOnboardingCancelBtn = document.getElementById('home-onboarding-cancel-btn');
const homeWifiSsidEl = document.getElementById('home-wifi-ssid');
const homeWifiPasswordEl = document.getElementById('home-wifi-password');
const homeWifiPasswordToggleBtn = document.getElementById('home-wifi-password-toggle');
const homeWifiBackBtn = document.getElementById('home-wifi-back-btn');
const homeWifiNextBtn = document.getElementById('home-wifi-next-btn');
const homeServerAddressEl = document.getElementById('home-server-address');
const homeServerBackBtn = document.getElementById('home-server-back-btn');
const homeSendConfigBtn = document.getElementById('home-send-config-btn');
const homeConnectingTitleEl = document.getElementById('home-connecting-title');
const homeConnectingDetailEl = document.getElementById('home-connecting-detail');
const homeConnectingActionsEl = document.getElementById('home-connecting-actions');
const homeConnectingRetryBtn = document.getElementById('home-connecting-retry-btn');
const homeConnectingCancelBtn = document.getElementById('home-connecting-cancel-btn');
const homeApprovalDeviceNameEl = document.getElementById('home-approval-device-name');
const homeApprovePairingBtn = document.getElementById('home-approve-pairing-btn');
const homeRejectPairingBtn = document.getElementById('home-reject-pairing-btn');
const homeFinishBtn = document.getElementById('home-finish-btn');
const homeOnboardingStatusEl = document.getElementById('home-onboarding-status');
const appsView = document.getElementById('apps-view');
const remoteAppSummaryEl = document.getElementById('remote-app-summary');
const remoteAppCloseBtn = document.getElementById('remote-app-close-btn');
const remoteTargetSelectEl = document.getElementById('remote-target-select');
const remoteRefreshBtn = document.getElementById('remote-refresh-btn');
const remoteControlButtons = document.querySelectorAll('[data-remote-action]');
const remoteStatusEl = document.getElementById('remote-status');
const activityBadge = document.getElementById('activity-badge');
const scheduleListEl = document.getElementById('schedule-list');
const scheduleCountEl = document.getElementById('schedule-count');
const remindersAppSummaryEl = document.getElementById('reminders-app-summary');
const remindersAppCloseBtn = document.getElementById('reminders-app-close-btn');
const remindersAppTabs = document.querySelectorAll('.reminders-app-tab');
const remindersAppPanels = document.querySelectorAll('[data-reminders-panel]');
const remindersTotalRemindersEl = document.getElementById('reminders-total-reminders');
const remindersTotalAlarmsEl = document.getElementById('reminders-total-alarms');
const dailyRemindersListEl = document.getElementById('daily-reminders-list');
const normalRemindersListEl = document.getElementById('normal-reminders-list');
const dailyAlarmsListEl = document.getElementById('daily-alarms-list');
const normalAlarmsListEl = document.getElementById('normal-alarms-list');
const dailyRemindersCountEl = document.getElementById('daily-reminders-count');
const normalRemindersCountEl = document.getElementById('normal-reminders-count');
const dailyAlarmsCountEl = document.getElementById('daily-alarms-count');
const normalAlarmsCountEl = document.getElementById('normal-alarms-count');
const notificationListEl = document.getElementById('notification-list');
const toastRegionEl = document.getElementById('toast-region');

const MODE_LIMIT = 5;
const MODE_APP_LIMIT = 5;
const SCHEDULE_STORAGE_KEY = 'openx-ui-schedules-v1';
const NOTIFICATION_STORAGE_KEY = 'openx-ui-notifications-v1';
const ASSISTANT_CHAT_HISTORY_STORAGE_KEY = 'openx-ui-chat-history-v2';
const UI_STATE_STORAGE_KEY = 'openx-ui-state-v1';
const MAX_NOTIFICATION_HISTORY = 30;
const DEFAULT_CHAT_HISTORY_LIMIT = 300;
const MIN_CHAT_HISTORY_LIMIT = 50;
const MAX_CHAT_HISTORY_LIMIT = 1000;
const MAX_RENDERED_MESSAGES = MAX_CHAT_HISTORY_LIMIT;
const REMOTE_TARGET_REFRESH_TTL_MS = 2500;
const HOME_CONNECTION_WAIT_DELAY_MS = 700;
const HOME_BLE_SERVICE_UUID = '6f18c610-7a95-4a5d-9f7a-5f1fd7f3a201';
const HOME_BLE_DEVICE_INFO_UUID = '6f18c611-7a95-4a5d-9f7a-5f1fd7f3a201';
const HOME_BLE_CONFIGURATION_UUID = '6f18c612-7a95-4a5d-9f7a-5f1fd7f3a201';
const HOME_BLE_STATUS_UUID = '6f18c613-7a95-4a5d-9f7a-5f1fd7f3a201';
const HOME_BLE_CONFIG_MAX_BYTES = 768;
const HOME_DEVICE_ID_PATTERN = /^[A-Za-z0-9._:-]{3,160}$/;
const HOME_ONBOARDING_UI_STEPS = Object.freeze(['device', 'wifi', 'server', 'connecting', 'approval', 'complete']);
const HOME_ONBOARDING_STEP_PROGRESS = Object.freeze({
  device: 12,
  wifi: 28,
  server: 44,
  connecting: 68,
  approval: 84,
  complete: 100
});
const SCHEDULE_SYNC_FAILURE_TOAST_COOLDOWN_MS = 60000;
const REMOTE_DIRECTION_ACTIONS = Object.freeze(['up', 'down', 'left', 'right', 'center']);
const REMOTE_ACTIONS_BY_PROFILE = Object.freeze({
  youtube: Object.freeze(['previous', 'playPause', 'next', 'seekBack', 'seekForward', 'fullscreen', 'back']),
  spotify: Object.freeze(['previous', 'playPause', 'next', 'back']),
  powerpoint: Object.freeze(['slideshow', 'previous', 'next', 'exit']),
  instagram: Object.freeze(['back', 'center', 'left', 'right']),
  media: Object.freeze(['previous', 'playPause', 'next', 'fullscreen', 'back']),
  presentation: Object.freeze(['slideshow', 'previous', 'next', 'exit']),
  social: Object.freeze(['back', 'center', 'left', 'right']),
  default: Object.freeze(['back', 'center', 'fullscreen'])
});
const STORAGE_SAVE_DEBOUNCE_MS = 180;


let isProcessing = false;
let pendingConfirmation = null;
let settingsSnapshot = null;
let settingsSaveTimer = null;
let settingsSaveQueue = Promise.resolve();
let selectedThemeId = 'graphite';
let activeSettingsSection = null;
let activeSystemBlock = 'identity';
let activePhonePanel = 'connect';
let profileEditorOpen = false;
let hasRenderedWelcome = false;
let modeDrafts = [];
let selectedModeIndex = 0;
const selectedModeApps = new Map();
let activeWorkspaceView = 'chat';
let activeRemindersTab = 'reminders';
let remoteTargets = [];
let selectedRemoteTargetKey = '';
let remoteTargetsLoading = false;
let remoteTargetsRenderFrame = null;
let remoteTargetsLastLoadedAt = 0;
let homeOnboardingSnapshot = null;
let homeActiveSession = null;
let homeSelectedDeviceId = '';
let homeManualStep = '';
let homeAutoConnectionTimer = null;
let homeKnownDeviceIds = new Set();
const homeBluetoothDevices = new Map();
let homeUserRequestedScan = false;
let homeScanInProgress = false;
let homeRenamingDeviceId = '';
let homeRemovingDeviceId = '';
let homeWizardNameDeviceId = '';
let homeReconnectingDeviceId = '';
let scheduleItems = [];
let notificationHistory = [];
let conversationHistory = [];
let conversationReady = false;
let conversationReadyPromise = null;
let scheduleSyncFailureToastAt = 0;
let glassTintAnimationFrame = null;
let pendingPhoneDeviceRemoval = null;
let pendingSecurityUnlock = null;
let pendingGlassTintValue = 42;
let latestManagedDevices = [];
let messageScrollAnimationFrame = null;
let renderedMessageCount = messagesEl ? messagesEl.querySelectorAll('.message').length : 0;
let cloudPairingCountdownHandle = null;
let settingsStatusPollHandle = null;
let settingsStatusPollInFlight = false;
let latestCloudStatus = null;
let imagePreviewKeydownHandler = null;
let chatHistorySaveQueue = Promise.resolve();
let uiStateSaveQueue = Promise.resolve();
let chatHistorySaveTimer = null;
let uiStateSaveTimer = null;
let pendingChatHistoryEntries = null;
let pendingUiState = null;
const scheduleTimers = new Map();

const fieldIds = {
  assistantDisplayName: 'assistant-display-name',
  assistantHonorific: 'assistant-honorific',
  profileFullName: 'profile-full-name',
  profileFirstName: 'profile-first-name',
  profileMiddleName: 'profile-middle-name',
  profileLastName: 'profile-last-name',
  profileEmail: 'profile-email',
  profilePhone: 'profile-phone',
  profileDateOfBirth: 'profile-date-of-birth',
  profileGender: 'profile-gender',
  profileNationality: 'profile-nationality',
  profileUsername: 'profile-username',
  profileAddressLine1: 'profile-address-line1',
  profileAddressLine2: 'profile-address-line2',
  profileCity: 'profile-city',
  profileState: 'profile-state',
  profilePostalCode: 'profile-postal-code',
  profileCountry: 'profile-country',
  profileCompany: 'profile-company',
  profileJobTitle: 'profile-job-title',
  profileDepartment: 'profile-department',
  profileRole: 'profile-role',
  profileWebsite: 'profile-website',
  profileLinkedin: 'profile-linkedin',
  profileGithub: 'profile-github',
  profileTwitter: 'profile-twitter',
  chatMaxHistory: 'chat-max-history',
  glassTint: 'glass-tint',
  systemPermissionLevel: 'system-permission-level',
  cloudRelayUrl: 'cloud-relay-url',
  cloudAutoConnect: 'cloud-auto-connect',
  cloudReconnectEnabled: 'cloud-reconnect-enabled',
  cloudHeartbeatEnabled: 'cloud-heartbeat-enabled',
  cloudConnectionTimeout: 'cloud-connection-timeout'
};

const PROFILE_SUMMARY_FIELDS = [
  { key: 'fullName', label: 'Name', fieldId: fieldIds.profileFullName },
  { key: 'email', label: 'Email', fieldId: fieldIds.profileEmail },
  { key: 'phone', label: 'Phone', fieldId: fieldIds.profilePhone },
  { key: 'jobTitle', label: 'Job Title', fieldId: fieldIds.profileJobTitle },
  { key: 'company', label: 'Company', fieldId: fieldIds.profileCompany },
  { key: 'role', label: 'Role', fieldId: fieldIds.profileRole },
  { key: 'addressLine1', label: 'Address', fieldId: fieldIds.profileAddressLine1 },
  { key: 'city', label: 'City', fieldId: fieldIds.profileCity },
  { key: 'state', label: 'State', fieldId: fieldIds.profileState },
  { key: 'postalCode', label: 'Postal Code', fieldId: fieldIds.profilePostalCode },
  { key: 'country', label: 'Country', fieldId: fieldIds.profileCountry },
  { key: 'username', label: 'Username', fieldId: fieldIds.profileUsername },
  { key: 'website', label: 'Website', fieldId: fieldIds.profileWebsite }
];

function getAssistantDisplayName() {
  return settingsSnapshot?.settings?.assistant?.displayName || 'OpenX';
}

function getHonorific() {
  return settingsSnapshot?.settings?.assistant?.honorific || 'sir';
}

function assistantMeta(label = 'just now') {
  return `${getAssistantDisplayName()} - ${label}`;
}

function loadStoredList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (error) {
    return [];
  }
}

function removeStoredValue(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {}
}

function loadStoredObject(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (error) {
    return {};
  }
}

function clampChatHistoryLimit(value, fallback = DEFAULT_CHAT_HISTORY_LIMIT) {
  const numeric = Math.floor(Number(value));
  const resolved = Number.isFinite(numeric) ? numeric : fallback;
  return Math.max(MIN_CHAT_HISTORY_LIMIT, Math.min(MAX_CHAT_HISTORY_LIMIT, resolved));
}

function chatHistoryLimit(options = {}) {
  const configured = settingsSnapshot?.settings?.chat?.maxHistory;
  if (configured === undefined || configured === null) {
    return options.allowPreSettingsMax === true ? MAX_CHAT_HISTORY_LIMIT : DEFAULT_CHAT_HISTORY_LIMIT;
  }
  return clampChatHistoryLimit(configured);
}

function redactSensitiveText(value) {
  return String(value || '')
    .replace(/\b(password|passcode|token|api\s*key|secret|authorization|bearer)\s*[:=]\s*[^\s,;]+/gi, '$1: [redacted]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[email redacted]')
    .slice(0, 4000);
}

function normalizeChatHistoryItem(item = {}) {
  const type = ['user', 'assistant', 'system'].includes(item.type) ? item.type : 'system';
  const text = redactSensitiveText(item.text);
  if (!text) return null;
  return {
    text,
    type,
    meta: redactSensitiveText(item.meta).slice(0, 120),
    createdAt: Number(item.createdAt) || Date.now()
  };
}

function normalizeChatHistoryItems(items = [], limit = MAX_CHAT_HISTORY_LIMIT) {
  return (Array.isArray(items) ? items : [])
    .map(normalizeChatHistoryItem)
    .filter(Boolean)
    .slice(-clampChatHistoryLimit(limit, MAX_CHAT_HISTORY_LIMIT));
}

function mergeChatHistory(left = [], right = [], limit = MAX_CHAT_HISTORY_LIMIT) {
  const merged = [];
  const seen = new Set();
  [...left, ...right].forEach(item => {
    const normalized = normalizeChatHistoryItem(item);
    if (!normalized) return;
    const key = `${normalized.createdAt}:${normalized.type}:${normalized.text}:${normalized.meta}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(normalized);
  });
  return merged
    .sort((a, b) => Number(a.createdAt) - Number(b.createdAt))
    .slice(-clampChatHistoryLimit(limit, MAX_CHAT_HISTORY_LIMIT));
}

function updateChatStorageStatus(count = conversationHistory.length) {
  if (!chatStorageStatusEl) return;
  const root = settingsSnapshot?.dataRoot ? ` in ${settingsSnapshot.dataRoot}` : ' in OpenX_Data';
  chatStorageStatusEl.textContent = `${Math.max(0, Number(count) || 0)} messages stored${root}.`;
}

async function loadConversationHistory() {
  const legacy = normalizeChatHistoryItems(loadStoredList(ASSISTANT_CHAT_HISTORY_STORAGE_KEY));
  const getAssistantHistorySync = window.openx?.getAssistantChatHistorySync;
  const getAssistantHistory = window.openx?.getAssistantChatHistory;
  if (!getAssistantHistorySync && !getAssistantHistory) {
    updateChatStorageStatus(legacy.length);
    return legacy;
  }

  let stored = [];
  let loadedSync = false;
  if (getAssistantHistorySync) {
    try {
      const result = getAssistantHistorySync();
      stored = normalizeChatHistoryItems(result?.entries || []);
      loadedSync = true;
    } catch (_) {
      stored = [];
    }
  }
  try {
    if (!loadedSync && getAssistantHistory) {
      const result = await getAssistantHistory();
      stored = mergeChatHistory(stored, normalizeChatHistoryItems(result?.entries || []));
    }
  } catch (_) {
    // Keep the synchronous snapshot when the async refresh fails.
  }

  const merged = legacy.length > 0 ? mergeChatHistory(stored, legacy) : stored;
  if (legacy.length > 0) {
    const saveAssistantHistorySync = window.openx?.saveAssistantChatHistorySync;
    const saveAssistantHistory = window.openx?.saveAssistantChatHistory;
    if (saveAssistantHistorySync || saveAssistantHistory) {
      try {
        if (saveAssistantHistorySync) {
          saveAssistantHistorySync(merged);
        } else {
          await saveAssistantHistory(merged);
        }
      } catch (_) {}
    }
    removeStoredValue(ASSISTANT_CHAT_HISTORY_STORAGE_KEY);
  }
  updateChatStorageStatus(merged.length);
  return merged.slice(-MAX_CHAT_HISTORY_LIMIT);
}

function persistConversationHistory(entries = conversationHistory) {
  const snapshot = normalizeChatHistoryItems(entries).slice(-chatHistoryLimit());
  const saveAssistantHistorySync = window.openx?.saveAssistantChatHistorySync;
  const saveAssistantHistory = window.openx?.saveAssistantChatHistory;
  if (saveAssistantHistorySync) {
    try {
      saveAssistantHistorySync(snapshot);
      return chatHistorySaveQueue;
    } catch (_) {}
  }
  if (!saveAssistantHistory) {
    return chatHistorySaveQueue;
  }
  chatHistorySaveQueue = chatHistorySaveQueue
    .catch(() => {})
    .then(() => saveAssistantHistory(snapshot))
    .catch(() => {});
  return chatHistorySaveQueue;
}

function persistConversationHistoryFallback(entries = conversationHistory) {
  return normalizeChatHistoryItems(entries).slice(-chatHistoryLimit());
}

function flushConversationHistorySave() {
  if (chatHistorySaveTimer) {
    clearTimeout(chatHistorySaveTimer);
    chatHistorySaveTimer = null;
  }
  if (!pendingChatHistoryEntries) return chatHistorySaveQueue;
  const entries = pendingChatHistoryEntries;
  pendingChatHistoryEntries = null;
  return persistConversationHistory(entries);
}

function saveConversationHistory(options = {}) {
  conversationHistory = conversationHistory
    .map(normalizeChatHistoryItem)
    .filter(Boolean)
    .slice(-chatHistoryLimit());
  updateChatStorageStatus(conversationHistory.length);
  pendingChatHistoryEntries = conversationHistory.slice();
  if (options.immediate === true) {
    return flushConversationHistorySave();
  }
  if (!chatHistorySaveTimer) {
    chatHistorySaveTimer = setTimeout(() => {
      chatHistorySaveTimer = null;
      flushConversationHistorySave();
    }, STORAGE_SAVE_DEBOUNCE_MS);
  }
  return chatHistorySaveQueue;
}

function rememberConversationMessage(text, type, meta) {
  const item = normalizeChatHistoryItem({ text, type, meta, createdAt: Date.now() });
  if (!item) return;
  conversationHistory.push(item);
  saveConversationHistory();
}

async function closeChatWindow() {
  await ensureConversationReady();
  persistConversationHistoryFallback();
  try {
    await flushConversationHistorySave();
  } catch (_) {}
  if (window.openx?.hideChat) {
    try {
      await window.openx.hideChat();
      return;
    } catch (_) {}
  }
  window.close();
}

function normalizeUiNotification(item = {}) {
  const title = redactSensitiveText(item.title || 'Assistant').slice(0, 160);
  const message = redactSensitiveText(item.message || '').slice(0, 1000);
  if (!title && !message) return null;
  return {
    id: String(item.id || `notice-${Date.now()}`).slice(0, 160),
    title: title || 'Assistant',
    message,
    tone: String(item.tone || 'info').slice(0, 40),
    createdAt: Number.isFinite(Date.parse(item.createdAt || '')) ? item.createdAt : new Date().toISOString()
  };
}

function normalizeUiState(state = {}) {
  const schedules = (Array.isArray(state.schedules) ? state.schedules : [])
    .map(normalizeScheduleForActivity)
    .filter(Boolean)
    .slice(0, 80);
  const notifications = (Array.isArray(state.notifications) ? state.notifications : [])
    .map(normalizeUiNotification)
    .filter(Boolean)
    .slice(0, MAX_NOTIFICATION_HISTORY);
  return {
    schedules,
    notifications
  };
}

function currentUiState() {
  return normalizeUiState({
    schedules: scheduleItems,
    notifications: notificationHistory
  });
}

function loadLegacyUiState() {
  const packed = loadStoredObject(UI_STATE_STORAGE_KEY);
  return normalizeUiState({
    schedules: [
      ...(Array.isArray(packed.schedules) ? packed.schedules : []),
      ...loadStoredList(SCHEDULE_STORAGE_KEY)
    ],
    notifications: [
      ...(Array.isArray(packed.notifications) ? packed.notifications : []),
      ...loadStoredList(NOTIFICATION_STORAGE_KEY)
    ]
  });
}

function clearLegacyUiStateStorage() {
  [UI_STATE_STORAGE_KEY, SCHEDULE_STORAGE_KEY, NOTIFICATION_STORAGE_KEY].forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  });
}

function persistUiState(state = currentUiState()) {
  if (!window.openx?.saveUiState) {
    return uiStateSaveQueue;
  }
  uiStateSaveQueue = uiStateSaveQueue
    .catch(() => {})
    .then(() => window.openx.saveUiState(state))
    .catch(() => {});
  return uiStateSaveQueue;
}

function flushUiStateSave() {
  if (uiStateSaveTimer) {
    clearTimeout(uiStateSaveTimer);
    uiStateSaveTimer = null;
  }
  if (!pendingUiState) return uiStateSaveQueue;
  const state = pendingUiState;
  pendingUiState = null;
  return persistUiState(state);
}

function saveUiState(options = {}) {
  const state = currentUiState();
  pendingUiState = state;
  if (options.immediate === true) {
    return flushUiStateSave();
  }
  if (!uiStateSaveTimer) {
    uiStateSaveTimer = setTimeout(() => {
      uiStateSaveTimer = null;
      flushUiStateSave();
    }, STORAGE_SAVE_DEBOUNCE_MS);
  }
  return uiStateSaveQueue;
}

async function loadUiState() {
  const legacy = loadLegacyUiState();
  if (!window.openx?.getUiState) {
    scheduleItems = legacy.schedules;
    notificationHistory = legacy.notifications;
    return;
  }

  let stored = normalizeUiState();
  try {
    const result = await window.openx.getUiState();
    stored = normalizeUiState(result?.state || {});
  } catch (_) {
    stored = normalizeUiState();
  }

  scheduleItems = stored.schedules.length > 0 ? stored.schedules : legacy.schedules;
  notificationHistory = stored.notifications.length > 0 ? stored.notifications : legacy.notifications;
  if (legacy.schedules.length > 0 || legacy.notifications.length > 0) {
    clearLegacyUiStateStorage();
    await saveUiState({ immediate: true });
  }
}

async function restoreConversationHistory() {
  if (!messagesEl) return 0;
  conversationHistory = (await loadConversationHistory()).slice(-chatHistoryLimit({ allowPreSettingsMax: true }));
  messagesEl.replaceChildren();
  renderedMessageCount = 0;
  conversationHistory.forEach(item => {
    addMessage(item.text, item.type, item.meta, { persist: false });
  });
  hasRenderedWelcome = conversationHistory.length > 0;
  return conversationHistory.length;
}

function repaintConversationIfBlank() {
  if (!messagesEl || messagesEl.querySelector('.message') || conversationHistory.length === 0) return;
  messagesEl.replaceChildren();
  renderedMessageCount = 0;
  conversationHistory.slice(-chatHistoryLimit({ allowPreSettingsMax: true })).forEach(item => {
    addMessage(item.text, item.type, item.meta, { persist: false });
  });
  hasRenderedWelcome = true;
}

function normalizeResultEntries(result) {
  const intent = String(result?.intent || '');
  if (intent === 'browser.search') {
    const sources = Array.isArray(result?.data?.searchSummary?.sources)
      ? result.data.searchSummary.sources
      : (Array.isArray(result?.data?.results) ? result.data.results : []);
    return sources.slice(0, 4).map((entry, index) => ({
      index: index + 1,
      name: String(entry?.title || entry?.sourceDomain || `Source ${index + 1}`),
      type: 'web',
      path: String(entry?.url || ''),
      location: String(entry?.sourceDomain || ''),
      snippet: String(entry?.snippet || ''),
      sizeMB: 0,
      matchScore: Number(entry?.score || 0)
    }));
  }
  if (['reminder.list', 'alarm.list', 'timer.list'].includes(intent)) {
    const entries = Array.isArray(result?.data?.entries) ? result.data.entries : [];
    return entries.slice(0, 8).map((entry, index) => ({
      index: index + 1,
      name: String(entry?.message || entry?.title || `Schedule ${index + 1}`),
      type: 'schedule',
      path: String(entry?.dueAt || ''),
      location: String(entry?.kind || (intent === 'alarm.list' ? 'Alarm' : intent === 'timer.list' ? 'Timer' : 'Reminder')),
      snippet: [
        entry?.dueAt ? formatDueDate(entry.dueAt) : '',
        entry?.recurrence ? `repeats ${String(entry.recurrence).replace(/[:-]/g, ' ')}` : '',
        entry?.status ? String(entry.status) : ''
      ].filter(Boolean).join(' - '),
      sizeMB: 0,
      matchScore: 0
    }));
  }
  if (!['file.search', 'folder.search', 'file.smartFind', 'file.list'].includes(intent)) {
    return [];
  }
  const entries = Array.isArray(result?.data?.entries) ? result.data.entries : [];
  return entries.slice(0, 6).map((entry, index) => ({
    index: index + 1,
    name: String(entry?.name || entry?.path?.split(/[\\/]/).filter(Boolean).pop() || `Result ${index + 1}`),
    type: String(entry?.type || (intent === 'folder.search' ? 'folder' : 'file')),
    path: String(entry?.path || ''),
    location: String(entry?.location || ''),
    sizeMB: Number(entry?.sizeMB || 0),
    matchScore: Number(entry?.matchScore || 0)
  }));
}

function addResultCards(bubble, resultEntries) {
  if (!Array.isArray(resultEntries) || resultEntries.length === 0) return;
  const list = document.createElement('ol');
  list.className = 'message-result-list';
  for (const entry of resultEntries) {
    const item = document.createElement('li');
    item.className = `message-result ${entry.type === 'folder' ? 'folder-result' : entry.type === 'web' ? 'web-result' : entry.type === 'schedule' ? 'schedule-result' : 'file-result'}`;
    const icon = document.createElement('span');
    icon.className = 'message-result-icon';
    icon.textContent = entry.type === 'folder' ? 'Folder' : entry.type === 'web' ? 'Web' : entry.type === 'schedule' ? 'Time' : 'File';
    const body = document.createElement('span');
    body.className = 'message-result-body';
    const name = document.createElement('strong');
    name.textContent = entry.name;
    body.appendChild(name);
    const metaParts = [
      entry.location,
      entry.sizeMB > 0 ? `${entry.sizeMB} MB` : '',
      entry.matchScore > 0 && entry.type !== 'web' ? `${Math.round(entry.matchScore)}% match` : ''
    ].filter(Boolean);
    if (entry.snippet) {
      const snippet = document.createElement('small');
      snippet.textContent = entry.snippet;
      body.appendChild(snippet);
    }
    if (metaParts.length > 0 || entry.path) {
      const meta = document.createElement('small');
      meta.textContent = metaParts.length > 0 ? metaParts.join(' - ') : entry.path;
      body.appendChild(meta);
    }
    if (entry.path && metaParts.length > 0) {
      const pathEl = document.createElement('small');
      pathEl.className = 'message-result-path';
      pathEl.textContent = entry.path;
      body.appendChild(pathEl);
    }
    item.append(icon, body);
    list.appendChild(item);
  }
  bubble.appendChild(list);
}

function addMessage(text, type, meta, options = {}) {
  const safeText = redactSensitiveText(text);
  const safeMeta = redactSensitiveText(meta).slice(0, 120);
  const msg = document.createElement('article');
  msg.className = `message ${type}`;
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = type === 'user' ? 'You' : (type === 'system' ? '!' : getAssistantDisplayName().slice(0, 2));

  const stack = document.createElement('div');
  stack.className = 'message-stack';
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = safeText;
  const resultEntries = Array.isArray(options.resultEntries) ? options.resultEntries : [];
  if (type === 'assistant' && resultEntries.length > 0) {
    addResultCards(bubble, resultEntries);
  }
  const choices = Array.isArray(options.choices) ? options.choices.slice(0, 8) : [];
  if (type === 'assistant' && choices.length > 0) {
    const choiceList = document.createElement('ol');
    choiceList.className = 'message-choices';
    for (const choice of choices) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.className = 'message-choice';
      button.type = 'button';
      const choiceIndex = Number(choice.index) || choiceList.children.length + 1;
      const choicePath = String(choice.path || '');
      const fallbackTitle = String(choice.title || `Option ${choiceIndex}`);
      const choiceName = choicePath.split(/[\\/]/).filter(Boolean).pop() ||
        fallbackTitle.replace(/\s+-\s+[A-Za-z]:\\.*$/, '') ||
        `Option ${choiceIndex}`;
      const number = document.createElement('span');
      number.className = 'message-choice-number';
      number.textContent = String(choiceIndex);
      const copy = document.createElement('span');
      copy.className = 'message-choice-copy';
      const name = document.createElement('strong');
      name.textContent = choiceName;
      copy.appendChild(name);
      if (choicePath) {
        const location = document.createElement('small');
        location.textContent = choicePath;
        copy.appendChild(location);
      }
      button.append(number, copy);
      button.addEventListener('click', () => {
        if (!isProcessing) {
          sendCommand(String(choiceIndex));
        }
      });
      item.appendChild(button);
      choiceList.appendChild(item);
    }
    bubble.appendChild(choiceList);
  }
  stack.appendChild(bubble);
  if (meta) {
    const metaElement = document.createElement('div');
    metaElement.className = 'meta';
    metaElement.textContent = safeMeta;
    stack.appendChild(metaElement);
  }
  msg.append(avatar, stack);
  messagesEl.appendChild(msg);
  renderedMessageCount += 1;
  if (options.persist !== false) {
    rememberConversationMessage(safeText, type, safeMeta);
  }
  pruneRenderedMessages();
  scheduleMessagesScroll();
  return msg;
}

function pruneRenderedMessages() {
  const limit = chatHistoryLimit({ allowPreSettingsMax: true });
  if (renderedMessageCount <= limit) return;
  const renderedMessages = messagesEl.querySelectorAll('.message');
  const overflow = renderedMessages.length - limit;
  if (overflow <= 0) {
    renderedMessageCount = renderedMessages.length;
    return;
  }
  for (let index = 0; index < overflow; index += 1) {
    renderedMessages[index].remove();
  }
  renderedMessageCount = MAX_RENDERED_MESSAGES;
}

function scheduleMessagesScroll() {
  if (messageScrollAnimationFrame !== null) return;
  messageScrollAnimationFrame = requestAnimationFrame(() => {
    messageScrollAnimationFrame = null;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

function showTyping() {
  hideTyping();
  const el = document.createElement('div');
  el.className = 'typing';
  el.id = 'typing-indicator';
  for (let index = 0; index < 3; index += 1) {
    el.appendChild(document.createElement('span'));
  }
  messagesEl.appendChild(el);
  scheduleMessagesScroll();
}

function hideTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) {
    el.remove();
  }
}

function setWorkspaceView(viewName) {
  activeWorkspaceView = ['activity', 'apps', 'reminders', 'remote', 'mobile', 'home-automation'].includes(viewName) ? viewName : 'chat';
  const showingActivity = activeWorkspaceView === 'activity';
  const showingApps = activeWorkspaceView === 'apps';
  const showingReminders = activeWorkspaceView === 'reminders';
  const showingRemote = activeWorkspaceView === 'remote';
  const showingMobile = activeWorkspaceView === 'mobile';
  const showingHomeAutomation = activeWorkspaceView === 'home-automation';
  const showingChat = activeWorkspaceView === 'chat';
  const activeSwitcherView = showingActivity ? 'activity' : showingApps ? 'apps' : showingChat ? 'chat' : 'none';
  if (viewSwitcherEl) viewSwitcherEl.dataset.activeView = activeSwitcherView;
  document.body?.classList.toggle('reminders-fullscreen', showingReminders);
  document.body?.classList.toggle('remote-fullscreen', showingRemote);
  document.body?.classList.toggle('mobile-fullscreen', showingMobile);
  document.body?.classList.toggle('home-automation-fullscreen', showingHomeAutomation);
  conversationView.classList.toggle('active', showingChat);
  conversationView.hidden = !showingChat;
  activityView.classList.toggle('active', showingActivity);
  activityView.hidden = !showingActivity;
  remindersView?.classList.toggle('active', showingReminders);
  if (remindersView) remindersView.hidden = !showingReminders;
  remoteView?.classList.toggle('active', showingRemote);
  if (remoteView) remoteView.hidden = !showingRemote;
  mobileView?.classList.toggle('active', showingMobile);
  if (mobileView) mobileView.hidden = !showingMobile;
  homeAutomationView?.classList.toggle('active', showingHomeAutomation);
  if (homeAutomationView) homeAutomationView.hidden = !showingHomeAutomation;
  appsView.classList.toggle('active', showingApps);
  appsView.hidden = !showingApps;
  chatViewBtn.classList.toggle('active', showingChat);
  chatViewBtn.setAttribute('aria-pressed', String(showingChat));
  activityViewBtn.classList.toggle('active', showingActivity);
  activityViewBtn.setAttribute('aria-pressed', String(showingActivity));
  appsViewBtn.classList.toggle('active', showingApps);
  appsViewBtn.setAttribute('aria-pressed', String(showingApps));
  remoteViewBtn?.classList.toggle('active', showingRemote);
  remoteViewBtn?.setAttribute('aria-pressed', String(showingRemote));
  if (showingActivity) {
    renderActivity();
  } else if (showingReminders) {
    renderRemindersApp();
  } else if (showingRemote) {
    refreshRemoteTargets({ quiet: remoteTargets.length > 0 });
  } else if (showingMobile) {
    setActivePhonePanel(activePhonePanel);
  } else if (showingHomeAutomation) {
    loadHomeOnboardingSnapshot({ startDiscovery: true });
  } else if (showingChat) {
    requestAnimationFrame(() => inputBox.focus());
  }
}

function remoteTargetKey(target = {}) {
  return [target.id, target.tabTitle, target.windowTitle, target.processName]
    .map(value => String(value || '').trim())
    .join('|');
}

function selectedRemoteTarget() {
  const selectedKey = remoteTargetSelectEl?.value || selectedRemoteTargetKey;
  return remoteTargets.find(target => remoteTargetKey(target) === selectedKey) || remoteTargets[0] || null;
}

function remoteTargetProfile(target = {}) {
  const id = String(target.id || '').toLowerCase();
  if (REMOTE_ACTIONS_BY_PROFILE[id]) return id;
  const kind = String(target.kind || '').toLowerCase();
  if (REMOTE_ACTIONS_BY_PROFILE[kind]) return kind;
  return 'default';
}

function supportedRemoteActions(target = {}) {
  return new Set([
    ...REMOTE_DIRECTION_ACTIONS,
    ...(REMOTE_ACTIONS_BY_PROFILE[remoteTargetProfile(target)] || REMOTE_ACTIONS_BY_PROFILE.default)
  ]);
}

function setRemoteStatus(message, tone = 'info') {
  if (!remoteStatusEl) return;
  remoteStatusEl.textContent = message;
  remoteStatusEl.dataset.tone = tone;
}

function renderRemoteControlButtons() {
  const target = selectedRemoteTarget();
  const supported = target ? supportedRemoteActions(target) : new Set();
  remoteControlButtons.forEach(button => {
    const action = button.dataset.remoteAction || '';
    const allowed = supported.has(action);
    button.hidden = Boolean(target) && !allowed;
    button.disabled = !target || remoteTargetsLoading || !allowed;
  });
}

function scheduleRemoteTargetsRender() {
  if (remoteTargetsRenderFrame !== null) return;
  remoteTargetsRenderFrame = requestAnimationFrame(() => {
    remoteTargetsRenderFrame = null;
    renderRemoteTargets();
  });
}

function renderRemoteTargets() {
  if (!remoteTargetSelectEl) return;
  const previous = selectedRemoteTargetKey || remoteTargetSelectEl.value;
  remoteTargetSelectEl.textContent = '';
  if (!remoteTargets.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = remoteTargetsLoading ? 'Scanning active apps...' : 'No active remote apps';
    remoteTargetSelectEl.appendChild(option);
    remoteTargetSelectEl.disabled = true;
    renderRemoteControlButtons();
    if (remoteAppSummaryEl) remoteAppSummaryEl.textContent = 'Open YouTube, PowerPoint, Instagram, or another supported target first.';
    return;
  }

  remoteTargetSelectEl.disabled = false;
  remoteTargets.forEach(target => {
    const option = document.createElement('option');
    option.value = remoteTargetKey(target);
    option.textContent = target.tabTitle || target.label || target.windowTitle || 'Remote target';
    remoteTargetSelectEl.appendChild(option);
  });
  selectedRemoteTargetKey = remoteTargets.some(target => remoteTargetKey(target) === previous)
    ? previous
    : remoteTargetKey(remoteTargets[0]);
  remoteTargetSelectEl.value = selectedRemoteTargetKey;
  renderRemoteControlButtons();
  if (remoteAppSummaryEl) {
    remoteAppSummaryEl.textContent = `${remoteTargets.length} active remote ${remoteTargets.length === 1 ? 'target' : 'targets'}`;
  }
}

async function refreshRemoteTargets(options = {}) {
  if (!window.openx?.listRemoteTargets) {
    remoteTargets = [];
    scheduleRemoteTargetsRender();
    setRemoteStatus('Remote control is unavailable in this build.', 'error');
    return;
  }
  const now = Date.now();
  if (
    options.quiet &&
    remoteTargets.length &&
    now - remoteTargetsLastLoadedAt < REMOTE_TARGET_REFRESH_TTL_MS
  ) {
    scheduleRemoteTargetsRender();
    return;
  }
  remoteTargetsLoading = true;
  scheduleRemoteTargetsRender();
  if (!options.quiet) setRemoteStatus('Scanning active remote apps...', 'info');
  try {
    const result = await window.openx.listRemoteTargets();
    remoteTargets = Array.isArray(result?.data?.targets) ? result.data.targets : [];
    remoteTargetsLastLoadedAt = Date.now();
    setRemoteStatus(remoteTargets.length
      ? 'Remote is ready.'
      : 'Open a supported app like YouTube, PowerPoint, Instagram, or Spotify.', remoteTargets.length ? 'success' : 'info');
  } catch (error) {
    remoteTargets = [];
    remoteTargetsLastLoadedAt = 0;
    setRemoteStatus(error?.message || 'Could not scan remote targets.', 'error');
  } finally {
    remoteTargetsLoading = false;
    scheduleRemoteTargetsRender();
  }
}

async function sendRemoteAction(action) {
  const target = selectedRemoteTarget();
  if (!target || !window.openx?.sendRemoteControl) {
    setRemoteStatus('Choose an active remote target first.', 'warning');
    return;
  }
  setRemoteStatus(`Sending ${action} to ${target.label || 'target'}...`, 'info');
  try {
    const result = await window.openx.sendRemoteControl({
      targetId: target.id,
      action,
      windowTitle: target.windowTitle || '',
      tabTitle: target.tabTitle || '',
      targetHandle: target.handle || null,
      targetProcessId: target.processId || null,
      processName: target.processName || ''
    });
    if (result?.success === false) {
      setRemoteStatus(result.error || 'Remote command failed.', 'error');
      showToast('Remote command failed', result.error || 'The active app did not accept the command.', 'error');
      return;
    }
    setRemoteStatus(`${target.label || 'App'} responded.`, 'success');
  } catch (error) {
    setRemoteStatus(error?.message || 'Remote command failed.', 'error');
  }
}

function closeRemoteApp() {
  setWorkspaceView('apps');
}

function openMobileApp() {
  settingsOverlay?.classList.remove('open');
  stopSettingsStatusPolling();
  setWorkspaceView('mobile');
}

function closeMobileApp() {
  closeMobileServerDetails({ restoreFocus: false });
  setWorkspaceView('apps');
}

function closeHomeAutomationApp() {
  setWorkspaceView('apps');
}

function homeServerAddressFallback() {
  return homeOnboardingSnapshot?.serverAddress ||
    cloudRelayUrlEl?.value?.trim() ||
    settingsSnapshot?.settings?.cloud?.relayUrl ||
    'wss://openx-server.onrender.com/ws';
}

function decodeHomeBluetoothValue(value) {
  if (!value) return '';
  if (value instanceof DataView) {
    return new TextDecoder().decode(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  }
  if (value.buffer) return new TextDecoder().decode(value);
  return String(value || '');
}

function parseHomeBluetoothJson(value, fallback = {}) {
  const text = typeof value === 'string' ? value : decodeHomeBluetoothValue(value);
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch (_) {
    return fallback;
  }
}

function deriveHomeDeviceIdFromBluetoothDevice(bluetoothDevice = {}) {
  const source = `${bluetoothDevice?.id || ''} ${bluetoothDevice?.name || ''}`;
  const match = source.match(/([0-9a-f]{2}[:-]){5}[0-9a-f]{2}/i);
  if (!match) return '';
  const parts = match[0].replace(/-/g, ':').split(':').map(part => parseInt(part, 16));
  if (parts.length !== 6 || parts.some(part => !Number.isInteger(part))) return '';
  parts[5] = (parts[5] + 254) & 0xff;
  return `oxd_${parts.reverse().map(part => part.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function hashHomeBluetoothFallbackId(value = '') {
  let hash = 5381;
  const text = String(value || 'openx-home-device');
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) >>> 0;
  }
  return `oxd_ble_${hash.toString(16).padStart(8, '0')}`;
}

function normalizeHomeBluetoothDevice(bluetoothDevice, info = {}, selection = {}) {
  const bluetoothDeviceId = String(selection.bluetoothDeviceId || bluetoothDevice?.id || '').trim();
  const deviceName = String(info.deviceName || selection.deviceName || bluetoothDevice?.name || 'OpenX Home Device').trim();
  const derivedId = deriveHomeDeviceIdFromBluetoothDevice({
    id: `${bluetoothDeviceId} ${bluetoothDevice?.id || ''}`,
    name: `${deviceName} ${bluetoothDevice?.name || ''}`
  });
  const deviceId = String(info.deviceId || derivedId || hashHomeBluetoothFallbackId(`${bluetoothDeviceId}:${deviceName}`)).trim();
  return {
    deviceId,
    deviceName,
    firmwareVersion: String(info.firmwareVersion || 'unknown').trim(),
    hardwareModel: String(info.hardwareModel || '').trim(),
    protocolVersion: String(info.protocolVersion || 'openx-home-v1').trim(),
    deviceStatus: info.provisioningRequired === false ? 'ready' : 'ready_for_setup',
    connectionStatus: 'ble_advertising',
    pairingStatus: 'unpaired',
    discoverySource: 'bluetooth',
    transport: 'ble',
    bluetoothDeviceId,
    capabilities: Array.isArray(info.capabilities) ? info.capabilities : ['relay']
  };
}

async function getHomeBluetoothService(cached) {
  const bluetoothDevice = cached?.device;
  if (!bluetoothDevice?.gatt) {
    return { success: false, code: 'bluetooth-device-unavailable', message: 'The Bluetooth Home Device is unavailable. Press Scan and select it again.' };
  }
  const server = bluetoothDevice.gatt.connected
    ? bluetoothDevice.gatt
    : await bluetoothDevice.gatt.connect();
  const service = await server.getPrimaryService(HOME_BLE_SERVICE_UUID);
  return { success: true, server, service };
}

async function discoverHomeBluetoothDevice() {
  if (!navigator.bluetooth?.requestDevice) {
    return {
      success: false,
      code: 'bluetooth-unavailable',
      message: 'Bluetooth provisioning is unavailable in this OpenX build.'
    };
  }
  try {
    const bluetoothDevice = await navigator.bluetooth.requestDevice({
      filters: [
        { services: [HOME_BLE_SERVICE_UUID] },
        { namePrefix: 'OpenX' }
      ],
      optionalServices: [HOME_BLE_SERVICE_UUID]
    });
    const selectionResult = await window.openx?.getSelectedHomeBluetoothDevice?.();
    const selection = selectionResult?.selection || {};
    const serviceResult = await getHomeBluetoothService({ device: bluetoothDevice });
    if (!serviceResult.success) return serviceResult;
    let info = {};
    try {
      const infoCharacteristic = await serviceResult.service.getCharacteristic(HOME_BLE_DEVICE_INFO_UUID);
      info = parseHomeBluetoothJson(await infoCharacteristic.readValue(), {});
    } catch (_) {
      info = {};
    }
    const discovered = normalizeHomeBluetoothDevice(bluetoothDevice, info, selection);
    if (!HOME_DEVICE_ID_PATTERN.test(discovered.deviceId)) {
      return { success: false, code: 'home-device-id-missing', message: 'The Bluetooth Home Device did not report a valid device ID.' };
    }
    homeBluetoothDevices.set(discovered.deviceId, {
      device: bluetoothDevice,
      discoveredAt: Date.now()
    });
    bluetoothDevice.addEventListener?.('gattserverdisconnected', () => {
      const cached = homeBluetoothDevices.get(discovered.deviceId);
      if (cached?.device === bluetoothDevice) {
        homeBluetoothDevices.set(discovered.deviceId, { ...cached, disconnectedAt: Date.now() });
      }
    }, { once: true });
    const result = await window.openx?.addDiscoveredHomeDevice?.(discovered);
    return {
      success: result?.success !== false,
      device: discovered,
      message: `${discovered.deviceName || 'OpenX Home Device'} is ready for setup.`
    };
  } catch (error) {
    const name = String(error?.name || '').toLowerCase();
    if (name === 'notfounderror') {
      return { success: false, code: 'bluetooth-selection-cancelled', message: 'Bluetooth Home Device selection was cancelled.' };
    }
    return {
      success: false,
      code: 'bluetooth-scan-failed',
      message: error?.message || 'Bluetooth Home Device scan failed.'
    };
  }
}

async function writeHomeConfigurationByBluetooth(deviceId, configuration = {}) {
  const normalizedDeviceId = String(deviceId || '').trim();
  const cached = homeBluetoothDevices.get(normalizedDeviceId);
  if (!cached) {
    return {
      success: false,
      code: 'bluetooth-device-not-selected',
      message: 'Press Scan, select the ESP32 Bluetooth device, then send configuration again.'
    };
  }
  try {
    const payload = JSON.stringify({
      wifiSsid: configuration.ssid || configuration.wifiSsid || '',
      wifiPassword: configuration.password || configuration.wifiPassword || '',
      serverAddress: configuration.serverAddress || ''
    });
    const bytes = new TextEncoder().encode(payload);
    if (bytes.byteLength > HOME_BLE_CONFIG_MAX_BYTES) {
      return {
        success: false,
        code: 'configuration-too-large',
        message: 'The Home Device configuration is too large to send over Bluetooth.'
      };
    }
    const serviceResult = await getHomeBluetoothService(cached);
    if (!serviceResult.success) return serviceResult;
    const configurationCharacteristic = await serviceResult.service.getCharacteristic(HOME_BLE_CONFIGURATION_UUID);
    if (typeof configurationCharacteristic.writeValueWithResponse === 'function') {
      await configurationCharacteristic.writeValueWithResponse(bytes);
    } else {
      await configurationCharacteristic.writeValue(bytes);
    }
    try {
      const statusCharacteristic = await serviceResult.service.getCharacteristic(HOME_BLE_STATUS_UUID);
      const status = parseHomeBluetoothJson(await statusCharacteristic.readValue(), {});
      if (status.success === false) {
        return {
          success: false,
          code: status.statusCode || 'device-rejected-configuration',
          message: status.message || 'The Home Device rejected the configuration.'
        };
      }
    } catch (_) {}
    return { success: true, message: 'Configuration sent over Bluetooth. Waiting for the device to join OpenX_Server.' };
  } catch (error) {
    return {
      success: false,
      code: 'bluetooth-configuration-failed',
      message: error?.message || 'Could not send configuration over Bluetooth.'
    };
  }
}

function getHomeDevices() {
  return Array.isArray(homeOnboardingSnapshot?.discovery?.devices)
    ? homeOnboardingSnapshot.discovery.devices
    : [];
}

function isHomeDevicePaired(device = {}) {
  return device.pairingStatus === 'paired' || device.pairStatus === 'paired';
}

function getConnectedHomeDevices() {
  return getHomeDevices()
    .filter(isHomeDevicePaired)
    .sort((left, right) => {
      const leftOnline = String(left.connectionStatus || '').toLowerCase() === 'online' ? 1 : 0;
      const rightOnline = String(right.connectionStatus || '').toLowerCase() === 'online' ? 1 : 0;
      if (leftOnline !== rightOnline) return rightOnline - leftOnline;
      return String(left.deviceName || '').localeCompare(String(right.deviceName || ''));
    });
}

function getNearbyHomeDevices() {
  return getHomeDevices().filter(device => !isHomeDevicePaired(device));
}

function getHomeDashboardCounts() {
  const connectedDevices = getConnectedHomeDevices();
  const nearbyDevices = getNearbyHomeDevices();
  return {
    found: homeUserRequestedScan ? nearbyDevices.length : 0,
    online: connectedDevices.filter(device => String(device.connectionStatus || '').toLowerCase() === 'online').length,
    paired: connectedDevices.length
  };
}

function getActiveHomeSession() {
  const sessions = Array.isArray(homeOnboardingSnapshot?.activeSessions)
    ? homeOnboardingSnapshot.activeSessions
    : [];
  if (homeActiveSession?.sessionId) {
    const refreshed = sessions.find(session => session.sessionId === homeActiveSession.sessionId);
    if (refreshed) homeActiveSession = refreshed;
  }
  if (!homeActiveSession && sessions.length) homeActiveSession = sessions[sessions.length - 1];
  return homeActiveSession;
}

function getSelectedHomeDevice() {
  const devices = getHomeDevices();
  const session = getActiveHomeSession();
  const selectedId = homeSelectedDeviceId || session?.deviceId || '';
  if (selectedId) return devices.find(device => device.deviceId === selectedId) || session?.device || null;
  return devices.find(device => isHomeBluetoothSetupDevice(device)) || null;
}

function isHomeBluetoothSetupDevice(device = {}) {
  if (!device?.deviceId) return false;
  if (device.pairingStatus === 'paired' || device.pairStatus === 'paired') return false;
  if (device.transport === 'ble' || device.discoverySource === 'bluetooth') return true;
  return homeBluetoothDevices.has(String(device.deviceId || '').trim());
}

function humanizeHomeState(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  const labels = {
    ble_advertising: 'Ready to set up',
    ready_for_setup: 'Ready to set up',
    configuration_sent: 'Connecting',
    waiting_approval: 'Needs approval',
    pair_requested: 'Needs approval',
    unpaired: 'Not paired',
    paired: 'Paired',
    online: 'Online',
    offline: 'Offline',
    registered: 'Registered',
    ready: 'Ready',
    connected: 'Connected',
    server: 'Server',
    ble: 'Bluetooth'
  };
  return labels[normalized] || String(value || 'Unknown').replace(/_/g, ' ');
}

function normalizeHomeStep(step) {
  const normalized = String(step || '').toLowerCase();
  if (normalized === 'welcome') return 'device';
  if (normalized === 'transfer') return 'connecting';
  return HOME_ONBOARDING_UI_STEPS.includes(normalized) ? normalized : 'device';
}

function setHomeOnboardingStatus(message = '', tone = 'info') {
  if (!homeOnboardingStatusEl) return;
  homeOnboardingStatusEl.textContent = message;
  homeOnboardingStatusEl.dataset.tone = tone;
}

function clearHomeSensitiveFields() {
  if (homeWifiPasswordEl) homeWifiPasswordEl.value = '';
}

function setHomeWizardStep(step) {
  homeManualStep = normalizeHomeStep(step);
  renderHomeWizard();
}

function renderHomeDiscoveryBanner() {
  if (!homeDiscoveryBannerEl) return;
  const session = getActiveHomeSession();
  const device = getHomeDevices().find(item => isHomeBluetoothSetupDevice(item));
  const visible = Boolean(device && !session);
  homeDiscoveryBannerEl.hidden = !visible;
  if (!visible) return;
  if (homeDiscoveryBannerDetailEl) {
    homeDiscoveryBannerDetailEl.textContent = `${device.deviceName || 'OpenX Home Device'} is ready over Bluetooth. Set it up with Wi-Fi and OpenX_Server.`;
  }
  if (homeDiscoveryConfigureBtn) {
    homeDiscoveryConfigureBtn.dataset.deviceId = device.deviceId || '';
  }
}

function nearbyHomeDeviceStatusText(device = {}) {
  if (isHomeBluetoothSetupDevice(device)) return 'Ready to add over Bluetooth';
  if (device.transport === 'server' || device.discoverySource === 'openx-server') {
    return String(device.connectionStatus || '').toLowerCase() === 'online'
      ? 'Online, waiting to be set up'
      : 'Seen before, not in setup mode right now';
  }
  return 'Nearby';
}

function renderHomeDeviceList() {
  if (!homeDeviceListEl) return;
  const devices = getNearbyHomeDevices();
  const activeDeviceId = homeSelectedDeviceId || getActiveHomeSession()?.deviceId || '';
  homeDeviceListEl.replaceChildren();
  if (!devices.length) {
    const empty = document.createElement('div');
    empty.className = 'home-automation-empty';
    const title = document.createElement('strong');
    title.textContent = 'No new devices nearby';
    const detail = document.createElement('span');
    detail.textContent = 'Power on the ESP32, keep it near this PC, then press Scan.';
    empty.append(title, detail);
    homeDeviceListEl.appendChild(empty);
    return;
  }

  devices.forEach(device => {
    const card = document.createElement('article');
    card.className = 'home-device-card';
    card.classList.toggle('active', device.deviceId === activeDeviceId);

    const main = document.createElement('div');
    main.className = 'home-device-main';
    const name = document.createElement('strong');
    name.textContent = device.deviceName || 'OpenX Home Device';
    const meta = document.createElement('small');
    meta.textContent = nearbyHomeDeviceStatusText(device);
    main.append(name, meta);

    const configure = document.createElement('button');
    configure.className = 'secondary-btn home-device-configure-btn';
    configure.type = 'button';
    const canSetup = isHomeBluetoothSetupDevice(device);
    if (canSetup) {
      configure.dataset.homeConfigure = device.deviceId || '';
    } else {
      configure.dataset.homeScan = '1';
    }
    configure.textContent = canSetup ? 'Set Up' : 'Scan Bluetooth';

    card.append(main, configure);
    homeDeviceListEl.appendChild(card);
  });
}

function homeDeviceRelativeTime(isoString) {
  const timestamp = Date.parse(isoString || '');
  if (!Number.isFinite(timestamp)) return '';
  const diffMs = Date.now() - timestamp;
  if (diffMs < 0 || diffMs < 60000) return 'just now';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function homeDeviceShortId(deviceId = '') {
  const normalized = String(deviceId || '').trim();
  return normalized.length > 8 ? normalized.slice(-8) : normalized;
}

function homeConnectedDeviceMeta(device = {}) {
  const parts = [];
  const firmware = String(device.firmwareVersion || '').trim();
  if (firmware && firmware !== 'unknown') parts.push(`Firmware ${firmware}`);
  const source = humanizeHomeState(device.transport || device.discoverySource || 'server');
  if (source && source !== 'Unknown') parts.push(source);
  const lastSeen = homeDeviceRelativeTime(device.lastSeenAt);
  if (lastSeen) parts.push(`Seen ${lastSeen}`);
  const shortId = homeDeviceShortId(device.deviceId);
  if (shortId) parts.push(`ID ${shortId}`);
  return parts.join(' - ');
}

function renderHomeConnectedList() {
  if (!homeConnectedListEl) return;
  const devices = getConnectedHomeDevices();
  homeConnectedListEl.replaceChildren();
  if (!devices.length) {
    const empty = document.createElement('div');
    empty.className = 'home-automation-empty';
    const title = document.createElement('strong');
    title.textContent = 'No devices connected yet';
    const detail = document.createElement('span');
    detail.textContent = 'Set up a nearby device above to see it here.';
    empty.append(title, detail);
    homeConnectedListEl.appendChild(empty);
    return;
  }

  devices.forEach(device => {
    const deviceId = device.deviceId || '';
    const isOnline = String(device.connectionStatus || '').toLowerCase() === 'online';
    const isEditing = homeRenamingDeviceId === deviceId;
    const isConfirmingRemove = homeRemovingDeviceId === deviceId;

    const card = document.createElement('article');
    card.className = 'home-connected-card';

    const icon = document.createElement('div');
    icon.className = 'home-connected-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '\u{1F50C}';

    const main = document.createElement('div');
    main.className = 'home-connected-main';

    if (isEditing) {
      const form = document.createElement('div');
      form.className = 'home-connected-rename-form';
      const input = document.createElement('input');
      input.className = 'field';
      input.type = 'text';
      input.maxLength = 100;
      input.value = device.deviceName || 'OpenX Home Device';
      input.dataset.homeRenameInput = deviceId;
      const saveBtn = document.createElement('button');
      saveBtn.className = 'primary-btn';
      saveBtn.type = 'button';
      saveBtn.textContent = 'Save';
      saveBtn.dataset.homeRenameSave = deviceId;
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'secondary-btn';
      cancelBtn.type = 'button';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.dataset.homeRenameCancel = deviceId;
      form.append(input, saveBtn, cancelBtn);
      main.appendChild(form);
    } else {
      const nameRow = document.createElement('div');
      nameRow.className = 'home-connected-name-row';
      const name = document.createElement('strong');
      name.textContent = device.deviceName || 'OpenX Home Device';
      nameRow.appendChild(name);

      const status = document.createElement('span');
      status.className = `home-status-dot ${isOnline ? 'online' : 'offline'}`;
      status.textContent = isOnline ? 'Online' : `Offline${device.lastSeenAt ? ` - seen ${homeDeviceRelativeTime(device.lastSeenAt)}` : ''}`;

      const metaText = homeConnectedDeviceMeta(device);
      if (metaText) {
        const meta = document.createElement('small');
        meta.className = 'home-connected-meta';
        meta.textContent = metaText;
        main.append(nameRow, status, meta);
      } else {
        main.append(nameRow, status);
      }
    }

    const actions = document.createElement('div');
    actions.className = 'home-connected-actions';
    if (isConfirmingRemove) {
      const confirmText = document.createElement('small');
      confirmText.className = 'home-connected-confirm-text';
      confirmText.textContent = `Remove "${device.deviceName || 'this device'}"? It will forget your Wi-Fi so you can set it up again.`;
      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'primary-btn home-danger-btn';
      confirmBtn.type = 'button';
      confirmBtn.textContent = 'Remove';
      confirmBtn.dataset.homeRemoveConfirm = deviceId;
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'secondary-btn';
      cancelBtn.type = 'button';
      cancelBtn.textContent = 'Keep it';
      cancelBtn.dataset.homeRemoveCancel = deviceId;
      const confirmRow = document.createElement('div');
      confirmRow.className = 'home-connected-confirm-row';
      confirmRow.append(confirmBtn, cancelBtn);
      actions.append(confirmText, confirmRow);
      card.classList.add('confirming-remove');
    } else if (!isEditing) {
      if (!isOnline) {
        const reconnectBtn = document.createElement('button');
        reconnectBtn.className = 'secondary-btn';
        reconnectBtn.type = 'button';
        reconnectBtn.textContent = homeReconnectingDeviceId === deviceId ? 'Checking...' : 'Reconnect';
        reconnectBtn.disabled = homeReconnectingDeviceId === deviceId;
        reconnectBtn.dataset.homeReconnect = deviceId;
        actions.append(reconnectBtn);
      }
      const renameBtn = document.createElement('button');
      renameBtn.className = 'secondary-btn';
      renameBtn.type = 'button';
      renameBtn.textContent = 'Rename';
      renameBtn.dataset.homeRenameStart = deviceId;
      const removeBtn = document.createElement('button');
      removeBtn.className = 'secondary-btn home-danger-btn';
      removeBtn.type = 'button';
      removeBtn.textContent = 'Remove';
      removeBtn.dataset.homeRemoveStart = deviceId;
      actions.append(renameBtn, removeBtn);
    }

    card.append(icon, main, actions);
    homeConnectedListEl.appendChild(card);
  });
}

function renderHomeWizard() {
  const session = getActiveHomeSession();
  const device = getSelectedHomeDevice();
  const hasSession = Boolean(session);
  if (homeWizardEmptyEl) homeWizardEmptyEl.hidden = hasSession;
  homeWizardSteps.forEach(stepEl => {
    stepEl.hidden = true;
    stepEl.classList.remove('active');
  });
  if (!hasSession) {
    if (homeOnboardingProgressEl) homeOnboardingProgressEl.style.width = '0%';
    const status = device
      ? 'Choose Set Up to add the Bluetooth Home Device.'
      : 'Press Scan and select the ESP32 Bluetooth device. Server-only devices cannot receive Wi-Fi settings.';
    setHomeOnboardingStatus(status, device ? 'info' : 'warning');
    return;
  }

  const step = normalizeHomeStep(homeManualStep || session.step);
  const activeStep = document.querySelector(`[data-home-step="${step}"]`);
  if (activeStep) {
    activeStep.hidden = false;
    activeStep.classList.add('active');
  }
  const progress = Math.max(0, Math.min(100, Number(session.progress) || HOME_ONBOARDING_STEP_PROGRESS[step] || 0));
  if (homeOnboardingProgressEl) homeOnboardingProgressEl.style.width = `${progress}%`;

  if (homeWizardDeviceNameInputEl && homeWizardNameDeviceId !== session.deviceId) {
    homeWizardNameDeviceId = session.deviceId;
    homeWizardDeviceNameInputEl.value = device?.deviceName || session.device?.deviceName || '';
  }
  if (homeWizardDeviceFirmwareEl) homeWizardDeviceFirmwareEl.textContent = device?.firmwareVersion || session.device?.firmwareVersion || 'unknown';
  if (homeWizardDeviceIdHintEl) {
    const shortId = String(session.deviceId || device?.deviceId || '').slice(-8);
    homeWizardDeviceIdHintEl.textContent = shortId ? `Device ID ends in ${shortId}` : '';
  }
  if (homeServerAddressEl && !homeServerAddressEl.value) {
    homeServerAddressEl.value = homeServerAddressFallback();
  }
  if (homeApprovalDeviceNameEl) {
    homeApprovalDeviceNameEl.textContent = device?.deviceName || session.device?.deviceName || 'OpenX Home Device';
  }
  if (homeConnectingTitleEl && step === 'connecting') {
    homeConnectingTitleEl.textContent = session.state === 'connected' ? 'Device Connected' : 'Connecting Device...';
  }
  if (homeConnectingDetailEl && step === 'connecting') {
    homeConnectingDetailEl.textContent = session.state === 'connected'
      ? 'The Home Device reached OpenX_Server. Approve pairing to finish setup.'
      : session.state === 'failed'
      ? 'Still no sign of the Home Device. Make sure it has power and Wi-Fi, then retry.'
      : 'Settings were sent. Waiting for the Home Device to connect through OpenX_Server.';
  }
  if (homeConnectingActionsEl && step === 'connecting') {
    homeConnectingActionsEl.hidden = session.state !== 'failed';
  }
  const errorTone = session.state === 'failed' ? 'error' : 'info';
  setHomeOnboardingStatus(session.error || session.history?.at?.(-1)?.message || 'Setup is ready.', errorTone);
}

function renderHomeAutomation() {
  const counts = getHomeDashboardCounts();
  if (homeFoundCountEl) homeFoundCountEl.textContent = String(counts.found);
  if (homeOnlineCountEl) homeOnlineCountEl.textContent = String(counts.online);
  if (homePairedCountEl) homePairedCountEl.textContent = String(counts.paired);
  if (homeDiscoveryStatusEl) {
    homeDiscoveryStatusEl.textContent = homeScanInProgress
      ? `Scanning Bluetooth and OpenX_Server - ${counts.found} nearby shown.`
      : homeUserRequestedScan
      ? `${counts.found ? `${counts.found} nearby device${counts.found === 1 ? '' : 's'} found.` : 'No nearby devices found. Press Scan to try again.'}`
      : 'Press Scan to find nearby devices.';
  }
  renderHomeDiscoveryBanner();
  renderHomeConnectedList();
  renderHomeDeviceList();
  renderHomeWizard();
}

async function loadHomeOnboardingSnapshot(options = {}) {
  if (!window.openx?.getHomeOnboardingSnapshot) {
    setHomeOnboardingStatus('Home onboarding is unavailable in this build.', 'error');
    return null;
  }
  try {
    if (options.startDiscovery && window.openx?.startHomeDiscovery) {
      await window.openx.startHomeDiscovery();
    }
    const snapshot = await window.openx.getHomeOnboardingSnapshot();
    homeOnboardingSnapshot = snapshot?.success === false ? null : snapshot;
    if (homeServerAddressEl && !homeServerAddressEl.value) {
      homeServerAddressEl.value = homeServerAddressFallback();
    }
    renderHomeAutomation();
    return homeOnboardingSnapshot;
  } catch (error) {
    setHomeOnboardingStatus(error?.message || 'Could not load Home Device onboarding.', 'error');
    renderHomeAutomation();
    return null;
  }
}

async function refreshHomeDiscovery() {
  if (!window.openx?.startHomeDiscovery) {
    setHomeOnboardingStatus('Home Device discovery is unavailable in this build.', 'error');
    return;
  }
  homeUserRequestedScan = true;
  homeScanInProgress = true;
  if (homeDiscoveryRefreshBtn) homeDiscoveryRefreshBtn.disabled = true;
  renderHomeAutomation();
  setHomeOnboardingStatus('Scanning Bluetooth and OpenX_Server for Home Devices...', 'info');
  let finalStatus = null;
  try {
    const bluetoothResult = await discoverHomeBluetoothDevice();
    await window.openx.startHomeDiscovery();
    await loadHomeOnboardingSnapshot();
    if (bluetoothResult?.success) {
      finalStatus = { message: bluetoothResult.message || 'Bluetooth Home Device found. Choose Set Up to continue.', tone: 'success' };
    } else if (bluetoothResult?.code) {
      finalStatus = { message: bluetoothResult.message || 'Bluetooth scan did not find a Home Device. Server devices were refreshed.', tone: 'warning' };
    }
  } catch (error) {
    finalStatus = { message: error?.message || 'Could not start Home Device discovery.', tone: 'error' };
  } finally {
    homeScanInProgress = false;
    if (homeDiscoveryRefreshBtn) homeDiscoveryRefreshBtn.disabled = false;
    renderHomeAutomation();
    if (finalStatus) setHomeOnboardingStatus(finalStatus.message, finalStatus.tone);
  }
}

function startHomeDeviceRename(deviceId) {
  homeRemovingDeviceId = '';
  homeRenamingDeviceId = String(deviceId || '').trim();
  renderHomeConnectedList();
  const input = homeConnectedListEl?.querySelector('[data-home-rename-input]');
  input?.focus();
  input?.select();
}

function cancelHomeDeviceRename() {
  homeRenamingDeviceId = '';
  renderHomeConnectedList();
}

async function saveHomeDeviceRename(deviceId) {
  const input = homeConnectedListEl?.querySelector(`[data-home-rename-input="${deviceId}"]`);
  const nextName = String(input?.value || '').trim();
  if (!nextName) {
    setHomeOnboardingStatus('Enter a name for this device.', 'warning');
    return;
  }
  if (!window.openx?.renameHomeDevice) {
    setHomeOnboardingStatus('Renaming Home Devices is unavailable in this build.', 'error');
    return;
  }
  try {
    const result = await window.openx.renameHomeDevice(deviceId, nextName);
    if (result?.success === false) {
      setHomeOnboardingStatus(result.message || 'Could not rename this device.', 'error');
      return;
    }
    homeRenamingDeviceId = '';
    await loadHomeOnboardingSnapshot();
    setHomeOnboardingStatus('Device renamed.', 'success');
  } catch (error) {
    setHomeOnboardingStatus(error?.message || 'Could not rename this device.', 'error');
  }
}

function startHomeDeviceRemoval(deviceId) {
  homeRenamingDeviceId = '';
  homeRemovingDeviceId = String(deviceId || '').trim();
  renderHomeConnectedList();
}

function cancelHomeDeviceRemoval() {
  homeRemovingDeviceId = '';
  renderHomeConnectedList();
}

async function confirmHomeDeviceRemoval(deviceId) {
  if (!window.openx?.removeHomeDevice) {
    setHomeOnboardingStatus('Removing Home Devices is unavailable in this build.', 'error');
    return;
  }
  setHomeOnboardingStatus('Removing device...', 'info');
  try {
    const result = await window.openx.removeHomeDevice(deviceId);
    if (result?.success === false) {
      setHomeOnboardingStatus(result.message || 'Could not remove this device.', 'error');
      return;
    }
    homeRemovingDeviceId = '';
    await loadHomeOnboardingSnapshot();
    setHomeOnboardingStatus(
      result?.notified
        ? 'Device removed and its Wi-Fi settings were cleared.'
        : 'Device removed. It was offline, so reset its Wi-Fi settings by holding its reset button before setting it up again.',
      'success'
    );
  } catch (error) {
    setHomeOnboardingStatus(error?.message || 'Could not remove this device.', 'error');
  }
}

async function reconnectHomeDevice(deviceId) {
  const normalizedId = String(deviceId || '').trim();
  if (!normalizedId || !window.openx?.refreshHomeDevice) {
    setHomeOnboardingStatus('Reconnecting is unavailable in this build.', 'error');
    return;
  }
  homeReconnectingDeviceId = normalizedId;
  renderHomeConnectedList();
  setHomeOnboardingStatus('Checking for the device...', 'info');
  let finalStatus = null;
  try {
    const result = await window.openx.refreshHomeDevice(normalizedId);
    if (result?.success === false) {
      finalStatus = {
        message: result.message || 'The device is still offline. Make sure it has power and Wi-Fi.',
        tone: 'warning'
      };
    } else {
      const isOnline = String(result?.device?.connectionStatus || '').toLowerCase() === 'online';
      finalStatus = {
        message: result?.reclaimed
          ? 'Device ownership was restored and it is back online.'
          : isOnline
          ? 'The device is back online.'
          : 'Still offline. Make sure it has power and Wi-Fi, then try again.',
        tone: isOnline ? 'success' : 'warning'
      };
    }
  } catch (error) {
    finalStatus = { message: error?.message || 'Could not check the device.', tone: 'error' };
  } finally {
    homeReconnectingDeviceId = '';
    await loadHomeOnboardingSnapshot();
    if (finalStatus) setHomeOnboardingStatus(finalStatus.message, finalStatus.tone);
  }
}

async function startHomeOnboarding(deviceId) {
  const selectedId = String(deviceId || homeSelectedDeviceId || '').trim();
  if (!selectedId) {
    setHomeOnboardingStatus('Select a Home Device first.', 'warning');
    return;
  }
  const selectedDevice = getHomeDevices().find(device => device.deviceId === selectedId);
  if (!isHomeBluetoothSetupDevice(selectedDevice)) {
    setHomeOnboardingStatus('This device was found on OpenX_Server, but Wi-Fi setup needs Bluetooth. Press Scan, select the ESP32 Bluetooth device, then choose Set Up.', 'warning');
    return;
  }
  if (!window.openx?.startHomeOnboarding) {
    setHomeOnboardingStatus('Home onboarding is unavailable in this build.', 'error');
    return;
  }
  homeSelectedDeviceId = selectedId;
  homeManualStep = '';
  setHomeOnboardingStatus('Starting setup...', 'info');
  try {
    const result = await window.openx.startHomeOnboarding(selectedId);
    if (result?.session) homeActiveSession = result.session;
    if (result?.success === false) {
      setHomeOnboardingStatus(result.message || 'Could not start setup.', 'warning');
    }
    await loadHomeOnboardingSnapshot();
  } catch (error) {
    setHomeOnboardingStatus(error?.message || 'Could not start setup.', 'error');
  }
}

function validateHomeWifiForm() {
  const ssid = homeWifiSsidEl?.value?.trim() || '';
  const password = homeWifiPasswordEl?.value || '';
  if (!ssid) {
    setHomeOnboardingStatus('Enter the Wi-Fi network name.', 'warning');
    homeWifiSsidEl?.focus?.();
    return false;
  }
  if (!password) {
    setHomeOnboardingStatus('Enter the Wi-Fi password. It is sent only to the device and is not stored by OpenX Desktop.', 'warning');
    homeWifiPasswordEl?.focus?.();
    return false;
  }
  return true;
}

function validateHomeServerForm() {
  const serverAddress = homeServerAddressEl?.value?.trim() || '';
  if (!serverAddress) {
    setHomeOnboardingStatus('Enter the OpenX_Server address.', 'warning');
    homeServerAddressEl?.focus?.();
    return false;
  }
  try {
    const url = new URL(serverAddress);
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) throw new Error('invalid protocol');
    return true;
  } catch (_) {
    setHomeOnboardingStatus('Use a valid http, https, ws, or wss OpenX_Server address.', 'warning');
    homeServerAddressEl?.focus?.();
    return false;
  }
}

function scheduleHomeConnectionWait(sessionId) {
  if (homeAutoConnectionTimer) clearTimeout(homeAutoConnectionTimer);
  homeAutoConnectionTimer = window.setTimeout(async () => {
    homeAutoConnectionTimer = null;
    if (!sessionId || !window.openx?.waitForHomeDeviceConnection) return;
    try {
      const result = await window.openx.waitForHomeDeviceConnection(sessionId);
      if (result?.session) {
        homeActiveSession = result.session;
        homeManualStep = '';
      }
      if (result?.success === false) {
        setHomeOnboardingStatus(result.message || 'The Home Device did not connect in time.', 'error');
      }
      await loadHomeOnboardingSnapshot();
    } catch (error) {
      setHomeOnboardingStatus(error?.message || 'The Home Device did not connect in time.', 'error');
    }
  }, HOME_CONNECTION_WAIT_DELAY_MS);
}

async function sendHomeConfiguration() {
  const session = getActiveHomeSession();
  if (!session) {
    setHomeOnboardingStatus('Start setup before sending configuration.', 'warning');
    return;
  }
  if (!validateHomeWifiForm() || !validateHomeServerForm()) return;
  if (!window.openx?.configureHomeDevice) {
    setHomeOnboardingStatus('Home Device configuration is unavailable in this build.', 'error');
    return;
  }
  if (homeSendConfigBtn) homeSendConfigBtn.disabled = true;
  setHomeWizardStep('connecting');
  setHomeOnboardingStatus('Sending Wi-Fi and OpenX_Server settings...', 'info');
  try {
    const bluetoothResult = await writeHomeConfigurationByBluetooth(session.deviceId, {
      ssid: homeWifiSsidEl.value.trim(),
      password: homeWifiPasswordEl.value,
      serverAddress: homeServerAddressEl.value.trim()
    });
    if (!bluetoothResult.success) {
      setHomeWizardStep('server');
      setHomeOnboardingStatus(bluetoothResult.message || 'Could not send settings to the Home Device over Bluetooth.', 'error');
      return;
    }
    const result = await window.openx.configureHomeDevice({
      sessionId: session.sessionId,
      ssid: homeWifiSsidEl.value.trim(),
      password: homeWifiPasswordEl.value,
      serverAddress: homeServerAddressEl.value.trim()
    });
    clearHomeSensitiveFields();
    if (result?.session) homeActiveSession = result.session;
    if (result?.success === false) {
      setHomeOnboardingStatus(result.message || 'Configuration failed.', 'error');
      return;
    }
    homeManualStep = 'connecting';
    renderHomeAutomation();
    scheduleHomeConnectionWait(session.sessionId);
  } catch (error) {
    setHomeOnboardingStatus(error?.message || 'Configuration failed.', 'error');
  } finally {
    if (homeSendConfigBtn) homeSendConfigBtn.disabled = false;
  }
}

async function applyHomeWizardDeviceName(deviceId, pairedDevice) {
  const desiredName = homeWizardDeviceNameInputEl?.value?.trim() || '';
  const currentName = String(pairedDevice?.deviceName || '').trim();
  if (!desiredName || desiredName === currentName || !window.openx?.renameHomeDevice) return;
  try {
    await window.openx.renameHomeDevice(deviceId, desiredName);
  } catch (_) {
    // Naming is a convenience on top of a pairing that already succeeded; a
    // failure here shouldn't block finishing setup.
  }
}

async function retryHomeDeviceConnection() {
  const session = getActiveHomeSession();
  if (!session || !window.openx?.waitForHomeDeviceConnection) {
    setHomeOnboardingStatus('Retrying is unavailable in this build.', 'error');
    return;
  }
  if (homeConnectingRetryBtn) homeConnectingRetryBtn.disabled = true;
  setHomeOnboardingStatus('Checking again for the Home Device...', 'info');
  try {
    const result = await window.openx.waitForHomeDeviceConnection(session.sessionId);
    if (result?.session) {
      homeActiveSession = result.session;
      homeManualStep = '';
    }
    if (result?.success === false) {
      setHomeOnboardingStatus(result.message || 'The Home Device still has not connected.', 'error');
    }
    await loadHomeOnboardingSnapshot();
  } catch (error) {
    setHomeOnboardingStatus(error?.message || 'Could not check the Home Device again.', 'error');
  } finally {
    if (homeConnectingRetryBtn) homeConnectingRetryBtn.disabled = false;
  }
}

async function approveHomePairing() {
  const session = getActiveHomeSession();
  if (!session) {
    setHomeOnboardingStatus('No Home Device is waiting for approval.', 'warning');
    return;
  }
  if (!window.openx?.approveHomeDevicePairing) {
    setHomeOnboardingStatus('Home Device approval is unavailable in this build.', 'error');
    return;
  }
  if (homeApprovePairingBtn) homeApprovePairingBtn.disabled = true;
  setHomeOnboardingStatus('Approving Home Device pairing...', 'info');
  try {
    const result = await window.openx.approveHomeDevicePairing(session.sessionId);
    if (result?.session) homeActiveSession = result.session;
    if (result?.success === false) {
      setHomeOnboardingStatus(result.message || 'Pairing was rejected.', 'error');
      return;
    }
    await applyHomeWizardDeviceName(session.deviceId, result?.device);
    homeManualStep = '';
    await loadHomeOnboardingSnapshot();
  } catch (error) {
    setHomeOnboardingStatus(error?.message || 'Could not approve pairing.', 'error');
  } finally {
    if (homeApprovePairingBtn) homeApprovePairingBtn.disabled = false;
  }
}

async function finishHomeOnboarding() {
  const session = getActiveHomeSession();
  clearHomeSensitiveFields();
  if (session?.sessionId && window.openx?.finishHomeOnboarding) {
    try {
      await window.openx.finishHomeOnboarding(session.sessionId);
    } catch (_) {}
  }
  homeActiveSession = null;
  homeSelectedDeviceId = '';
  homeManualStep = '';
  homeWizardNameDeviceId = '';
  setHomeOnboardingStatus('Home Device setup is complete.', 'success');
  await loadHomeOnboardingSnapshot();
}

async function cancelHomeOnboarding() {
  const session = getActiveHomeSession();
  if (homeAutoConnectionTimer) {
    clearTimeout(homeAutoConnectionTimer);
    homeAutoConnectionTimer = null;
  }
  clearHomeSensitiveFields();
  if (session?.sessionId && window.openx?.cancelHomeOnboarding) {
    try {
      await window.openx.cancelHomeOnboarding(session.sessionId);
    } catch (_) {}
  }
  homeActiveSession = null;
  homeManualStep = '';
  homeWizardNameDeviceId = '';
  setHomeOnboardingStatus('Home Device setup was cancelled.', 'info');
  await loadHomeOnboardingSnapshot();
}

function handleHomeOnboardingChanged(snapshot) {
  const previousIds = homeKnownDeviceIds;
  homeOnboardingSnapshot = snapshot?.success === false ? homeOnboardingSnapshot : snapshot;
  const devices = getHomeDevices();
  homeKnownDeviceIds = new Set(devices.map(device => device.deviceId).filter(Boolean));
  const newlyFound = devices.find(device =>
    device.pairingStatus !== 'paired' &&
    device.deviceId &&
    !previousIds.has(device.deviceId)
  );
  if (newlyFound && activeWorkspaceView !== 'home-automation') {
    showToast('Home Device found', `${newlyFound.deviceName || 'OpenX Home Device'} is ready for setup.`, 'info');
  }
  if (activeWorkspaceView === 'home-automation') renderHomeAutomation();
}

function formatDueDate(value) {
  const dueAt = new Date(value);
  if (Number.isNaN(dueAt.getTime())) return 'Time unavailable';
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (left, right) => left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
  const day = sameDay(dueAt, today)
    ? 'Today'
    : (sameDay(dueAt, tomorrow)
      ? 'Tomorrow'
      : dueAt.toLocaleDateString([], { month: 'short', day: 'numeric' }));
  return `${day}, ${dueAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function localDayRange(value = Date.now()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
  return { start, end };
}

function isSameLocalDay(value, reference = Date.now()) {
  const timestamp = new Date(value).getTime();
  const range = localDayRange(reference);
  return Number.isFinite(timestamp) && Boolean(range) && timestamp >= range.start && timestamp < range.end;
}

function relativeTime(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function toneDetails(tone = 'info') {
  const tones = {
    success: { symbol: '✓', color: 'var(--success-color)', soft: 'rgba(105, 213, 165, 0.13)' },
    warning: { symbol: '!', color: 'var(--warning-color)', soft: 'rgba(245, 199, 108, 0.13)' },
    error: { symbol: '×', color: 'var(--danger-color)', soft: 'rgba(255, 133, 143, 0.13)' },
    alarm: { symbol: '⏰', color: '#ff9f73', soft: 'rgba(255, 159, 115, 0.13)' },
    reminder: { symbol: '📝', color: '#ae93ff', soft: 'rgba(174, 147, 255, 0.13)' },
    timer: { symbol: '⏱️', color: '#69c8ff', soft: 'rgba(105, 200, 255, 0.13)' },
    info: { symbol: 'i', color: 'var(--accent-color)', soft: 'var(--accent-soft)' }
  };
  return tones[tone] || tones.info;
}

function recordNotification(title, message, tone = 'info') {
  const notification = {
    id: `notice-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: String(title || 'Assistant'),
    message: String(message || ''),
    tone,
    createdAt: new Date().toISOString()
  };
  notificationHistory = [notification, ...notificationHistory].slice(0, MAX_NOTIFICATION_HISTORY);
  saveUiState();
  renderActivityBadge();
  return notification;
}

function showToast(title, message, tone = 'info', options = {}) {
  const notice = options.record === false
    ? { title, message, tone }
    : recordNotification(title, message, tone);
  const colors = toneDetails(tone);
  const toast = document.createElement('div');
  toast.className = `toast ${tone}`;
  toast.style.setProperty('--toast-color', colors.color);
  toast.style.setProperty('--toast-soft', colors.soft);

  const icon = document.createElement('div');
  icon.className = 'notice-icon';
  icon.style.setProperty('--notice-color', colors.color);
  icon.style.setProperty('--notice-soft', colors.soft);
  icon.textContent = colors.symbol;

  const copy = document.createElement('div');
  copy.className = 'toast-copy';
  const heading = document.createElement('div');
  heading.className = 'toast-title';
  heading.textContent = notice.title;
  const body = document.createElement('div');
  body.className = 'toast-message';
  body.textContent = notice.message;
  copy.append(heading, body);

  const close = document.createElement('button');
  close.className = 'toast-close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Dismiss notification');
  close.textContent = '×';
  const remove = () => {
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 180);
  };
  close.addEventListener('click', remove);
  toast.append(icon, copy, close);
  toastRegionEl.prepend(toast);

  const duration = Number(options.duration ?? 5200);
  if (duration > 0) setTimeout(remove, duration);
  renderNotifications();
  return toast;
}

function inferReminderCategory(message, category = '') {
  const preferred = String(category || '').toLowerCase();
  if (['education', 'water', 'exercise', 'health', 'work', 'birthday', 'general'].includes(preferred)) return preferred;
  const text = String(message || '').toLowerCase();
  if (/\b(?:college|collage|school|class|lecture|campus|study|exam|assignment|homework)\b/.test(text)) return 'education';
  if (/\b(?:water|hydrate|hydration|drink)\b/.test(text)) return 'water';
  if (/\b(?:exercise|workout|gym|walk|run|running|yoga|stretch|fitness)\b/.test(text)) return 'exercise';
  if (/\b(?:medicine|medication|tablet|pill|doctor|appointment|health)\b/.test(text)) return 'health';
  if (/\b(?:work|office|meeting|project|deadline|client|email)\b/.test(text)) return 'work';
  if (/\b(?:birthday|anniversary|celebrate|party)\b/.test(text)) return 'birthday';
  return 'general';
}

function scheduleTone(kind, category = '', message = '') {
  const normalized = String(kind || '').toLowerCase();
  if (normalized === 'alarm') return { tone: 'alarm', color: '#ff9f73', symbol: '⏰' };
  if (normalized === 'timer') return { tone: 'timer', color: '#69c8ff', symbol: '⏱️' };
  const reminderCategory = inferReminderCategory(message, category);
  const presentations = {
    education: { color: '#7ea7ff', symbol: '🎓', label: 'School & college' },
    water: { color: '#54c7ec', symbol: '💧', label: 'Water' },
    exercise: { color: '#69d39c', symbol: '🏃', label: 'Exercise' },
    health: { color: '#ff8fa3', symbol: '💊', label: 'Health' },
    work: { color: '#f3b765', symbol: '💼', label: 'Work' },
    birthday: { color: '#f08ad4', symbol: '🎂', label: 'Birthday' },
    general: { color: '#ae93ff', symbol: '📝', label: 'Reminder' }
  };
  return { tone: 'reminder', category: reminderCategory, ...presentations[reminderCategory] };
}

function addScheduleFromResult(result) {
  const data = result?.data || {};
  if (!['timer.set', 'alarm.set', 'reminder.set'].includes(result?.intent) || !data.dueAt) return;
  const kind = data.kind || (result.intent === 'timer.set' ? 'Timer' : result.intent === 'alarm.set' ? 'Alarm' : 'Reminder');
  const message = result.intent === 'reminder.set'
    ? (result.entities?.reminderText || 'Reminder')
    : (result.intent === 'alarm.set'
      ? `Alarm for ${result.entities?.timeExpression || formatDueDate(data.dueAt)}`
      : `${result.entities?.duration || ''} minute timer`.trim());
  const item = {
    id: data.taskName || `schedule-${Date.now()}`,
    kind,
    message,
    category: data.category || result.entities?.reminderCategory || null,
    symbol: data.symbol || null,
    dueAt: data.dueAt,
    recurrence: data.recurrence || result.entities?.recurrence || '',
    status: 'scheduled',
    createdAt: new Date().toISOString()
  };
  scheduleItems = [item, ...scheduleItems.filter(entry => entry.id !== item.id)].slice(0, 50);
  saveUiState();
  if (!window.openx) armSchedule(item);
  renderActivity();
  const tone = scheduleTone(kind, item.category, item.message).tone;
  showToast(`${kind} scheduled`, `${message} · ${formatDueDate(data.dueAt)}`, tone);
}

function normalizeScheduleKind(value = '') {
  const kind = String(value || '').trim().toLowerCase();
  if (kind === 'timer') return 'Timer';
  if (kind === 'alarm') return 'Alarm';
  return 'Reminder';
}

function normalizeScheduleForActivity(entry = {}) {
  const id = String(entry.id || entry.taskName || entry.scheduleId || '').trim();
  if (!id || !entry.dueAt) return null;
  const due = new Date(entry.dueAt);
  if (Number.isNaN(due.getTime())) return null;
  const dueAt = due.toISOString();
  const kind = normalizeScheduleKind(entry.kind || entry.sourceKind);
  const status = String(entry.status || 'scheduled').toLowerCase();
  if (!['scheduled', 'paused', 'due'].includes(status)) return null;
  return {
    id,
    kind,
    message: String(entry.message || entry.title || kind).trim() || kind,
    category: entry.category || null,
    symbol: entry.symbol || null,
    dueAt,
    recurrence: entry.recurrence || '',
    status,
    createdAt: entry.createdAt || entry.dueAt || new Date().toISOString(),
    source: entry.source || 'scheduler'
  };
}

function replaceScheduleItemsFromRuntime(items = []) {
  scheduleItems = items
    .map(normalizeScheduleForActivity)
    .filter(Boolean)
    .sort((left, right) => new Date(left.dueAt) - new Date(right.dueAt))
    .slice(0, 80);
  saveUiState();
  renderActivity();
  if (activeWorkspaceView === 'reminders') renderRemindersApp();
}

async function refreshActivitySchedulesFromRuntime() {
  if (!window.openx?.getScheduleSnapshot) return;
  try {
    const snapshot = await window.openx.getScheduleSnapshot();
    replaceScheduleItemsFromRuntime(snapshot?.entries || snapshot?.data?.entries || []);
  } catch (error) {
    const now = Date.now();
    const visibleScheduleView = activeWorkspaceView === 'activity' || activeWorkspaceView === 'reminders';
    if (visibleScheduleView && now - scheduleSyncFailureToastAt > SCHEDULE_SYNC_FAILURE_TOAST_COOLDOWN_MS) {
      scheduleSyncFailureToastAt = now;
      showToast('Schedule sync unavailable', error?.message || 'Using the latest saved schedule data.', 'warning');
    }
  }
}

function armSchedule(item) {
  if (!item?.id || item.status !== 'scheduled') return;
  const existing = scheduleTimers.get(item.id);
  if (existing) clearTimeout(existing);
  const remaining = new Date(item.dueAt).getTime() - Date.now();
  if (!Number.isFinite(remaining)) return;
  if (remaining <= 0) {
    triggerSchedule(item.id);
    return;
  }
  const delay = Math.min(remaining, 2147483647);
  const timer = setTimeout(() => {
    scheduleTimers.delete(item.id);
    if (remaining > 2147483647) {
      armSchedule(scheduleItems.find(entry => entry.id === item.id));
    } else {
      triggerSchedule(item.id);
    }
  }, delay);
  scheduleTimers.set(item.id, timer);
}

function triggerSchedule(id) {
  const item = scheduleItems.find(entry => entry.id === id);
  if (!item || !['scheduled', 'due'].includes(item.status)) return;
  if (item.status === 'scheduled') item.status = 'due';
  saveUiState();
  showToast(`${item.kind} due`, item.message, scheduleTone(item.kind, item.category, item.message).tone, { duration: 0 });
  renderActivity();
}

function updateSchedule(id, changes) {
  const item = scheduleItems.find(entry => entry.id === id);
  if (!item) return;
  Object.assign(item, changes);
  saveUiState();
  if (item.status === 'scheduled' && !window.openx) armSchedule(item);
  renderActivity();
}

function snoozeSchedule(id, minutes = 5) {
  const item = scheduleItems.find(entry => entry.id === id);
  if (!item) return;
  updateSchedule(id, {
    status: 'scheduled',
    dueAt: new Date(Date.now() + (minutes * 60 * 1000)).toISOString()
  });
  window.openx?.handleScheduleAlert?.(id, 'snooze', minutes);
  showToast(`${item.kind} snoozed`, `It will return in ${minutes} minutes.`, 'info');
}

function isActivityScheduleKind(item = {}) {
  const kind = String(item.kind || item.sourceKind || '').trim().toLowerCase();
  return kind === 'alarm' || kind === 'reminder';
}

function isActivityScheduleVisible(item, now = Date.now()) {
  const status = String(item?.status || '').toLowerCase();
  if (!['scheduled', 'due'].includes(status)) return false;
  if (!isActivityScheduleKind(item)) return false;
  return isSameLocalDay(item.dueAt, now);
}

function renderSchedules() {
  scheduleListEl.replaceChildren();
  const now = Date.now();
  const visible = scheduleItems
    .filter(item => isActivityScheduleVisible(item, now))
    .sort((left, right) => new Date(left.dueAt) - new Date(right.dueAt));
  scheduleCountEl.textContent = String(visible.length);
  if (visible.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No alarms or reminders for today.';
    scheduleListEl.appendChild(empty);
    return;
  }

  visible.slice(0, 12).forEach(item => {
    const style = scheduleTone(item.kind, item.category, item.message);
    const card = document.createElement('article');
    card.className = 'schedule-card';
    card.style.setProperty('--schedule-color', style.color);
    const top = document.createElement('div');
    top.className = 'schedule-card-top';
    const copy = document.createElement('div');
    const kind = document.createElement('div');
    kind.className = 'schedule-kind';
    kind.textContent = `${item.symbol || style.symbol} ${item.kind === 'Reminder' ? style.label : item.kind}`;
    const title = document.createElement('div');
    title.className = 'schedule-title';
    title.textContent = item.message;
    const due = document.createElement('div');
    due.className = 'schedule-due';
    const recurrence = String(item.recurrence || '').trim();
    due.textContent = recurrence
      ? `${formatDueDate(item.dueAt)} · repeats ${recurrence.replace(/-/g, ' ')}`
      : formatDueDate(item.dueAt);
    copy.append(kind, title, due);
    const state = document.createElement('span');
    state.className = 'schedule-state';
    state.textContent = item.status === 'due' ? 'Due now' : (item.status === 'completed' ? 'Done' : 'Scheduled');
    top.append(copy, state);
    card.appendChild(top);

    const actions = document.createElement('div');
    actions.className = 'schedule-actions';
    if (['scheduled', 'due'].includes(item.status)) {
      const snooze = document.createElement('button');
      snooze.className = 'mini-btn';
      snooze.type = 'button';
      snooze.textContent = 'Snooze 5 min';
      snooze.addEventListener('click', () => snoozeSchedule(item.id));
      actions.appendChild(snooze);
    }
    const dismiss = document.createElement('button');
    dismiss.className = 'mini-btn danger';
    dismiss.type = 'button';
    dismiss.textContent = item.status === 'completed' ? 'Remove' : 'Stop';
    dismiss.addEventListener('click', () => {
      window.openx?.handleScheduleAlert?.(item.id, 'stop');
      updateSchedule(item.id, { status: 'dismissed' });
    });
    actions.appendChild(dismiss);
    card.appendChild(actions);
    scheduleListEl.appendChild(card);
  });
}

function isRecurringDailySchedule(item = {}) {
  const recurrence = String(item.recurrence || item.metadata?.recurrence || '').trim().toLowerCase();
  return recurrence === 'daily' || recurrence === 'every-day' || recurrence.includes('daily');
}

function isScheduleActiveForManagement(item = {}) {
  const status = String(item.status || '').toLowerCase();
  return ['scheduled', 'paused', 'due', 'running'].includes(status);
}

function scheduleManagementStatus(item = {}) {
  const status = String(item.status || '').toLowerCase();
  if (status === 'due') return 'Due now';
  if (status === 'paused') return 'Paused';
  if (status === 'running') return 'Running';
  if (status === 'completed') return 'Completed';
  return 'Scheduled';
}

function scheduleRecurrenceLabel(item = {}) {
  const recurrence = String(item.recurrence || item.metadata?.recurrence || '').trim();
  return recurrence ? `Repeats ${recurrence.replace(/[:-]/g, ' ')}` : 'One time';
}

function formatScheduleClock(value) {
  const dueAt = new Date(value);
  if (Number.isNaN(dueAt.getTime())) return '--';
  return dueAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatScheduleDay(value) {
  const dueAt = new Date(value);
  if (Number.isNaN(dueAt.getTime())) return 'No date';
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (isSameLocalDay(dueAt, today)) return 'Today';
  if (isSameLocalDay(dueAt, tomorrow)) return 'Tomorrow';
  return dueAt.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function scheduleKindLabel(item = {}) {
  const kind = String(item.kind || '').toLowerCase();
  if (kind === 'alarm') return 'Alarm';
  if (kind === 'timer') return 'Timer';
  if (kind === 'stopwatch') return 'Stopwatch';
  return 'Reminder';
}

function createReminderAppCard(item) {
  const style = scheduleTone(item.kind, item.category, item.message);
  const card = document.createElement('article');
  card.className = 'reminders-item';
  card.style.setProperty('--schedule-color', style.color);
  const time = document.createElement('span');
  time.className = 'reminders-item-time';
  const clock = document.createElement('strong');
  clock.textContent = formatScheduleClock(item.dueAt);
  const day = document.createElement('small');
  day.textContent = formatScheduleDay(item.dueAt);
  time.append(clock, day);

  const copy = document.createElement('span');
  copy.className = 'reminders-item-copy';
  const title = document.createElement('strong');
  title.textContent = item.message || item.title || item.kind || 'Schedule';
  const meta = document.createElement('span');
  meta.className = 'reminders-item-meta';
  const type = document.createElement('small');
  type.textContent = scheduleKindLabel(item);
  const recurrence = document.createElement('small');
  recurrence.textContent = scheduleRecurrenceLabel(item);
  const status = document.createElement('small');
  status.textContent = scheduleManagementStatus(item);
  meta.append(type, recurrence, status);
  copy.append(title, meta);

  const remove = document.createElement('button');
  remove.className = 'reminders-remove-btn';
  remove.type = 'button';
  remove.title = 'Remove';
  remove.setAttribute('aria-label', `Remove ${title.textContent}`);
  remove.textContent = '-';
  remove.addEventListener('click', () => removeReminderAppSchedule(item.id));
  card.append(time, copy, remove);
  return card;
}

function setReminderCounter(counterEl, count) {
  if (counterEl) counterEl.textContent = String(count);
}

function renderReminderGroup(listEl, counterEl, items, emptyText) {
  if (!listEl) return;
  listEl.replaceChildren();
  setReminderCounter(counterEl, items.length);
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'reminders-empty';
    empty.textContent = emptyText;
    listEl.appendChild(empty);
    return;
  }
  items.forEach(item => listEl.appendChild(createReminderAppCard(item)));
}

function setRemindersAppTab(tab) {
  activeRemindersTab = tab === 'alarms' ? 'alarms' : 'reminders';
  remindersAppTabs.forEach(button => {
    const isActive = button.dataset.remindersTab === activeRemindersTab;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });
  remindersAppPanels.forEach(panel => {
    const isActive = panel.dataset.remindersPanel === activeRemindersTab;
    panel.classList.toggle('active', isActive);
    panel.hidden = !isActive;
  });
}

async function removeReminderAppSchedule(id) {
  const scheduleId = String(id || '').trim();
  if (!scheduleId) return;
  try {
    const result = await window.openx?.handleScheduleAlert?.(scheduleId, 'remove');
    if (result?.success === false) {
      showToast('Could not remove item', result.error || 'Scheduler unavailable.', 'error');
      return;
    }
    scheduleItems = scheduleItems.filter(item => item.id !== scheduleId && item.taskName !== scheduleId);
    saveUiState();
    showToast('Removed', 'That schedule item was removed.', 'success');
    await refreshActivitySchedulesFromRuntime();
    renderRemindersApp();
  } catch (error) {
    showToast('Could not remove item', error?.message || 'Scheduler unavailable.', 'error');
  }
}

function renderRemindersApp() {
  const activeItems = scheduleItems
    .filter(isScheduleActiveForManagement)
    .sort((left, right) => new Date(left.dueAt) - new Date(right.dueAt));
  const reminders = activeItems.filter(item => String(item.kind || '').toLowerCase() === 'reminder');
  const alarms = activeItems.filter(item => String(item.kind || '').toLowerCase() === 'alarm');
  const dailyReminders = reminders.filter(isRecurringDailySchedule);
  const normalReminders = reminders.filter(item => !isRecurringDailySchedule(item));
  const dailyAlarms = alarms.filter(isRecurringDailySchedule);
  const normalAlarms = alarms.filter(item => !isRecurringDailySchedule(item));
  if (remindersAppSummaryEl) {
    remindersAppSummaryEl.textContent = `${reminders.length} reminders, ${alarms.length} alarms`;
  }
  if (remindersTotalRemindersEl) remindersTotalRemindersEl.textContent = String(reminders.length);
  if (remindersTotalAlarmsEl) remindersTotalAlarmsEl.textContent = String(alarms.length);
  renderReminderGroup(dailyRemindersListEl, dailyRemindersCountEl, dailyReminders, 'No daily reminders.');
  renderReminderGroup(normalRemindersListEl, normalRemindersCountEl, normalReminders, 'No normal reminders.');
  renderReminderGroup(dailyAlarmsListEl, dailyAlarmsCountEl, dailyAlarms, 'No daily alarms.');
  renderReminderGroup(normalAlarmsListEl, normalAlarmsCountEl, normalAlarms, 'No other alarms.');
}

async function openRemindersApp() {
  setWorkspaceView('reminders');
  setRemindersAppTab(activeRemindersTab);
  await refreshActivitySchedulesFromRuntime();
  renderRemindersApp();
}

function closeRemindersApp() {
  setWorkspaceView('apps');
}

function renderNotifications() {
  notificationListEl.replaceChildren();
  if (notificationHistory.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Important assistant notifications will appear here.';
    notificationListEl.appendChild(empty);
    return;
  }
  notificationHistory.slice(0, 15).forEach(notice => {
    const colors = toneDetails(notice.tone);
    const row = document.createElement('article');
    row.className = 'notice-item';
    const icon = document.createElement('div');
    icon.className = 'notice-icon';
    icon.style.setProperty('--notice-color', colors.color);
    icon.style.setProperty('--notice-soft', colors.soft);
    icon.textContent = colors.symbol;
    const copy = document.createElement('div');
    copy.className = 'notice-copy';
    const title = document.createElement('div');
    title.className = 'notice-title';
    title.textContent = notice.title;
    const message = document.createElement('div');
    message.className = 'notice-message';
    message.textContent = notice.message;
    copy.append(title, message);
    const time = document.createElement('time');
    time.className = 'notice-time';
    time.dateTime = notice.createdAt;
    time.textContent = relativeTime(notice.createdAt);
    row.append(icon, copy, time);
    notificationListEl.appendChild(row);
  });
}

function renderActivityBadge() {
  const now = Date.now();
  const pending = scheduleItems.filter(item => isActivityScheduleVisible(item, now)).length;
  activityBadge.textContent = String(pending);
  activityBadge.hidden = pending === 0;
}

function renderActivity() {
  const now = new Date();
  document.getElementById('activity-date').textContent = `${now.toLocaleDateString([], { weekday: 'short' })}\n${now.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  renderSchedules();
  renderNotifications();
  renderActivityBadge();
}

function handleCommandResult(result) {
  addScheduleFromResult(result);
  if (result?.success === false) {
    showToast('Command needs attention', result.error || result.response || 'The command could not be completed.', 'error');
  } else if (result?.requiresConfirmation) {
    showToast('Confirmation required', result.confirmationMessage || result.response || 'Review this action before continuing.', 'warning');
  }
}

function addConfirmationPrompt(result) {
  pendingConfirmation = {
    commandId: result.commandId,
    intent: result.intent,
    entities: result.entities
  };

  addMessage(
    result.response || `Please confirm this action, ${getHonorific()}.`,
    'system',
    `${getAssistantDisplayName()} - confirmation required`
  );
}

async function runHeaderApp(button, operation) {
  if (!button || typeof operation !== 'function') return;
  button.classList.add('opening');
  button.setAttribute('aria-busy', 'true');
  try {
    await operation();
    window.setTimeout(closeChatWindow, 80);
  } finally {
    window.setTimeout(() => {
      button.classList.remove('opening');
      button.removeAttribute('aria-busy');
    }, 180);
  }
}

async function sendCommand(text) {
  if (!text.trim() || isProcessing) {
    return;
  }

  await ensureConversationReady();

  if (pendingConfirmation) {
    addMessage(text, 'user', 'You - just now');
    pendingConfirmation = null;
    isProcessing = true;
    showTyping();

    try {
      const result = await window.openx.processCommand(text, 'chat');
      hideTyping();
      handleCommandResult(result);
      if (result.requiresConfirmation) {
        addConfirmationPrompt(result);
      } else {
        const response = result.response || `Operation completed, ${getHonorific()}.`;
        addMessage(response, 'assistant', assistantMeta(), {
          choices: result.data?.choices,
          resultEntries: normalizeResultEntries(result)
        });

      }
    } catch (err) {
      hideTyping();
      addMessage(`Unable to complete that action, ${getHonorific()}.`, 'system', assistantMeta('error'));
      showToast('Command failed', err?.message || 'Unable to complete that action.', 'error');
    } finally {
      isProcessing = false;
      inputBox.focus();
    }
    return;
  }

  isProcessing = true;
  addMessage(text, 'user', 'You - just now');
  inputBox.value = '';
  showTyping();

  try {
    const result = await window.openx.processCommand(text, 'chat');
    hideTyping();
    handleCommandResult(result);

    if (result.requiresConfirmation) {
      addConfirmationPrompt(result);
      return;
    }

    const response = result.response || `Operation completed, ${getHonorific()}.`;
    addMessage(response, 'assistant', assistantMeta(), {
      choices: result.data?.choices,
      resultEntries: normalizeResultEntries(result)
    });

  } catch (err) {
    hideTyping();
    addMessage(`An error occurred, ${getHonorific()}.`, 'system', assistantMeta('error'));
    showToast('Command failed', err?.message || 'An unexpected error occurred.', 'error');
  } finally {
    isProcessing = false;
    inputBox.focus();
  }
}

function handleSend() {
  const text = inputBox.value.trim();
  if (text) {
    sendCommand(text);
  }
}

function applyTheme(themeId) {
  if (!settingsSnapshot) {
    return;
  }

  const theme = (settingsSnapshot.availableThemes || []).find(entry => entry.id === themeId)
    || settingsSnapshot.availableThemes?.[0];
  if (!theme) {
    return;
  }

  selectedThemeId = theme.id;
  const root = document.documentElement;
  root.style.setProperty('--panel-bg', theme.colors.panel);
  root.style.setProperty('--surface-bg', theme.colors.surface);
  root.style.setProperty('--surface-strong', theme.colors.surfaceStrong);
  root.style.setProperty('--border-color', theme.colors.border);
  root.style.setProperty('--text-color', theme.colors.text);
  root.style.setProperty('--muted-color', theme.colors.muted);
  root.style.setProperty('--accent-color', theme.colors.accent);
  root.dataset.glassTheme = theme.id;
  applyGlassTint(document.getElementById(fieldIds.glassTint)?.value ?? settingsSnapshot?.settings?.chat?.glassTint ?? 42);

  document.querySelectorAll('.theme-card').forEach(card => {
    card.classList.toggle('active', card.dataset.themeId === theme.id);
  });

  if (settingsSnapshot) {
    updateSettingsSummary();
  }
}

function applyGlassTint(value) {
  const tint = Math.max(0, Math.min(100, Number(value) || 0));
  const strength = tint / 100;
  const themeId = selectedThemeId || 'graphite';
  const tones = {
    graphite: [48, 50, 58],
    'white-glass': [255, 255, 255],
    'black-glass': [0, 0, 0]
  };
  const [red, green, blue] = tones[themeId] || tones.graphite;
  const root = document.documentElement;
  const useDarkText = themeId === 'white-glass' && tint >= 28;
  const textColor = useDarkText ? '#161619' : '#f8f8fa';
  const mutedColor = useDarkText ? 'rgba(22, 22, 25, 0.68)' : 'rgba(255, 255, 255, 0.72)';
  const controlTone = useDarkText ? '0, 0, 0' : '255, 255, 255';
  const borderTone = useDarkText ? '0, 0, 0' : '255, 255, 255';
  const primaryTone = useDarkText ? '18, 18, 20' : '255, 255, 255';
  const primaryText = useDarkText ? '#ffffff' : '#151517';
  const formatAlpha = value => Math.min(0.96, value).toFixed(3);
  const shellAlpha = useDarkText ? 0.78 + (strength * 0.14) : 0.72 + (strength * 0.2);
  const surfaceAlpha = useDarkText ? 0.2 + (strength * 0.16) : 0.12 + (strength * 0.16);
  const surfaceStrongAlpha = useDarkText ? 0.28 + (strength * 0.18) : 0.18 + (strength * 0.2);
  const borderAlpha = 0.18 + (strength * 0.14);
  const controlAlpha = 0.12 + (strength * 0.1);
  const controlStrongAlpha = 0.18 + (strength * 0.12);
  root.style.setProperty('--adaptive-shell', `rgba(${red}, ${green}, ${blue}, ${formatAlpha(shellAlpha)})`);
  root.style.setProperty('--adaptive-surface', `rgba(${red}, ${green}, ${blue}, ${formatAlpha(surfaceAlpha)})`);
  root.style.setProperty('--adaptive-surface-strong', `rgba(${red}, ${green}, ${blue}, ${formatAlpha(surfaceStrongAlpha)})`);
  root.style.setProperty('--adaptive-border', `rgba(${borderTone}, ${formatAlpha(borderAlpha)})`);
  root.style.setProperty('--adaptive-text', textColor);
  root.style.setProperty('--adaptive-muted', mutedColor);
  root.style.setProperty('--adaptive-control', `rgba(${controlTone}, ${formatAlpha(controlAlpha)})`);
  root.style.setProperty('--adaptive-control-strong', `rgba(${controlTone}, ${formatAlpha(controlStrongAlpha)})`);
  root.style.setProperty('--adaptive-primary', `rgba(${primaryTone}, 0.9)`);
  root.style.setProperty('--adaptive-primary-text', primaryText);
  root.style.setProperty('--adaptive-text-shadow', useDarkText ? '0 1px 2px rgba(255, 255, 255, 0.38)' : '0 1px 3px rgba(0, 0, 0, 0.72)');
  root.style.setProperty('--text-color', textColor);
  root.style.setProperty('--muted-color', mutedColor);
  root.dataset.glassContrast = useDarkText ? 'dark-text' : 'light-text';
  document.querySelectorAll('.primary-btn, #send-btn').forEach(button => {
    button.style.setProperty('background-color', `rgba(${primaryTone}, 0.9)`, 'important');
    button.style.setProperty('color', primaryText, 'important');
  });
  const valueEl = document.getElementById('glass-tint-value');
  if (valueEl) valueEl.textContent = `${Math.round(tint)}%`;
}

function scheduleGlassTintUpdate(value) {
  pendingGlassTintValue = value;
  if (glassTintAnimationFrame !== null) return;
  glassTintAnimationFrame = requestAnimationFrame(() => {
    glassTintAnimationFrame = null;
    applyGlassTint(pendingGlassTintValue);
  });
}

function renderThemeCards() {
  themeGrid.replaceChildren();
  const captions = {
    graphite: 'Neutral glass with balanced contrast.',
    'white-glass': 'Bright translucent glass with dark type.',
    'black-glass': 'Deep translucent glass with bright type.'
  };
  (settingsSnapshot?.availableThemes || []).forEach(theme => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'theme-card';
    card.dataset.themeId = theme.id;
    const preview = document.createElement('div');
    preview.className = 'theme-preview';
    preview.style.background = `radial-gradient(circle at top right, rgba(255,255,255,0.14), transparent 30%), linear-gradient(160deg, rgba(255,255,255,0.06), transparent 35%), ${theme.colors.panel}`;
    preview.style.border = `1px solid ${theme.colors.border}`;

    const name = document.createElement('div');
    name.className = 'theme-name';
    name.textContent = theme.label;

    const caption = document.createElement('div');
    caption.className = 'theme-caption';
    caption.textContent = captions[theme.id] || theme.id;

    const selection = document.createElement('div');
    selection.className = 'theme-select';
    const themeId = document.createElement('span');
    themeId.className = 'section-note';
    themeId.textContent = theme.id;
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'theme-choice';
    radio.value = theme.id;
    selection.append(themeId, radio);
    card.append(preview, name, caption, selection);
    card.addEventListener('click', () => {
      applyTheme(theme.id);
      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
      }
    });
    themeGrid.appendChild(card);
  });
}

function setFieldValue(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.value = value || '';
  }
}

function getProfileValue(field) {
  const inputValue = field.fieldId ? document.getElementById(field.fieldId)?.value : '';
  const savedValue = settingsSnapshot?.settings?.userProfile?.[field.key];
  return String(profileEditorOpen ? inputValue : savedValue || inputValue || '').trim();
}

function renderProfileSummary() {
  if (!profileSummaryListEl) return;
  profileSummaryListEl.replaceChildren();
  PROFILE_SUMMARY_FIELDS.forEach(field => {
    const row = document.createElement('div');
    row.className = 'profile-summary-row';
    const label = document.createElement('span');
    label.className = 'profile-summary-label';
    label.textContent = field.label;
    const separator = document.createElement('span');
    separator.className = 'profile-summary-separator';
    separator.textContent = ' :- ';
    const value = document.createElement('span');
    value.className = 'profile-summary-value';
    value.textContent = getProfileValue(field) || '--';
    row.append(label, separator, value);
    profileSummaryListEl.appendChild(row);
  });
}

function setProfileEditorOpen(open) {
  profileEditorOpen = open === true;
  if (profileEditorEl) {
    profileEditorEl.classList.toggle('open', profileEditorOpen);
    profileEditorEl.setAttribute('aria-hidden', String(!profileEditorOpen));
    profileEditorEl.querySelectorAll('input, select, textarea, button').forEach(element => {
      element.tabIndex = profileEditorOpen ? 0 : -1;
    });
  }
  if (profileSummaryListEl) {
    profileSummaryListEl.classList.toggle('editing', profileEditorOpen);
    profileSummaryListEl.setAttribute('aria-hidden', String(profileEditorOpen));
  }
  if (profileEditBtn) {
    profileEditBtn.setAttribute('aria-expanded', String(profileEditorOpen));
    profileEditBtn.setAttribute('aria-label', profileEditorOpen ? 'Close user profile editor' : 'Edit user profile');
    const label = profileEditBtn.querySelector('span');
    if (label) label.textContent = profileEditorOpen ? 'x' : '\u270E';
  }
  if (profileEditorOpen) {
    window.setTimeout(() => document.getElementById(fieldIds.profileFullName)?.focus?.(), 80);
  } else {
    renderProfileSummary();
  }
}

function populateSettingsForm() {
  const settings = settingsSnapshot?.settings;
  if (!settings) {
    return;
  }

  setFieldValue(fieldIds.assistantDisplayName, settings.assistant.displayName);
  setFieldValue(fieldIds.assistantHonorific, settings.assistant.honorific);
  const userProfile = settings.userProfile || {};
  setFieldValue(fieldIds.profileFullName, userProfile.fullName);
  setFieldValue(fieldIds.profileFirstName, userProfile.firstName);
  setFieldValue(fieldIds.profileMiddleName, userProfile.middleName);
  setFieldValue(fieldIds.profileLastName, userProfile.lastName);
  setFieldValue(fieldIds.profileEmail, userProfile.email);
  setFieldValue(fieldIds.profilePhone, userProfile.phone);
  setFieldValue(fieldIds.profileDateOfBirth, userProfile.dateOfBirth);
  setFieldValue(fieldIds.profileGender, userProfile.gender);
  setFieldValue(fieldIds.profileNationality, userProfile.nationality);
  setFieldValue(fieldIds.profileUsername, userProfile.username);
  setFieldValue(fieldIds.profileAddressLine1, userProfile.addressLine1);
  setFieldValue(fieldIds.profileAddressLine2, userProfile.addressLine2);
  setFieldValue(fieldIds.profileCity, userProfile.city);
  setFieldValue(fieldIds.profileState, userProfile.state);
  setFieldValue(fieldIds.profilePostalCode, userProfile.postalCode);
  setFieldValue(fieldIds.profileCountry, userProfile.country);
  setFieldValue(fieldIds.profileCompany, userProfile.company);
  setFieldValue(fieldIds.profileJobTitle, userProfile.jobTitle);
  setFieldValue(fieldIds.profileDepartment, userProfile.department);
  setFieldValue(fieldIds.profileRole, userProfile.role);
  setFieldValue(fieldIds.profileWebsite, userProfile.website);
  setFieldValue(fieldIds.profileLinkedin, userProfile.linkedin);
  setFieldValue(fieldIds.profileGithub, userProfile.github);
  setFieldValue(fieldIds.profileTwitter, userProfile.twitter);
  setFieldValue(fieldIds.chatMaxHistory, String(settings.chat.maxHistory));
  setFieldValue(fieldIds.glassTint, String(settings.chat.glassTint ?? 42));
  applyGlassTint(settings.chat.glassTint ?? 42);
  setFieldValue(fieldIds.systemPermissionLevel, settings.system?.permissionLevel || 'medium');
  setFieldValue(fieldIds.cloudRelayUrl, settings.cloud?.relayUrl || 'wss://openx-server.onrender.com/ws');
  setFieldValue(fieldIds.cloudConnectionTimeout, String(settings.cloud?.connectionTimeoutMs || 10000));
  if (cloudAutoConnectEl) cloudAutoConnectEl.checked = settings.cloud?.autoConnect === true;
  if (cloudReconnectEnabledEl) cloudReconnectEnabledEl.checked = settings.cloud?.reconnectEnabled !== false;
  if (cloudHeartbeatEnabledEl) cloudHeartbeatEnabledEl.checked = settings.cloud?.heartbeatEnabled !== false;
  updatePermissionScale();
  populateModeFields(settings.modes || []);

  renderThemeCards();
  applyTheme(settings.chat.themeId);
  renderProfileSummary();

  const selectedThemeInput = document.querySelector(`input[name="theme-choice"][value="${settings.chat.themeId}"]`);
  if (selectedThemeInput) {
    selectedThemeInput.checked = true;
  }
}

function updatePermissionScale() {
  const selected = document.getElementById(fieldIds.systemPermissionLevel)?.value || 'medium';
  document.querySelectorAll('.permission-option').forEach(button => {
    const isActive = button.dataset.permission === selected;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-checked', String(isActive));
  });
}

function setActiveSystemBlock(blockName) {
  const allowedBlocks = new Set(['identity', 'theme', 'security', 'storage']);
  activeSystemBlock = allowedBlocks.has(blockName) ? blockName : 'identity';
  if (systemOptionsEl) systemOptionsEl.dataset.activeBlock = activeSystemBlock;

  systemOptionButtons.forEach(button => {
    const isActive = button.dataset.systemBlockTarget === activeSystemBlock;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  systemBlocks.forEach(block => {
    const isOpen = activeSettingsSection === 'system' && block.dataset.systemBlock === activeSystemBlock;
    block.classList.toggle('open', isOpen);
  });
}

function setActivePhonePanel(panelName) {
  const allowedPanels = new Set(['connect']);
  activePhonePanel = allowedPanels.has(panelName) ? panelName : 'connect';
  phonePanels.forEach(panel => {
    const isOpen = panel.dataset.phonePanel === activePhonePanel;
    panel.classList.toggle('active', isOpen);
    panel.hidden = !isOpen;
  });
  loadCloudStatus();
  loadCloudPairingStatus();
  loadPhoneDevices();
}

function setActiveSettingsSection(sectionName) {
  activeSettingsSection = sectionName || null;
  if (settingsNavEl) {
    settingsNavEl.dataset.activeSection = activeSettingsSection || 'system';
    settingsNavEl.hidden = false;
  }

  settingsNavButtons.forEach(button => {
    const isActive = button.dataset.sectionTarget === activeSettingsSection;
    button.classList.toggle('active', isActive);
  });

  if (systemOptionsEl) {
    const systemActive = activeSettingsSection === 'system';
    systemOptionsEl.hidden = !systemActive;
    systemOptionsEl.classList.toggle('open', systemActive);
  }

  settingsSections.forEach(section => {
    const isOpen = section.dataset.settingsSection === activeSettingsSection
      && (activeSettingsSection !== 'system' || section.dataset.systemBlock === activeSystemBlock);
    section.classList.toggle('open', isOpen);
  });

  setActiveSystemBlock(activeSystemBlock);
  if (activeSettingsSection === 'system' && activeSystemBlock === 'storage') {
    updateChatStorageStatus();
  }
  const settingsContent = document.querySelector('.settings-content');
  if (settingsContent) settingsContent.scrollTop = 0;
}

function splitInstructionDraft(value) {
  return String(value || '')
    .split(/[\n,]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizeModeDrafts(modes) {
  return (Array.isArray(modes) ? modes : []).slice(0, MODE_LIMIT).map((mode, modeIndex) => {
    const apps = (Array.isArray(mode?.apps) ? mode.apps : [])
      .slice(0, MODE_APP_LIMIT)
      .map(app => {
        if (app && typeof app === 'object' && !Array.isArray(app)) {
          return {
            name: String(app.name || app.appName || '').trim(),
            instructions: Array.isArray(app.instructions)
              ? app.instructions.join('\n')
              : String(app.instructions || app.commands || '').trim()
          };
        }

        return {
          name: String(app || '').trim(),
          instructions: ''
        };
      })
      .filter(app => app.name || app.instructions);

    const legacyCommands = Array.isArray(mode?.commands) ? mode.commands.join('\n') : String(mode?.commands || '').trim();
    if (legacyCommands && apps.length > 0) {
      apps[0].instructions = [apps[0].instructions, legacyCommands].filter(Boolean).join('\n');
    }

    return {
      id: String(mode?.id || `mode-${modeIndex + 1}`),
      name: String(mode?.name || '').trim(),
      apps,
      commands: legacyCommands && apps.length === 0 ? legacyCommands : ''
    };
  });
}

function populateModeFields(modes) {
  modeDrafts = normalizeModeDrafts(modes);
  renderModeEditor();
}

function createEmptyMode() {
  return {
    id: `mode-${Date.now()}`,
    name: '',
    apps: [{ name: '', instructions: '' }],
    commands: ''
  };
}

function renderModeEditor() {
  modeGridEl.replaceChildren();
  modeUsageEl.textContent = `${modeDrafts.length} / ${MODE_LIMIT} saved`;
  modeAddBtn.disabled = modeDrafts.length >= MODE_LIMIT;

  if (modeDrafts.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'section-note';
    empty.textContent = 'No modes saved yet. Press + to add one.';
    modeGridEl.appendChild(empty);
    return;
  }

  selectedModeIndex = Math.max(0, Math.min(selectedModeIndex, modeDrafts.length - 1));
  const modeTabs = document.createElement('div');
  modeTabs.className = 'mode-tabs';
  modeDrafts.forEach((mode, index) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `mode-tab${index === selectedModeIndex ? ' active' : ''}`;
    tab.textContent = mode.name || `Mode ${index + 1}`;
    tab.addEventListener('click', () => {
      selectedModeIndex = index;
      renderModeEditor();
    });
    modeTabs.appendChild(tab);
  });
  modeGridEl.appendChild(modeTabs);

  modeDrafts.forEach((mode, modeIndex) => {
    if (modeIndex !== selectedModeIndex) return;
    const row = document.createElement('div');
    row.className = 'mode-row';

    const header = document.createElement('div');
    header.className = 'mode-row-header';
    const title = document.createElement('div');
    title.className = 'mode-row-title';
    title.textContent = mode.name || `Mode ${modeIndex + 1}`;
    const deleteModeBtn = document.createElement('button');
    deleteModeBtn.className = 'danger-btn';
    deleteModeBtn.type = 'button';
    deleteModeBtn.textContent = 'Delete';
    deleteModeBtn.addEventListener('click', () => {
      modeDrafts.splice(modeIndex, 1);
      selectedModeIndex = Math.max(0, modeIndex - 1);
      renderModeEditor();
    });
    header.appendChild(title);
    header.appendChild(deleteModeBtn);
    row.appendChild(header);

    const nameLabel = document.createElement('label');
    nameLabel.className = 'field-wrap';
    const nameText = document.createElement('span');
    nameText.className = 'field-label';
    nameText.textContent = 'Mode Name';
    const nameInput = document.createElement('input');
    nameInput.className = 'field';
    nameInput.type = 'text';
    nameInput.placeholder = 'development';
    nameInput.value = mode.name || '';
    nameInput.addEventListener('input', () => {
      modeDrafts[modeIndex].name = nameInput.value;
      modeTabs.children[modeIndex].textContent = nameInput.value.trim() || `Mode ${modeIndex + 1}`;
    });
    nameLabel.appendChild(nameText);
    nameLabel.appendChild(nameInput);
    row.appendChild(nameLabel);

    const appHeader = document.createElement('div');
    appHeader.className = 'mode-app-header';
    const appTitle = document.createElement('div');
    appTitle.className = 'mode-row-title';
    appTitle.textContent = `Apps ${mode.apps.length} / ${MODE_APP_LIMIT}`;
    const addAppBtn = document.createElement('button');
    addAppBtn.className = 'secondary-btn';
    addAppBtn.type = 'button';
    addAppBtn.textContent = '+ App';
    addAppBtn.disabled = mode.apps.length >= MODE_APP_LIMIT;
    addAppBtn.addEventListener('click', () => {
      modeDrafts[modeIndex].apps.push({ name: '', instructions: '' });
      selectedModeApps.set(modeIndex, modeDrafts[modeIndex].apps.length - 1);
      renderModeEditor();
    });
    appHeader.appendChild(appTitle);
    appHeader.appendChild(addAppBtn);
    row.appendChild(appHeader);

    const appList = document.createElement('div');
    appList.className = 'mode-app-list';
    const selectedAppIndex = Math.max(0, Math.min(selectedModeApps.get(modeIndex) || 0, Math.max(0, mode.apps.length - 1)));
    selectedModeApps.set(modeIndex, selectedAppIndex);
    const appTabs = document.createElement('div');
    appTabs.className = 'mode-app-tabs';
    mode.apps.forEach((app, index) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = `mode-app-tab${index === selectedAppIndex ? ' active' : ''}`;
      tab.textContent = app.name || `App ${index + 1}`;
      tab.addEventListener('click', () => {
        selectedModeApps.set(modeIndex, index);
        renderModeEditor();
      });
      appTabs.appendChild(tab);
    });
    appList.appendChild(appTabs);
    mode.apps.forEach((app, appIndex) => {
      if (appIndex !== selectedAppIndex) return;
      const appRow = document.createElement('div');
      appRow.className = 'mode-app-row';

      const appNameLabel = document.createElement('label');
      appNameLabel.className = 'field-wrap';
      const appNameText = document.createElement('span');
      appNameText.className = 'field-label';
      appNameText.textContent = `App ${appIndex + 1}`;
      const appInput = document.createElement('input');
      appInput.className = 'field';
      appInput.type = 'text';
      appInput.placeholder = 'youtube';
      appInput.value = app.name || '';
      appInput.addEventListener('input', () => {
        modeDrafts[modeIndex].apps[appIndex].name = appInput.value;
        appTabs.children[appIndex].textContent = appInput.value.trim() || `App ${appIndex + 1}`;
      });
      appNameLabel.appendChild(appNameText);
      appNameLabel.appendChild(appInput);

      const instructionLabel = document.createElement('label');
      instructionLabel.className = 'field-wrap';
      const instructionText = document.createElement('span');
      instructionText.className = 'field-label';
      instructionText.textContent = 'Instructions';
      const instructionInput = document.createElement('textarea');
      instructionInput.className = 'field field-textarea';
      instructionInput.placeholder = 'set volume to 100\nplay liked songs';
      instructionInput.value = app.instructions || '';
      instructionInput.addEventListener('input', () => {
        modeDrafts[modeIndex].apps[appIndex].instructions = instructionInput.value;
      });
      instructionLabel.appendChild(instructionText);
      instructionLabel.appendChild(instructionInput);

      const actions = document.createElement('div');
      actions.className = 'mode-inline-actions';
      const deleteAppBtn = document.createElement('button');
      deleteAppBtn.className = 'danger-btn';
      deleteAppBtn.type = 'button';
      deleteAppBtn.textContent = 'Delete App';
      deleteAppBtn.addEventListener('click', () => {
        modeDrafts[modeIndex].apps.splice(appIndex, 1);
        selectedModeApps.set(modeIndex, Math.max(0, appIndex - 1));
        renderModeEditor();
      });
      actions.appendChild(deleteAppBtn);

      appRow.appendChild(appNameLabel);
      appRow.appendChild(instructionLabel);
      appRow.appendChild(actions);
      appList.appendChild(appRow);
    });
    row.appendChild(appList);

    modeGridEl.appendChild(row);
  });
}

function collectModesPayload() {
  return modeDrafts
    .slice(0, MODE_LIMIT)
    .map((mode, modeIndex) => ({
      id: mode.id || `mode-${modeIndex + 1}`,
      name: String(mode.name || '').trim(),
      apps: (mode.apps || []).slice(0, MODE_APP_LIMIT)
        .map(app => ({
          name: String(app.name || '').trim(),
          instructions: splitInstructionDraft(app.instructions)
        }))
        .filter(app => app.name),
      commands: splitInstructionDraft(mode.commands)
    }))
    .filter(mode => mode.name || mode.apps.length > 0 || mode.commands.length > 0);
}

function collectSettingsPayload() {
  return {
    assistant: {
      displayName: document.getElementById(fieldIds.assistantDisplayName).value.trim(),
      honorific: document.getElementById(fieldIds.assistantHonorific).value
    },
    chat: {
      themeId: selectedThemeId,
      glassTint: Number(document.getElementById(fieldIds.glassTint).value || 42),
      maxHistory: clampChatHistoryLimit(document.getElementById(fieldIds.chatMaxHistory).value || DEFAULT_CHAT_HISTORY_LIMIT)
    },
    userProfile: {
      fullName: document.getElementById(fieldIds.profileFullName).value.trim(),
      firstName: document.getElementById(fieldIds.profileFirstName).value.trim(),
      middleName: document.getElementById(fieldIds.profileMiddleName).value.trim(),
      lastName: document.getElementById(fieldIds.profileLastName).value.trim(),
      email: document.getElementById(fieldIds.profileEmail).value.trim(),
      phone: document.getElementById(fieldIds.profilePhone).value.trim(),
      dateOfBirth: document.getElementById(fieldIds.profileDateOfBirth).value.trim(),
      gender: document.getElementById(fieldIds.profileGender).value.trim(),
      nationality: document.getElementById(fieldIds.profileNationality).value.trim(),
      username: document.getElementById(fieldIds.profileUsername).value.trim(),
      addressLine1: document.getElementById(fieldIds.profileAddressLine1).value.trim(),
      addressLine2: document.getElementById(fieldIds.profileAddressLine2).value.trim(),
      city: document.getElementById(fieldIds.profileCity).value.trim(),
      state: document.getElementById(fieldIds.profileState).value.trim(),
      postalCode: document.getElementById(fieldIds.profilePostalCode).value.trim(),
      country: document.getElementById(fieldIds.profileCountry).value.trim(),
      company: document.getElementById(fieldIds.profileCompany).value.trim(),
      jobTitle: document.getElementById(fieldIds.profileJobTitle).value.trim(),
      department: document.getElementById(fieldIds.profileDepartment).value.trim(),
      role: document.getElementById(fieldIds.profileRole).value.trim(),
      website: document.getElementById(fieldIds.profileWebsite).value.trim(),
      linkedin: document.getElementById(fieldIds.profileLinkedin).value.trim(),
      github: document.getElementById(fieldIds.profileGithub).value.trim(),
      twitter: document.getElementById(fieldIds.profileTwitter).value.trim()
    },
    system: {
      permissionLevel: document.getElementById(fieldIds.systemPermissionLevel)?.value || settingsSnapshot?.settings?.system?.permissionLevel || 'medium'
    },
    cloud: {
      enabled: latestCloudStatus?.connected === true || settingsSnapshot?.settings?.cloud?.enabled === true,
      relayUrl: document.getElementById(fieldIds.cloudRelayUrl).value.trim(),
      autoConnect: document.getElementById(fieldIds.cloudAutoConnect).checked,
      reconnectEnabled: document.getElementById(fieldIds.cloudReconnectEnabled).checked,
      heartbeatEnabled: document.getElementById(fieldIds.cloudHeartbeatEnabled).checked,
      connectionTimeoutMs: Number(document.getElementById(fieldIds.cloudConnectionTimeout).value || 10000),
      heartbeatIntervalMs: settingsSnapshot?.settings?.cloud?.heartbeatIntervalMs || 30000
    },
    modes: collectModesPayload()
  };
}

function updateBranding() {
  const assistantName = getAssistantDisplayName();
  document.getElementById('header-title').textContent = assistantName;
  document.getElementById('header-subtitle').textContent = 'Ready for local commands';
  document.title = `${assistantName} Chat`;
}

function updateSettingsSummary() {
  const assistantName = getAssistantDisplayName();
  const theme = (settingsSnapshot?.availableThemes || []).find(entry => entry.id === selectedThemeId)
    || (settingsSnapshot?.availableThemes || [])[0];
  document.getElementById('settings-hero-name').textContent = assistantName;
  document.getElementById('settings-hero-title').textContent = 'Configured for local automation, profile storage, and theme.';
  document.getElementById('settings-hero-honorific').textContent = settingsSnapshot?.settings?.assistant?.honorific || 'sir';
  document.getElementById('settings-hero-theme').textContent = theme?.label || 'Theme';
  document.getElementById('settings-hero-learning').textContent = settingsSnapshot?.settings?.activeLearning?.enabled === false ? 'Disabled' : 'Enabled';
}

function ensureWelcomeMessage() {
  if (hasRenderedWelcome) {
    return;
  }

  addMessage(
    `Ready when you are, ${getHonorific()}. Type a command here.`,
    'assistant',
    assistantMeta('ready')
  );
  hasRenderedWelcome = true;
}

async function ensureConversationReady() {
  if (conversationReady) {
    repaintConversationIfBlank();
    return conversationHistory.length;
  }
  if (conversationReadyPromise) return conversationReadyPromise;

  conversationReadyPromise = (async () => {
    const restored = await restoreConversationHistory();
    if (restored === 0) ensureWelcomeMessage();
    repaintConversationIfBlank();
    conversationReady = true;
    return conversationHistory.length;
  })().finally(() => {
    conversationReadyPromise = null;
  });

  return conversationReadyPromise;
}

function setSettingsStatus(message, tone = 'info') {
  const palette = {
    info: 'var(--muted-color)',
    success: 'var(--success-color)',
    error: 'var(--danger-color)'
  };
  settingsStatusEl.textContent = message || '';
  settingsStatusEl.style.color = palette[tone] || palette.info;
}

function applySnapshot(snapshot) {
  settingsSnapshot = snapshot;
  updateBranding();
  populateSettingsForm();
  updateSettingsSummary();
  enforceConversationHistoryLimit({ persist: conversationReady, rerender: conversationReady });
  renderSecurityStatus(snapshot?.securityStatus);
  if (snapshot?.cloudStatus) {
    renderCloudStatus(snapshot.cloudStatus);
  }
  if (snapshot?.cloudPairingStatus) {
    renderCloudPairingStatus(snapshot.cloudPairingStatus);
  }
}

function enforceConversationHistoryLimit(options = {}) {
  const limit = chatHistoryLimit();
  const nextHistory = conversationHistory.slice(-limit);
  const changed = nextHistory.length !== conversationHistory.length;
  conversationHistory = nextHistory;
  updateChatStorageStatus(conversationHistory.length);
  if (options.rerender === true && messagesEl && changed) {
    messagesEl.replaceChildren();
    renderedMessageCount = 0;
    conversationHistory.forEach(item => {
      addMessage(item.text, item.type, item.meta, { persist: false });
    });
    hasRenderedWelcome = conversationHistory.length > 0;
    scheduleMessagesScroll();
  }
  if (options.persist === true && changed) {
    saveConversationHistory({ immediate: true });
  }
}

function openSettingsPanel(sectionName = null) {
  const requestedSection = typeof sectionName === 'string' ? sectionName : null;
  if (requestedSection === 'phone' || requestedSection === 'mobile') {
    openMobileApp();
    return;
  }
  const targetSection = requestedSection || activeSettingsSection || 'system';
  setActiveSettingsSection(targetSection);
  settingsOverlay.classList.add('open');
  setSettingsStatus('Settings are stored locally on this machine.', 'info');
  refreshSettingsStatus();
  if (!settingsStatusPollHandle) {
    settingsStatusPollHandle = setInterval(refreshSettingsStatus, 5000);
  }
}

async function refreshSettingsStatus() {
  // Avoid accumulating IPC work when relay status is slow.
  if (settingsStatusPollInFlight) return;
  settingsStatusPollInFlight = true;
  try {
    const tasks = [];
    if (activeSettingsSection === 'system' && activeSystemBlock === 'security') {
      tasks.push(refreshSecurityStatus());
    }
    await Promise.all(tasks);
  } finally {
    settingsStatusPollInFlight = false;
  }
}

function stopSettingsStatusPolling() {
  if (settingsStatusPollHandle) {
    clearInterval(settingsStatusPollHandle);
    settingsStatusPollHandle = null;
  }
}

async function closeSettingsPanel() {
  await flushSettingsSave();
  if (document.body.classList.contains('settings-only')) {
    stopSettingsStatusPolling();
    window.close();
    return;
  }
  settingsOverlay.classList.remove('open');
  stopSettingsStatusPolling();
  stopCloudPairingCountdown();
  inputBox.focus();
}

function scheduleSettingsSave() {
  clearTimeout(settingsSaveTimer);
  settingsSaveTimer = setTimeout(() => {
    settingsSaveTimer = null;
    saveSettings();
  }, 400);
}

function flushSettingsSave() {
  if (settingsSaveTimer) {
    clearTimeout(settingsSaveTimer);
    settingsSaveTimer = null;
    return saveSettings();
  }
  return settingsSaveQueue;
}

function saveSettings() {
  if (!window.openx?.saveSettings) return settingsSaveQueue;
  const payload = collectSettingsPayload();
  settingsSaveQueue = settingsSaveQueue.then(async () => {
    setSettingsStatus('Saving changes automatically...', 'info');
    const snapshot = await window.openx.saveSettings(payload);
    settingsSnapshot = snapshot;
    updateBranding();
    updateSettingsSummary();
    enforceConversationHistoryLimit({ persist: conversationReady, rerender: conversationReady });
    setSettingsStatus('Changes saved automatically.', 'success');
  }).catch(() => setSettingsStatus('Unable to save settings.', 'error'));
  return settingsSaveQueue;
}

async function clearConversationHistory() {
  if (clearChatHistoryBtn) clearChatHistoryBtn.disabled = true;
  try {
    if (chatHistorySaveTimer) {
      clearTimeout(chatHistorySaveTimer);
      chatHistorySaveTimer = null;
    }
    pendingChatHistoryEntries = null;
    const clearAssistantHistory = window.openx?.clearAssistantChatHistory;
    if (clearAssistantHistory) {
      await clearAssistantHistory();
    }
    removeStoredValue(ASSISTANT_CHAT_HISTORY_STORAGE_KEY);
    conversationHistory = [];
    if (messagesEl) {
      messagesEl.replaceChildren();
      renderedMessageCount = 0;
    }
    hasRenderedWelcome = false;
    updateChatStorageStatus(0);
    setSettingsStatus('Chat history cleared.', 'success');
  } catch (_) {
    setSettingsStatus('Unable to clear chat history.', 'error');
  } finally {
    if (clearChatHistoryBtn) clearChatHistoryBtn.disabled = false;
  }
}

function formatPairingCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function stopCloudPairingCountdown() {
  if (cloudPairingCountdownHandle) clearInterval(cloudPairingCountdownHandle);
  cloudPairingCountdownHandle = null;
}

function setCloudGenerateQrLabel(label) {
  if (!cloudGenerateQrBtn) return;
  const labelEl = cloudGenerateQrBtn.querySelector('span');
  if (labelEl) labelEl.textContent = label;
  else cloudGenerateQrBtn.textContent = label;
}

function startCloudPairingCountdown(expiresAt) {
  stopCloudPairingCountdown();
  const update = () => {
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      stopCloudPairingCountdown();
      if (cloudPairingStatusEl) cloudPairingStatusEl.textContent = 'Cloud pairing QR expired.';
      if (cloudPairingCountdownEl) cloudPairingCountdownEl.textContent = 'Expired';
      if (cloudPairingQrEl) cloudPairingQrEl.classList.add('expired');
      setCloudGenerateQrLabel('Generate New QR');
      return;
    }
    if (cloudPairingCountdownEl) {
      cloudPairingCountdownEl.textContent = `Expires in ${formatPairingCountdown(remaining)}`;
    }
  };
  update();
  cloudPairingCountdownHandle = setInterval(update, 1000);
}

async function generateCloudPairingQR() {
  stopCloudPairingCountdown();
  if (!cloudGenerateQrBtn) return;
  cloudGenerateQrBtn.disabled = true;
  if (cloudPairingExpiryEl) cloudPairingExpiryEl.textContent = '';
  if (cloudPairingCountdownEl) cloudPairingCountdownEl.textContent = '';
  if (cloudPairingQrEl) {
    cloudPairingQrEl.hidden = true;
    cloudPairingQrEl.removeAttribute('src');
    cloudPairingQrEl.classList.remove('expired');
  }
  if (cloudPairingStatusEl) cloudPairingStatusEl.textContent = 'Waiting for OpenX security unlock...';
  try {
    const unlock = await requestSecurityPasswordForPairing();
    if (unlock.success !== true) {
      if (cloudPairingStatusEl) cloudPairingStatusEl.textContent = unlock.message || 'OpenX security password required.';
      return;
    }
    const result = await window.openx.generateCloudPairingQR(unlock.password);
    if (result?.success !== true) {
      if (cloudPairingStatusEl) cloudPairingStatusEl.textContent = result?.message || 'Connect to Relay Server first.';
      return;
    }
    if (cloudPairingQrEl) {
      cloudPairingQrEl.src = result.qrDataUrl;
      cloudPairingQrEl.hidden = false;
    }
    if (cloudPairingStatusEl) cloudPairingStatusEl.textContent = 'OpenX security unlocked. Scan this QR code with the mobile app.';
    if (cloudPairingExpiryEl) {
      cloudPairingExpiryEl.textContent = `Expires at ${new Date(result.payload.expiresAt).toLocaleTimeString()}.`;
    }
    setCloudGenerateQrLabel('Generate New QR');
    startCloudPairingCountdown(result.payload.expiresAt);
    await loadCloudPairingStatus();
  } catch (_) {
    if (cloudPairingStatusEl) cloudPairingStatusEl.textContent = 'Unable to generate cloud pairing QR.';
  } finally {
    cloudGenerateQrBtn.disabled = latestCloudStatus?.connected !== true;
  }
}

function formatCloudDate(value) {
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) && timestamp > 0
    ? new Date(timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '--';
}

function formatCloudDuration(milliseconds) {
  const totalSeconds = Math.floor(Math.max(0, Number(milliseconds) || 0) / 1000);
  if (totalSeconds <= 0) return '--';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function cloudStateClass(state) {
  return String(state || 'disconnected').toLowerCase();
}

function collectCloudRuntimeSettings() {
  return {
    relayUrl: cloudRelayUrlEl?.value?.trim() || settingsSnapshot?.settings?.cloud?.relayUrl || 'wss://openx-server.onrender.com/ws',
    autoConnect: cloudAutoConnectEl?.checked === true,
    reconnectEnabled: cloudReconnectEnabledEl?.checked !== false,
    heartbeatEnabled: cloudHeartbeatEnabledEl?.checked !== false,
    connectionTimeoutMs: Number(cloudConnectionTimeoutEl?.value || settingsSnapshot?.settings?.cloud?.connectionTimeoutMs || 10000),
    heartbeatIntervalMs: settingsSnapshot?.settings?.cloud?.heartbeatIntervalMs || 30000
  };
}

function isManagedPhoneDevice(device = {}) {
  if (device.isCurrentDevice === true) return false;
  const details = [
    device.deviceType,
    device.type,
    device.platform,
    device.deviceName,
    device.friendlyName
  ].map(value => String(value || '').toLowerCase());
  return details.some(value =>
    value.includes('mobile') ||
    value.includes('phone') ||
    value.includes('android') ||
    value.includes('ios')
  );
}

function isConfirmedMobileConnection(device = {}) {
  if (!isManagedPhoneDevice(device)) return false;
  const status = String(device.connectionStatus || device.state || '').toLowerCase();
  return device.connected === true || status === 'connected';
}

function primaryManagedMobileDevice() {
  const devices = (Array.isArray(latestManagedDevices) ? latestManagedDevices : []).filter(isManagedPhoneDevice);
  return devices.find(isConfirmedMobileConnection)
    || devices.find(device => device.trusted === true)
    || devices[0]
    || null;
}

function updateMobileAppPresentation() {
  const device = primaryManagedMobileDevice();
  const connected = isConfirmedMobileConnection(device);
  mobileAppPanelEl?.classList.toggle('mobile-connected', connected);
  if (mobileQrStageEl) mobileQrStageEl.hidden = connected;
  if (mobileConnectedSummaryEl) mobileConnectedSummaryEl.hidden = !connected;
  if (mobileConnectedDeviceNameEl) {
    mobileConnectedDeviceNameEl.textContent = device?.friendlyName || device?.deviceName || 'OpenX Mobile';
  }
  if (mobileConnectedDeviceMetaEl) {
    mobileConnectedDeviceMetaEl.textContent = connected
      ? 'Connected'
      : 'Scan a QR code from OpenX Mobile to pair this desktop.';
  }
}

function renderCloudStatus(status) {
  const safeStatus = status && typeof status === 'object' ? status : {};
  latestCloudStatus = safeStatus;
  const state = safeStatus.state || 'Disconnected';
  if (cloudConnectionStateEl) {
    cloudConnectionStateEl.textContent = state;
    cloudConnectionStateEl.className = cloudStateClass(state);
  }
  if (cloudLastConnectedEl) cloudLastConnectedEl.textContent = formatCloudDate(safeStatus.lastConnectedAt);
  if (cloudDurationEl) cloudDurationEl.textContent = formatCloudDuration(safeStatus.connectionDurationMs);
  if (cloudPingEl) cloudPingEl.textContent = Number.isFinite(Number(safeStatus.pingMs)) ? `${Math.round(Number(safeStatus.pingMs))} ms` : 'Pending';
  if (cloudReconnectAttemptsEl) cloudReconnectAttemptsEl.textContent = String(Number(safeStatus.reconnectAttempts) || 0);
  if (cloudFriendlyStatusEl) {
    cloudFriendlyStatusEl.textContent = safeStatus.friendlyMessage || 'Cloud mode is disconnected. Local mode is active.';
  }
  if (cloudConnectBtn) {
    const busy = ['Connecting', 'Reconnecting', 'Disconnecting'].includes(state);
    cloudConnectBtn.disabled = busy;
    cloudConnectBtn.textContent = safeStatus.connected ? 'Disconnect Server' : 'Connect Server';
  }
  if (cloudGenerateQrBtn) {
    cloudGenerateQrBtn.disabled = safeStatus.connected !== true;
  }
  if (safeStatus.connected !== true && cloudPairingStatusEl) {
    cloudPairingStatusEl.textContent = 'Connect to Relay Server first.';
  }
  if (activeWorkspaceView === 'mobile') {
    loadPhoneDevices();
  }
  updateMobileAppPresentation();
}

function toggleMobileServerDetails() {
  if (!mobileServerDetailsOverlay) return;
  const opening = mobileServerDetailsOverlay.hidden === true;
  mobileServerDetailsOverlay.hidden = !opening;
  mobileSettingsToggle?.setAttribute('aria-expanded', String(opening));
  if (opening) {
    loadCloudStatus();
    window.setTimeout(() => mobileServerDetailsCloseBtn?.focus?.(), 0);
  }
}

function closeMobileServerDetails(options = {}) {
  if (mobileServerDetailsOverlay) mobileServerDetailsOverlay.hidden = true;
  mobileSettingsToggle?.setAttribute('aria-expanded', 'false');
  if (options.restoreFocus !== false) {
    window.setTimeout(() => mobileSettingsToggle?.focus?.(), 0);
  }
}

async function loadCloudStatus() {
  if (!window.openx?.getCloudStatus) return;
  try {
    renderCloudStatus(await window.openx.getCloudStatus());
  } catch (_) {
    renderCloudStatus({
      state: 'Disconnected',
      connected: false,
      friendlyMessage: 'Cloud mode is disconnected. Local mode is active.'
    });
  }
}

function renderCloudPairingRequests(requests) {
  if (!cloudPairingRequestsEl) return;
  cloudPairingRequestsEl.replaceChildren();
  if (!Array.isArray(requests) || requests.length === 0) return;
  requests.forEach(request => {
    const card = document.createElement('div');
    card.className = 'cloud-pairing-request';
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = request.device?.name || 'OpenX Mobile';
    const meta = document.createElement('span');
    meta.textContent = `${request.device?.type || 'mobile'} wants to pair through the relay.`;
    copy.append(title, meta);

    const actions = document.createElement('div');
    actions.className = 'cloud-pairing-request-actions';
    const accept = document.createElement('button');
    accept.type = 'button';
    accept.className = 'primary-btn';
    accept.textContent = 'Accept';
    accept.addEventListener('click', async () => {
      accept.disabled = true;
      reject.disabled = true;
      try {
        await window.openx.approveCloudPairing(request.pairRequestId);
        setSettingsStatus('Cloud pairing approved.', 'success');
      } catch (_) {
        setSettingsStatus('Unable to approve cloud pairing.', 'error');
      }
    });
    const reject = document.createElement('button');
    reject.type = 'button';
    reject.className = 'secondary-btn';
    reject.textContent = 'Reject';
    reject.addEventListener('click', async () => {
      accept.disabled = true;
      reject.disabled = true;
      try {
        await window.openx.rejectCloudPairing(request.pairRequestId);
        setSettingsStatus('Cloud pairing rejected.', 'info');
      } catch (_) {
        setSettingsStatus('Unable to reject cloud pairing.', 'error');
      }
    });
    actions.append(accept, reject);
    card.append(copy, actions);
    cloudPairingRequestsEl.appendChild(card);
  });
}

function renderCloudPairingStatus(status) {
  const safeStatus = status && typeof status === 'object' ? status : {};
  const current = safeStatus.currentPairing;
  const pending = Array.isArray(safeStatus.pendingRequests) ? safeStatus.pendingRequests : [];
  if (cloudGenerateQrBtn) {
    cloudGenerateQrBtn.disabled = latestCloudStatus?.connected !== true;
  }
  if (current?.expiresAt && current.expiresAt > Date.now()) {
    if (cloudPairingStatusEl) cloudPairingStatusEl.textContent = pending.length > 0 ? 'Incoming pair request.' : 'Waiting for mobile scan...';
    if (cloudPairingExpiryEl) cloudPairingExpiryEl.textContent = `Expires at ${new Date(current.expiresAt).toLocaleTimeString()}.`;
    if (cloudPairingQrEl && current.qrDataUrl) {
      cloudPairingQrEl.src = current.qrDataUrl;
      cloudPairingQrEl.hidden = false;
      cloudPairingQrEl.classList.remove('expired');
    } else if (cloudPairingQrEl && !cloudPairingQrEl.src) {
      cloudPairingQrEl.hidden = true;
    }
    startCloudPairingCountdown(current.expiresAt);
  } else {
    stopCloudPairingCountdown();
    if (cloudPairingStatusEl) {
      cloudPairingStatusEl.textContent = latestCloudStatus?.connected === true
        ? 'Generate a cloud QR when your mobile app is ready.'
        : 'Connect to Relay Server first.';
    }
    if (cloudPairingCountdownEl) cloudPairingCountdownEl.textContent = '';
    setCloudGenerateQrLabel('Generate QR');
  }
  renderCloudPairingRequests(pending);
}

async function loadCloudPairingStatus() {
  if (!window.openx?.getCloudPairingStatus) return;
  try {
    renderCloudPairingStatus(await window.openx.getCloudPairingStatus());
  } catch (_) {
    renderCloudPairingStatus({
      connected: false,
      hasActiveQr: false,
      currentPairing: null,
      pendingRequests: []
    });
  }
}

function renderSecurityStatus(status = settingsSnapshot?.securityStatus || {}) {
  const configured = status?.configured === true;
  const locked = status?.locked === true;
  if (securityLockStatusEl) {
    securityLockStatusEl.textContent = locked
      ? 'Temporarily locked'
      : configured
        ? 'Configured'
        : 'Password required';
  }
  if (securityPasswordMessageEl && !securityPasswordMessageEl.dataset.busy) {
    securityPasswordMessageEl.textContent = configured
      ? 'Enter current password to change it.'
      : 'Create a password before pairing mobile devices.';
  }
  if (securityCurrentPasswordEl) {
    securityCurrentPasswordEl.disabled = !configured;
    securityCurrentPasswordEl.placeholder = configured ? '' : 'Not needed for first setup';
  }
}

async function refreshSecurityStatus() {
  if (!window.openx?.getSecurityStatus) return null;
  try {
    const status = await window.openx.getSecurityStatus();
    settingsSnapshot = { ...(settingsSnapshot || {}), securityStatus: status };
    renderSecurityStatus(status);
    return status;
  } catch (_) {
    if (securityPasswordMessageEl) securityPasswordMessageEl.textContent = 'Unable to load security status.';
    return null;
  }
}

function clearSecurityPasswordFields() {
  if (securityCurrentPasswordEl) securityCurrentPasswordEl.value = '';
  if (securityNewPasswordEl) securityNewPasswordEl.value = '';
  if (securityConfirmPasswordEl) securityConfirmPasswordEl.value = '';
}

async function saveSecurityPassword() {
  if (!window.openx?.setSecurityPassword || !securitySavePasswordBtn) return;
  const currentPassword = securityCurrentPasswordEl?.value || '';
  const newPassword = securityNewPasswordEl?.value || '';
  const confirmPassword = securityConfirmPasswordEl?.value || '';
  if (newPassword.length < 8) {
    if (securityPasswordMessageEl) securityPasswordMessageEl.textContent = 'Use at least 8 characters.';
    return;
  }
  if (newPassword !== confirmPassword) {
    if (securityPasswordMessageEl) securityPasswordMessageEl.textContent = 'New passwords do not match.';
    return;
  }
  securitySavePasswordBtn.disabled = true;
  if (securityPasswordMessageEl) {
    securityPasswordMessageEl.dataset.busy = 'true';
    securityPasswordMessageEl.textContent = 'Saving security password...';
  }
  try {
    const result = await window.openx.setSecurityPassword(currentPassword, newPassword);
    clearSecurityPasswordFields();
    if (result?.success === true) {
      settingsSnapshot = { ...(settingsSnapshot || {}), securityStatus: result.status };
      renderSecurityStatus(result.status);
      if (securityPasswordMessageEl) securityPasswordMessageEl.textContent = 'Security password updated.';
      setSettingsStatus('OpenX security password updated.', 'success');
      return;
    }
    if (securityPasswordMessageEl) securityPasswordMessageEl.textContent = result?.message || 'Unable to update security password.';
  } catch (_) {
    clearSecurityPasswordFields();
    if (securityPasswordMessageEl) securityPasswordMessageEl.textContent = 'Unable to update security password.';
  } finally {
    if (securityPasswordMessageEl) delete securityPasswordMessageEl.dataset.busy;
    securitySavePasswordBtn.disabled = false;
    refreshSecurityStatus();
  }
}

async function requestSecurityPasswordForPairing() {
  const status = await refreshSecurityStatus();
  if (status?.configured !== true) {
    setActiveSettingsSection('system');
    setActiveSystemBlock('security');
    return { success: false, message: 'Set an OpenX security password first.' };
  }
  const password = await openSecurityUnlockDialog();
  if (!password) {
    return { success: false, message: 'Enter your OpenX security password.' };
  }
  return { success: true, password };
}

async function toggleCloudConnection() {
  if (!window.openx || !cloudConnectBtn) return;
  cloudConnectBtn.disabled = true;
  try {
    const isConnected = latestCloudStatus?.connected === true;
    const status = isConnected
      ? await window.openx.disconnectCloud()
      : await window.openx.connectCloud(collectCloudRuntimeSettings());
    renderCloudStatus(status);
    const tone = status?.connected ? 'success' : 'info';
    setSettingsStatus(status?.friendlyMessage || 'Cloud connection updated.', tone);
  } catch (_) {
    setSettingsStatus('Unable to update cloud connection.', 'error');
  } finally {
    cloudConnectBtn.disabled = false;
  }
}

function getFilteredDevices(devices) {
  const query = String(deviceSearchEl?.value || '').trim().toLowerCase();
  const filter = deviceFilterEl?.value || 'all';
  const sort = deviceSortEl?.value || 'name';
  const matchesFilter = device => {
    const type = String(device.deviceType || '').toLowerCase();
    if (filter === 'connected') return device.connected === true || device.connectionStatus === 'connected';
    if (filter === 'offline') return device.connected !== true && device.connectionStatus !== 'connected';
    if (filter === 'trusted') return device.trusted === true;
    if (filter === 'untrusted') return device.trusted !== true;
    if (filter === 'phone') return !type || type.includes('phone') || type.includes('mobile');
    if (filter === 'desktop') return type.includes('desktop') || type.includes('laptop') || type.includes('pc');
    if (filter === 'tablet') return type.includes('tablet');
    return true;
  };
  const matchesQuery = device => {
    if (!query) return true;
    return [
      device.deviceName,
      device.friendlyName,
      device.deviceId,
      device.deviceType,
      device.platform,
      device.softwareVersion,
      device.connectionStatus,
      device.trustStatus
    ].some(value => String(value || '').toLowerCase().includes(query));
  };
  return devices
    .filter(device => matchesFilter(device) && matchesQuery(device))
    .sort((left, right) => {
      if (sort === 'name') return String(left.deviceName || '').localeCompare(String(right.deviceName || ''));
      if (sort === 'lastSeen') return Number(right.lastSeen || 0) - Number(left.lastSeen || 0);
      if (sort === 'pairedAt') return Number(right.pairedAt || 0) - Number(left.pairedAt || 0);
      const leftConnected = left.connected ? 0 : 1;
      const rightConnected = right.connected ? 0 : 1;
      if (leftConnected !== rightConnected) return leftConnected - rightConnected;
      const leftTrusted = left.trusted === true ? 0 : 1;
      const rightTrusted = right.trusted === true ? 0 : 1;
      if (leftTrusted !== rightTrusted) return leftTrusted - rightTrusted;
      return String(left.deviceName || '').localeCompare(String(right.deviceName || ''));
    });
}

function formatCompactDeviceDate(timestamp) {
  const value = Number(timestamp);
  if (!Number.isFinite(value) || value <= 0) return 'Unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unknown'
    : date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function getDeviceBoxCode(device) {
  return String(device.pairBoxCode || device.pairBoxes?.[0]?.boxCode || '').trim();
}

function createManagedPhoneDeviceCard(device) {
  const isConnected = device.connected === true || device.connectionStatus === 'connected';
  const boxCode = getDeviceBoxCode(device);
  const card = document.createElement('article');
  card.className = `phone-device-card${isConnected ? ' connected' : ''}${device.trusted !== true ? ' untrusted' : ''}`;
  card.dataset.deviceId = device.deviceId;

  const heading = document.createElement('div');
  heading.className = 'phone-device-card-heading';
  const identity = document.createElement('div');
  identity.className = 'phone-device-identity';
  const name = document.createElement('strong');
  name.textContent = device.friendlyName || device.deviceName || 'Unknown Device';
  identity.append(name);

  const headingRight = document.createElement('div');
  headingRight.className = 'phone-device-heading-right';
  if (boxCode) {
    const boxBadge = document.createElement('span');
    boxBadge.className = 'phone-device-box-code';
    boxBadge.textContent = boxCode;
    boxBadge.title = 'Pair box code';
    headingRight.appendChild(boxBadge);
  }
  const statusDot = document.createElement('span');
  statusDot.className = `phone-device-status-dot${isConnected ? ' connected' : ' offline'}`;
  statusDot.title = isConnected ? 'Connected' : 'Offline';
  headingRight.appendChild(statusDot);
  heading.append(identity, headingRight);

  const essentials = document.createElement('div');
  essentials.className = 'phone-device-essentials';
  [
    ['Status', isConnected ? 'Connected' : 'Offline'],
    ['Trust', device.trusted === true ? 'Trusted' : 'Untrusted'],
    ['Last seen', formatCompactDeviceDate(device.lastSeen)]
  ].forEach(([label, value]) => {
    const item = document.createElement('div');
    item.className = 'phone-device-essential';
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    const valueEl = document.createElement('strong');
    valueEl.textContent = value;
    item.append(labelEl, valueEl);
    essentials.appendChild(item);
  });

  const actions = document.createElement('div');
  actions.className = 'phone-device-actions';
  if (device.isCurrentDevice === true) {
    const current = document.createElement('span');
    current.className = 'phone-device-current';
    current.textContent = 'This device';
    actions.append(current);
  } else {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger-btn';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => openPhoneDeviceRemoveDialog(device));
    actions.append(remove);
  }

  card.append(heading, essentials, actions);
  return card;
}

function renderManagedPhoneDevices(devices) {
  latestManagedDevices = Array.isArray(devices) ? devices.slice() : [];
  phoneDeviceListEl.replaceChildren();
  updateMobileAppPresentation();
  const filteredDevices = getFilteredDevices(latestManagedDevices);
  if (latestManagedDevices.length === 0) {
    return;
  }
  if (filteredDevices.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'phone-device-empty';
    empty.textContent = 'No devices match this search or filter.';
    phoneDeviceListEl.appendChild(empty);
    return;
  }

  const groups = new Map();
  filteredDevices.forEach(device => {
    const boxCode = getDeviceBoxCode(device);
    const key = boxCode || `device:${device.deviceId}`;
    if (!groups.has(key)) groups.set(key, { boxCode, devices: [] });
    groups.get(key).devices.push(device);
  });

  for (const group of groups.values()) {
    if (!group.boxCode || group.devices.length === 1) {
      phoneDeviceListEl.appendChild(createManagedPhoneDeviceCard(group.devices[0]));
      continue;
    }
    const box = document.createElement('section');
    box.className = 'phone-device-box';
    box.dataset.boxCode = group.boxCode;
    const header = document.createElement('div');
    header.className = 'phone-device-box-header';
    const title = document.createElement('strong');
    title.textContent = 'Device Box';
    const code = document.createElement('span');
    code.textContent = group.boxCode;
    header.append(title, code);
    const list = document.createElement('div');
    list.className = 'phone-device-box-list';
    group.devices.forEach(device => list.appendChild(createManagedPhoneDeviceCard(device)));
    box.append(header, list);
    phoneDeviceListEl.appendChild(box);
  }
}

function renderPhoneDevices(devices) {
  renderManagedPhoneDevices(devices);
}

function openPhoneDeviceRemoveDialog(device) {
  if (!phoneDeviceRemoveDialog || !device?.deviceId) return;
  pendingPhoneDeviceRemoval = {
    deviceId: device.deviceId,
    deviceName: device.friendlyName || device.deviceName || 'this device'
  };
  if (phoneDeviceRemoveMessage) {
    phoneDeviceRemoveMessage.textContent = `Remove ${pendingPhoneDeviceRemoval.deviceName} from paired devices? It will lose OpenX access until paired again.`;
  }
  phoneDeviceRemoveDialog.hidden = false;
  phoneDeviceRemoveConfirm?.focus?.();
}

function closePhoneDeviceRemoveDialog() {
  pendingPhoneDeviceRemoval = null;
  if (phoneDeviceRemoveDialog) phoneDeviceRemoveDialog.hidden = true;
}

function openSecurityUnlockDialog() {
  if (!securityUnlockDialog || !securityUnlockPasswordEl) {
    return Promise.resolve('');
  }
  if (pendingSecurityUnlock) {
    pendingSecurityUnlock('');
    pendingSecurityUnlock = null;
  }
  securityUnlockPasswordEl.value = '';
  if (securityUnlockMessage) {
    securityUnlockMessage.textContent = 'Enter your OpenX security password to generate a mobile pairing QR.';
  }
  securityUnlockDialog.hidden = false;
  window.setTimeout(() => securityUnlockPasswordEl.focus?.(), 0);
  return new Promise(resolve => {
    pendingSecurityUnlock = resolve;
  });
}

function closeSecurityUnlockDialog(password = '') {
  if (securityUnlockDialog) securityUnlockDialog.hidden = true;
  if (securityUnlockPasswordEl) securityUnlockPasswordEl.value = '';
  const resolve = pendingSecurityUnlock;
  pendingSecurityUnlock = null;
  if (resolve) resolve(password);
}

function confirmSecurityUnlockDialog() {
  const password = securityUnlockPasswordEl?.value || '';
  if (!password) {
    if (securityUnlockMessage) securityUnlockMessage.textContent = 'Enter your OpenX security password.';
    securityUnlockPasswordEl?.focus?.();
    return;
  }
  closeSecurityUnlockDialog(password);
}

async function confirmPhoneDeviceRemoval() {
  if (!pendingPhoneDeviceRemoval?.deviceId || !window.openx?.removePhoneDevice) {
    closePhoneDeviceRemoveDialog();
    return;
  }
  const target = pendingPhoneDeviceRemoval;
  if (phoneDeviceRemoveConfirm) phoneDeviceRemoveConfirm.disabled = true;
  if (phoneDeviceRemoveCancel) phoneDeviceRemoveCancel.disabled = true;
  try {
    await window.openx.removePhoneDevice(target.deviceId);
    setSettingsStatus(`${target.deviceName} removed.`, 'success');
    closePhoneDeviceRemoveDialog();
    await loadPhoneDevices();
  } catch (_) {
    setSettingsStatus('Unable to remove trusted mobile device.', 'error');
  } finally {
    if (phoneDeviceRemoveConfirm) phoneDeviceRemoveConfirm.disabled = false;
    if (phoneDeviceRemoveCancel) phoneDeviceRemoveCancel.disabled = false;
  }
}

async function loadPhoneDevices() {
  if (!window.openx?.getPhoneDevices) return;
  try {
    renderPhoneDevices(await window.openx.getPhoneDevices());
  } catch (_) {
    renderPhoneDevices([]);
    setSettingsStatus('Unable to load trusted mobile devices.', 'error');
  }
}

inputBox.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    handleSend();
  }
});

document.getElementById(fieldIds.glassTint).addEventListener('input', event => scheduleGlassTintUpdate(event.target.value));
settingsOverlay.addEventListener('input', scheduleSettingsSave);
settingsOverlay.addEventListener('change', scheduleSettingsSave);
settingsOverlay.addEventListener('click', event => {
  if (event.target.closest('.theme-card, .permission-option, #mode-add-btn, .mode-row button')) {
    scheduleSettingsSave();
  }
});
profileEditBtn?.addEventListener('click', () => setProfileEditorOpen(!profileEditorOpen));
PROFILE_SUMMARY_FIELDS.forEach(field => {
  document.getElementById(field.fieldId)?.addEventListener('input', renderProfileSummary);
});
document.querySelectorAll('.permission-option').forEach(button => {
  button.addEventListener('click', () => {
    document.getElementById(fieldIds.systemPermissionLevel).value = button.dataset.permission;
    updatePermissionScale();
  });
});

sendBtn.addEventListener('click', handleSend);
chatViewBtn.addEventListener('click', () => setWorkspaceView('chat'));
activityViewBtn.addEventListener('click', () => setWorkspaceView('activity'));
appsViewBtn.addEventListener('click', () => setWorkspaceView('apps'));
remoteViewBtn?.addEventListener('click', () => setWorkspaceView('remote'));
calendarAppBtn?.addEventListener('click', () => {
  runHeaderApp(calendarAppBtn, () => window.openx?.openPlanner?.('calendar'));
});
remindersAppBtn?.addEventListener('click', () => {
  remindersAppBtn.classList.add('opening');
  openRemindersApp();
  window.setTimeout(() => remindersAppBtn.classList.remove('opening'), 180);
});
mobileAppBtn?.addEventListener('click', () => {
  mobileAppBtn.classList.add('opening');
  openMobileApp();
  window.setTimeout(() => mobileAppBtn.classList.remove('opening'), 180);
});
homeAutomationAppBtn?.addEventListener('click', () => {
  homeAutomationAppBtn.classList.add('opening');
  setWorkspaceView('home-automation');
  window.setTimeout(() => homeAutomationAppBtn.classList.remove('opening'), 180);
});
settingsAppBtn?.addEventListener('click', () => {
  openSettingsPanel('system');
});
document.getElementById('clear-notifications-btn').addEventListener('click', () => {
  notificationHistory = [];
  saveUiState();
  renderNotifications();
});
closeBtn.addEventListener('click', closeChatWindow);
settingsCloseBtn.addEventListener('click', closeSettingsPanel);
settingsNavButtons.forEach(button => {
  button.addEventListener('click', () => {
    const sectionName = button.dataset.sectionTarget;
    setActiveSettingsSection(sectionName);
    if (sectionName === 'system' && activeSystemBlock === 'security') {
      refreshSecurityStatus();
    } else if (sectionName === 'system' && activeSystemBlock === 'storage') {
      updateChatStorageStatus();
    }
  });
});
systemOptionButtons.forEach(button => {
  button.addEventListener('click', () => {
    const targetBlock = button.dataset.systemBlockTarget;
    setActiveSystemBlock(targetBlock);
    if (targetBlock === 'security') refreshSecurityStatus();
    if (targetBlock === 'storage') updateChatStorageStatus();
    const settingsContent = document.querySelector('.settings-content');
    if (settingsContent) settingsContent.scrollTop = 0;
  });
});
securityRefreshBtn?.addEventListener('click', refreshSecurityStatus);
securitySavePasswordBtn?.addEventListener('click', saveSecurityPassword);
clearChatHistoryBtn?.addEventListener('click', clearConversationHistory);
remindersAppCloseBtn?.addEventListener('click', closeRemindersApp);
remindersAppTabs.forEach(button => {
  button.addEventListener('click', () => {
    setRemindersAppTab(button.dataset.remindersTab);
    renderRemindersApp();
  });
});
remoteAppCloseBtn?.addEventListener('click', closeRemoteApp);
mobileAppCloseBtn?.addEventListener('click', closeMobileApp);
homeAutomationCloseBtn?.addEventListener('click', closeHomeAutomationApp);
homeDiscoveryRefreshBtn?.addEventListener('click', refreshHomeDiscovery);
homeDiscoveryConfigureBtn?.addEventListener('click', () => {
  startHomeOnboarding(homeDiscoveryConfigureBtn.dataset.deviceId);
});
homeDeviceListEl?.addEventListener('click', (event) => {
  const button = event.target?.closest?.('[data-home-configure]');
  if (button) {
    startHomeOnboarding(button.dataset.homeConfigure);
    return;
  }
  const scanButton = event.target?.closest?.('[data-home-scan]');
  if (scanButton) refreshHomeDiscovery();
});
homeConnectedListEl?.addEventListener('click', (event) => {
  const renameStart = event.target?.closest?.('[data-home-rename-start]');
  if (renameStart) {
    startHomeDeviceRename(renameStart.dataset.homeRenameStart);
    return;
  }
  const renameSave = event.target?.closest?.('[data-home-rename-save]');
  if (renameSave) {
    saveHomeDeviceRename(renameSave.dataset.homeRenameSave);
    return;
  }
  const renameCancel = event.target?.closest?.('[data-home-rename-cancel]');
  if (renameCancel) {
    cancelHomeDeviceRename();
    return;
  }
  const removeStart = event.target?.closest?.('[data-home-remove-start]');
  if (removeStart) {
    startHomeDeviceRemoval(removeStart.dataset.homeRemoveStart);
    return;
  }
  const removeConfirm = event.target?.closest?.('[data-home-remove-confirm]');
  if (removeConfirm) {
    confirmHomeDeviceRemoval(removeConfirm.dataset.homeRemoveConfirm);
    return;
  }
  const removeCancel = event.target?.closest?.('[data-home-remove-cancel]');
  if (removeCancel) {
    cancelHomeDeviceRemoval();
    return;
  }
  const reconnect = event.target?.closest?.('[data-home-reconnect]');
  if (reconnect) reconnectHomeDevice(reconnect.dataset.homeReconnect);
});
homeConnectedListEl?.addEventListener('keydown', (event) => {
  const input = event.target?.closest?.('[data-home-rename-input]');
  if (!input) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    saveHomeDeviceRename(input.dataset.homeRenameInput);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    cancelHomeDeviceRename();
  }
});
homeDeviceNextBtn?.addEventListener('click', () => setHomeWizardStep('wifi'));
homeOnboardingCancelBtn?.addEventListener('click', cancelHomeOnboarding);
homeWifiPasswordToggleBtn?.addEventListener('click', () => {
  if (!homeWifiPasswordEl) return;
  const showing = homeWifiPasswordEl.type === 'text';
  homeWifiPasswordEl.type = showing ? 'password' : 'text';
  homeWifiPasswordToggleBtn.textContent = showing ? 'Show' : 'Hide';
});
homeWifiBackBtn?.addEventListener('click', () => setHomeWizardStep('device'));
homeWifiNextBtn?.addEventListener('click', () => {
  if (!validateHomeWifiForm()) return;
  // The server address is already pre-filled with the correct default for
  // almost every setup, so skip the extra screen and send configuration
  // right away. Only fall back to the manual Server step if that default
  // is somehow missing or invalid.
  if (homeServerAddressEl && !homeServerAddressEl.value) {
    homeServerAddressEl.value = homeServerAddressFallback();
  }
  if (validateHomeServerForm()) {
    sendHomeConfiguration();
  } else {
    setHomeWizardStep('server');
  }
});
homeServerBackBtn?.addEventListener('click', () => setHomeWizardStep('wifi'));
homeSendConfigBtn?.addEventListener('click', sendHomeConfiguration);
homeApprovePairingBtn?.addEventListener('click', approveHomePairing);
homeRejectPairingBtn?.addEventListener('click', cancelHomeOnboarding);
homeConnectingRetryBtn?.addEventListener('click', retryHomeDeviceConnection);
homeConnectingCancelBtn?.addEventListener('click', cancelHomeOnboarding);
homeFinishBtn?.addEventListener('click', finishHomeOnboarding);
remoteRefreshBtn?.addEventListener('click', () => refreshRemoteTargets());
remoteTargetSelectEl?.addEventListener('change', () => {
  selectedRemoteTargetKey = remoteTargetSelectEl.value;
  renderRemoteControlButtons();
});
remoteControlButtons.forEach(button => {
  button.addEventListener('click', () => sendRemoteAction(button.dataset.remoteAction));
});
deviceSearchEl?.addEventListener('input', () => renderPhoneDevices(latestManagedDevices));
deviceFilterEl?.addEventListener('change', () => renderPhoneDevices(latestManagedDevices));
deviceSortEl?.addEventListener('change', () => renderPhoneDevices(latestManagedDevices));
deviceRefreshBtn?.addEventListener('click', () => loadPhoneDevices());
mobileSettingsToggle?.addEventListener('click', toggleMobileServerDetails);
mobileServerDetailsCloseBtn?.addEventListener('click', () => closeMobileServerDetails());
mobileServerDetailsOverlay?.addEventListener('click', (event) => {
  if (event.target === mobileServerDetailsOverlay) closeMobileServerDetails();
});
modeAddBtn.addEventListener('click', () => {
  if (modeDrafts.length >= MODE_LIMIT) {
    setSettingsStatus(`Mode limit reached. Remove one of the ${MODE_LIMIT} saved modes before adding another.`, 'error');
    return;
  }
  modeDrafts.push(createEmptyMode());
  selectedModeIndex = modeDrafts.length - 1;
  selectedModeApps.set(selectedModeIndex, 0);
  renderModeEditor();
  setActiveSettingsSection('modes');
});
settingsOverlay.addEventListener('click', (event) => {
  if (event.target === settingsOverlay) {
    closeSettingsPanel();
  }
});
phoneDeviceRemoveCancel?.addEventListener('click', closePhoneDeviceRemoveDialog);
phoneDeviceRemoveConfirm?.addEventListener('click', confirmPhoneDeviceRemoval);
securityUnlockCancel?.addEventListener('click', () => closeSecurityUnlockDialog(''));
securityUnlockConfirm?.addEventListener('click', confirmSecurityUnlockDialog);
securityUnlockPasswordEl?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    confirmSecurityUnlockDialog();
  }
});
cloudConnectBtn?.addEventListener('click', toggleCloudConnection);
cloudGenerateQrBtn?.addEventListener('click', generateCloudPairingQR);
phoneDeviceRemoveDialog?.addEventListener('click', (event) => {
  if (event.target === phoneDeviceRemoveDialog) closePhoneDeviceRemoveDialog();
});
securityUnlockDialog?.addEventListener('click', (event) => {
  if (event.target === securityUnlockDialog) closeSecurityUnlockDialog('');
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && securityUnlockDialog && !securityUnlockDialog.hidden) {
    closeSecurityUnlockDialog('');
    return;
  }
  if (event.key === 'Escape' && phoneDeviceRemoveDialog && !phoneDeviceRemoveDialog.hidden) {
    closePhoneDeviceRemoveDialog();
    return;
  }
});

function cleanupRendererResources() {
  stopSettingsStatusPolling();
  stopCloudPairingCountdown();
  if (remoteTargetsRenderFrame !== null) {
    cancelAnimationFrame(remoteTargetsRenderFrame);
    remoteTargetsRenderFrame = null;
  }
  if (homeAutoConnectionTimer) {
    clearTimeout(homeAutoConnectionTimer);
    homeAutoConnectionTimer = null;
  }
  if (messageScrollAnimationFrame !== null) {
    cancelAnimationFrame(messageScrollAnimationFrame);
    messageScrollAnimationFrame = null;
  }
  if (glassTintAnimationFrame !== null) {
    cancelAnimationFrame(glassTintAnimationFrame);
    glassTintAnimationFrame = null;
  }
  scheduleTimers.forEach(timer => clearTimeout(timer));
  scheduleTimers.clear();
  if (imagePreviewKeydownHandler) {
    document.removeEventListener('keydown', imagePreviewKeydownHandler);
    imagePreviewKeydownHandler = null;
  }
  if (conversationReady) {
    persistConversationHistoryFallback();
    flushConversationHistorySave();
  }
  flushSettingsSave();
  flushUiStateSave();
}

window.addEventListener('beforeunload', cleanupRendererResources);

if (window.openx) {
  window.openx.onSettingsChanged((snapshot) => {
    applySnapshot(snapshot);
  });
  window.openx.onCloudStatus?.(renderCloudStatus);
  window.openx.onCloudPairingStatus?.(renderCloudPairingStatus);
  window.openx.onScheduleChanged?.((payload) => {
    replaceScheduleItemsFromRuntime(payload?.snapshot?.entries || payload?.entries || []);
  });
  window.openx.onScheduleDue?.((schedule) => {
    const text = String(schedule?.notificationText || schedule?.message || schedule?.title || '').trim();
    if (text) addMessage(text, 'assistant', assistantMeta(String(schedule?.kind || 'reminder').toLowerCase()));
  });
  window.openx.onOpenSettings?.(openSettingsPanel);
  window.openx.onHomeOnboardingChanged?.(handleHomeOnboardingChanged);
  window.openx.onConversationAppend?.(({ entries, result }) => {
    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const type = ['user', 'assistant', 'system'].includes(entry?.type) ? entry.type : 'system';
      const text = String(entry?.text || '').trim();
      if (!text) return;
      addMessage(text, type, entry?.meta || (type === 'user' ? 'Voice - just now' : assistantMeta('voice')), {
        persist: false,
        choices: type === 'assistant' && result ? result.data?.choices : [],
        resultEntries: type === 'assistant' && result ? normalizeResultEntries(result) : []
      });
    });
  });
}

async function initialize() {
  setProfileEditorOpen(false);
  const conversationStart = ensureConversationReady();
  await loadUiState();
  const settingsOnly = new URLSearchParams(window.location.search).get('settings') === '1';
  if (settingsOnly) {
    document.body.classList.add('settings-only');
    document.title = 'Assistant Settings';
  }
  if (!window.openx) {
    settingsSnapshot = {
      settings: {
        assistant: { displayName: 'Jaanu', title: 'Desktop Assistant', honorific: 'sir' },
        chat: { activationShortcut: 'Control+Space', themeId: 'graphite', glassTint: 42, maxHistory: 300 },
        system: { permissionLevel: 'medium' },
        user: { profile: {} },
        modes: []
      },
      availableThemes: []
    };
    updateBranding();
    await conversationStart;
    renderActivity();
    setWorkspaceView('chat');
    if (settingsOnly) openSettingsPanel();
    return;
  }
  const snapshot = await window.openx.getSettings();
  applySnapshot(snapshot);
  await conversationStart;
  enforceConversationHistoryLimit({ persist: true, rerender: true });
  renderActivity();
  setWorkspaceView('chat');
  refreshActivitySchedulesFromRuntime();
  if (settingsOnly) {
    document.title = `${getAssistantDisplayName()} Settings`;
    openSettingsPanel();
  } else {
    inputBox.focus();
  }
}

initialize();
