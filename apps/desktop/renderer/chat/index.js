const messagesEl = document.getElementById('messages');
const inputBox = document.getElementById('input-box');
const sendBtn = document.getElementById('send-btn');
const closeBtn = document.getElementById('close-btn');
const aboutButtons = Array.from(document.querySelectorAll('[data-about-trigger]'));
const aboutOverlay = document.getElementById('about-overlay');
const aboutPanel = document.getElementById('about-panel');
const aboutCloseBtn = document.getElementById('about-close-btn');
const voiceStartBtn = document.getElementById('voice-start-btn');
const assistantMuteBtn = document.getElementById('assistant-mute-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const settingsNavEl = document.getElementById('settings-nav');
const settingsNavButtons = document.querySelectorAll('.settings-nav-chip');
const settingsSections = document.querySelectorAll('[data-settings-section]');
const settingsFooterSection = document.getElementById('settings-footer-section');
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
const cloudVersionEl = document.getElementById('cloud-version');
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
const peopleChatAppBtn = document.getElementById('people-chat-app-btn');
const calendarAppBtn = document.getElementById('calendar-app-btn');
const remindersAppBtn = document.getElementById('reminders-app-btn');
const galleryAppBtn = document.getElementById('gallery-app-btn');
const mobileAppBtn = document.getElementById('mobile-app-btn');
const homeAutomationAppBtn = document.getElementById('home-automation-app-btn');
const settingsAppBtn = document.getElementById('settings-app-btn');
const conversationView = document.getElementById('conversation-view');
const peopleChatView = document.getElementById('people-chat-view');
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
const peopleChatShellEl = document.querySelector('.people-chat-shell');
const peopleChatListEl = document.getElementById('people-chat-list');
const peopleChatThreadEl = document.getElementById('people-chat-thread');
const peopleChatTitleEl = document.getElementById('people-chat-thread-title');
const peopleChatStatusEl = document.getElementById('people-chat-thread-status');
const peopleChatAvatarEl = document.getElementById('people-chat-thread-avatar');
const peopleChatInputEl = document.getElementById('people-chat-input');
const peopleChatSearchEl = document.getElementById('people-chat-search');
const peopleChatComposerEl = document.getElementById('people-chat-composer');
const peopleChatNewBtn = document.getElementById('people-chat-new-btn');
const peopleChatCloseBtn = document.getElementById('people-chat-close-btn');
const peopleChatBackBtn = document.getElementById('people-chat-back-btn');
const peopleChatEditBtn = document.getElementById('people-chat-edit-btn');
const peopleChatDeleteBtn = document.getElementById('people-chat-delete-btn');
const peopleChatAddUserEl = document.getElementById('people-chat-add-user');
const peopleChatUserNameEl = document.getElementById('people-chat-user-name');
const peopleChatUserIdEl = document.getElementById('people-chat-user-id');
const peopleChatAddCancelBtn = document.getElementById('people-chat-add-cancel');
const peopleChatAddStatusEl = document.getElementById('people-chat-add-status');
const peopleChatEditUserEl = document.getElementById('people-chat-edit-user');
const peopleChatEditNameEl = document.getElementById('people-chat-edit-name');
const peopleChatEditIdEl = document.getElementById('people-chat-edit-id');
const peopleChatEditCancelBtn = document.getElementById('people-chat-edit-cancel');
const peopleChatEditStatusEl = document.getElementById('people-chat-edit-status');
const peopleChatDeleteConfirmEl = document.getElementById('people-chat-delete-confirm');
const peopleChatDeleteCancelBtn = document.getElementById('people-chat-delete-cancel');
const peopleChatDeleteConfirmBtn = document.getElementById('people-chat-delete-confirm-btn');
const peopleChatFilterButtons = document.querySelectorAll('.people-chat-filter[data-chat-filter]');
const peopleChatProfileBtn = document.getElementById('people-chat-profile-btn');
const peopleChatSettingsBtn = document.getElementById('people-chat-settings-btn');
const peopleChatRegistrationOverlayEl = document.getElementById('people-chat-registration-overlay');
const peopleChatRegistrationEl = document.getElementById('people-chat-registration');
const peopleChatRegistrationTitleEl = document.getElementById('people-chat-registration-title');
const peopleChatRegistrationDetailEl = document.getElementById('people-chat-registration-detail');
const peopleChatRegistrationCloseBtn = document.getElementById('people-chat-registration-close');
const peopleChatRegistrationStartEl = document.getElementById('people-chat-registration-start');
const peopleChatServerUrlEl = document.getElementById('people-chat-server-url');
const peopleChatUsernameEl = document.getElementById('people-chat-username');
const peopleChatPasswordEl = document.getElementById('people-chat-password');
const peopleChatPinEl = document.getElementById('people-chat-pin');
const peopleChatProfileEl = document.getElementById('people-chat-profile');
const peopleChatProfileUsernameEl = document.getElementById('people-chat-profile-username');
const peopleChatProfileDeviceEl = document.getElementById('people-chat-profile-device');
const peopleChatPasswordResetEl = document.getElementById('people-chat-password-reset');
const peopleChatCurrentPasswordEl = document.getElementById('people-chat-current-password');
const peopleChatNewPasswordEl = document.getElementById('people-chat-new-password');
const peopleChatConfirmPasswordEl = document.getElementById('people-chat-confirm-password');
const peopleChatRegistrationStatusEl = document.getElementById('people-chat-registration-status');
const peopleChatRequestsEl = document.getElementById('people-chat-requests');
const peopleChatRequestsSummaryEl = document.getElementById('people-chat-requests-summary');
const peopleChatRequestsRefreshBtn = document.getElementById('people-chat-requests-refresh');
const peopleChatIncomingRequestsEl = document.getElementById('people-chat-incoming-requests');
const peopleChatOutgoingRequestsEl = document.getElementById('people-chat-outgoing-requests');
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
const CHAT_HISTORY_LIMIT = 300;
const MAX_RENDERED_MESSAGES = CHAT_HISTORY_LIMIT;
const MAX_CHAT_VISUAL_RESULTS = 10;
const PEOPLE_CHAT_LIMIT = 30;
const PEOPLE_CHAT_HISTORY_LIMIT = 300;
const PEOPLE_CHAT_SEARCH_DEBOUNCE_MS = 220;
const REMOTE_TARGET_REFRESH_TTL_MS = 2500;
const HOME_CONNECTION_WAIT_DELAY_MS = 700;
const HOME_BLE_SERVICE_UUID = '6f18c610-7a95-4a5d-9f7a-5f1fd7f3a201';
const HOME_BLE_DEVICE_INFO_UUID = '6f18c611-7a95-4a5d-9f7a-5f1fd7f3a201';
const HOME_BLE_CONFIGURATION_UUID = '6f18c612-7a95-4a5d-9f7a-5f1fd7f3a201';
const HOME_BLE_STATUS_UUID = '6f18c613-7a95-4a5d-9f7a-5f1fd7f3a201';
const HOME_BLE_CONFIG_MAX_BYTES = 768;
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
const ASSISTANT_MUTED_STORAGE_KEY = 'openx-assistant-voice-muted-v1';
const STORAGE_SAVE_DEBOUNCE_MS = 180;

const PEOPLE_CHAT_FALLBACK_CONVERSATIONS = Object.freeze([
  {
    conversationId: 'local-demo-openx',
    title: 'OpenX Chat',
    status: 'Local chat ready',
    pinned: true,
    unreadCount: 0,
    lastMessageTimestamp: new Date().toISOString(),
    history: [
      {
        messageId: 'local-demo-message',
        direction: 'incoming',
        text: 'Start a local chat from this app.',
        timestamp: new Date().toISOString()
      }
    ]
  }
]);

let isProcessing = false;
let pendingConfirmation = null;
let settingsSnapshot = null;
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
let activeAboutTrigger = null;
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
let peopleChatConversations = [];
let activePeopleChatId = null;
let peopleChatFilter = 'all';
let peopleChatLoaded = false;
let peopleChatLoading = false;
let peopleChatPendingLoad = false;
let peopleChatSearchTimer = null;
let peopleChatRenderFrame = null;
let peopleChatThreadOpen = false;
let peopleChatAddUserOpen = false;
let peopleChatEditingUser = false;
let peopleChatConfirmingDelete = false;
let peopleChatRegistrationOpen = false;
let peopleChatRegistrationMode = 'settings';
let peopleChatRegistrationLoading = false;
let peopleChatRegistrationState = null;
let peopleChatRequestsLoading = false;
let peopleChatRequestsState = { incoming: [], outgoing: [], relationships: [] };
let scheduleItems = [];
let notificationHistory = [];
let conversationHistory = [];
let conversationReady = false;
let conversationReadyPromise = null;
let scheduleSyncFailureToastAt = 0;
let isAssistantMuted = false;
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
let imagePreviewOverlay = null;
let imagePreviewKeydownHandler = null;
let imagePreviewState = null;
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
  assistantTtsVolume: 'assistant-tts-volume',
  assistantTtsRate: 'assistant-tts-rate',
  profileFullName: 'profile-full-name',
  profileEmail: 'profile-email',
  profilePhone: 'profile-phone',
  profileAddressLine1: 'profile-address-line1',
  profileCity: 'profile-city',
  profileState: 'profile-state',
  profilePostalCode: 'profile-postal-code',
  profileCountry: 'profile-country',
  profileCompany: 'profile-company',
  profileRole: 'profile-role',
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
  { key: 'company', label: 'Company', fieldId: fieldIds.profileCompany },
  { key: 'role', label: 'Role', fieldId: fieldIds.profileRole },
  { key: 'country', label: 'Country', fieldId: fieldIds.profileCountry },
  { key: 'addressLine1', label: 'Address', fieldId: fieldIds.profileAddressLine1 },
  { key: 'city', label: 'City', fieldId: fieldIds.profileCity },
  { key: 'state', label: 'State', fieldId: fieldIds.profileState },
  { key: 'postalCode', label: 'Postal Code', fieldId: fieldIds.profilePostalCode }
];

function getAssistantDisplayName() {
  return settingsSnapshot?.settings?.assistant?.displayName || 'OpenX';
}

function getHonorific() {
  return settingsSnapshot?.settings?.assistant?.honorific || 'sir';
}

function setAboutText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value || '--';
}

function aboutCloudLabel() {
  if (!latestCloudStatus) return 'Not loaded';
  return latestCloudStatus.connected ? 'Connected' : 'Disconnected';
}

async function readAboutVersion() {
  if (!window.openx?.getConfig) return null;
  try {
    const config = await window.openx.getConfig();
    return config?.app?.version || null;
  } catch (_) {
    return null;
  }
}

async function refreshAboutPanel() {
  const assistantName = getAssistantDisplayName();
  const cloudSettings = settingsSnapshot?.settings?.cloud || {};
  setAboutText('about-assistant', assistantName);
  setAboutText('about-cloud', aboutCloudLabel());
  setAboutText('about-relay', latestCloudStatus?.relayUrl || cloudSettings.relayUrl || '--');
  setAboutText('about-platform', window.navigator?.platform || 'Desktop');
  setAboutText('about-version', 'Loading...');

  const version = await readAboutVersion();
  setAboutText('about-version', version || '--');
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

function chatHistoryLimit() {
  return CHAT_HISTORY_LIMIT;
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

function normalizeChatHistoryItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .map(normalizeChatHistoryItem)
    .filter(Boolean)
    .slice(-CHAT_HISTORY_LIMIT);
}

function mergeChatHistory(left = [], right = []) {
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
    .slice(-CHAT_HISTORY_LIMIT);
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
  return merged.slice(-CHAT_HISTORY_LIMIT);
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
    assistantMuted: state.assistantMuted === true,
    schedules,
    notifications
  };
}

function currentUiState() {
  return normalizeUiState({
    assistantMuted: isAssistantMuted,
    schedules: scheduleItems,
    notifications: notificationHistory
  });
}

function loadLegacyUiState() {
  const packed = loadStoredObject(UI_STATE_STORAGE_KEY);
  return normalizeUiState({
    assistantMuted: packed.assistantMuted === true || localStorage.getItem(ASSISTANT_MUTED_STORAGE_KEY) === 'true',
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
  [UI_STATE_STORAGE_KEY, SCHEDULE_STORAGE_KEY, NOTIFICATION_STORAGE_KEY, ASSISTANT_MUTED_STORAGE_KEY].forEach(key => {
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
    isAssistantMuted = legacy.assistantMuted;
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

  isAssistantMuted = stored.assistantMuted || legacy.assistantMuted;
  scheduleItems = stored.schedules.length > 0 ? stored.schedules : legacy.schedules;
  notificationHistory = stored.notifications.length > 0 ? stored.notifications : legacy.notifications;
  if (legacy.schedules.length > 0 || legacy.notifications.length > 0 || legacy.assistantMuted) {
    clearLegacyUiStateStorage();
    await saveUiState({ immediate: true });
  }
}

async function restoreConversationHistory() {
  if (!messagesEl) return 0;
  conversationHistory = (await loadConversationHistory()).slice(-chatHistoryLimit());
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
  conversationHistory.slice(-chatHistoryLimit()).forEach(item => {
    addMessage(item.text, item.type, item.meta, { persist: false });
  });
  hasRenderedWelcome = true;
}

function normalizeResultEntries(result) {
  const intent = String(result?.intent || '');
  const visualResults = Array.isArray(result?.data?.visualResults) ? result.data.visualResults : [];
  if (visualResults.length > 0) {
    return visualResults.slice(0, MAX_CHAT_VISUAL_RESULTS).map((entry, index) => ({
      index: index + 1,
      name: String(entry?.title || entry?.fileName || `Photo ${index + 1}`),
      type: 'photo',
      photoId: String(entry?.photoId || ''),
      path: String(entry?.path || ''),
      location: String(entry?.fileName || ''),
      createdAt: String(entry?.createdAt || ''),
      sizeMB: 0,
      matchScore: Number(entry?.confidence || 0) * 100
    })).filter(entry => entry.photoId);
  }
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

async function hydrateVisualResultCard(card, photoId) {
  if (!card || !photoId || card.dataset.loaded === 'true') return;
  try {
    const result = await window.openx?.getGalleryImageData?.(photoId);
    const src = result?.data?.src || '';
    if (!src) return;
    const image = card.querySelector('img');
    if (!image) return;
    image.src = src;
    image.addEventListener('load', () => {
      card.dataset.loaded = 'true';
    }, { once: true });
    if (image.complete) card.dataset.loaded = 'true';
  } catch {
    // Keep the metadata card visible if preview loading fails.
  }
}

function ensureImagePreviewOverlay() {
  if (imagePreviewOverlay) return imagePreviewOverlay;
  const overlay = document.createElement('div');
  overlay.id = 'chat-image-preview-overlay';
  overlay.hidden = true;
  const panel = document.createElement('section');
  panel.className = 'chat-image-preview-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'chat-image-preview-title');
  panel.tabIndex = -1;

  const closeButton = document.createElement('button');
  closeButton.className = 'chat-image-preview-close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close image preview');
  closeButton.textContent = 'x';

  const media = document.createElement('div');
  media.className = 'chat-image-preview-media';
  const image = document.createElement('img');
  image.alt = '';
  image.decoding = 'async';
  const empty = document.createElement('div');
  empty.className = 'chat-image-preview-empty';
  empty.textContent = 'Preview unavailable';
  media.append(image, empty);

  const copy = document.createElement('div');
  copy.className = 'chat-image-preview-copy';
  const title = document.createElement('strong');
  title.id = 'chat-image-preview-title';
  title.textContent = 'Photo Memory';
  const meta = document.createElement('span');
  meta.id = 'chat-image-preview-meta';
  copy.append(title, meta);

  const actions = document.createElement('div');
  actions.className = 'chat-image-preview-actions';
  const secondaryButton = document.createElement('button');
  secondaryButton.className = 'chat-image-preview-secondary';
  secondaryButton.type = 'button';
  secondaryButton.textContent = 'Close';
  const primaryButton = document.createElement('button');
  primaryButton.className = 'chat-image-preview-primary';
  primaryButton.type = 'button';
  primaryButton.textContent = 'Open in Gallery';
  actions.append(secondaryButton, primaryButton);

  panel.append(closeButton, media, copy, actions);
  overlay.appendChild(panel);
  const close = () => closeChatImagePreview();
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  closeButton.addEventListener('click', close);
  secondaryButton.addEventListener('click', close);
  primaryButton.addEventListener('click', () => {
    const photoId = imagePreviewState?.photoId;
    if (photoId) {
      window.openx?.showGalleryPhoto?.(photoId);
    }
  });
  imagePreviewKeydownHandler = (event) => {
    if (event.key === 'Escape' && !overlay.hidden) close();
  };
  document.addEventListener('keydown', imagePreviewKeydownHandler);
  document.body.appendChild(overlay);
  imagePreviewOverlay = overlay;
  return overlay;
}

function closeChatImagePreview() {
  if (!imagePreviewOverlay) return;
  imagePreviewOverlay.hidden = true;
  imagePreviewOverlay.classList.remove('visible');
  imagePreviewState = null;
}

async function openChatImagePreview(entry) {
  const photoId = String(entry?.photoId || '').trim();
  if (!photoId) return;
  const overlay = ensureImagePreviewOverlay();
  const panel = overlay.querySelector('.chat-image-preview-panel');
  const image = overlay.querySelector('.chat-image-preview-media img');
  const empty = overlay.querySelector('.chat-image-preview-empty');
  const title = overlay.querySelector('#chat-image-preview-title');
  const meta = overlay.querySelector('#chat-image-preview-meta');
  const primary = overlay.querySelector('.chat-image-preview-primary');
  imagePreviewState = { ...entry, photoId };
  title.textContent = entry?.name || 'Photo Memory';
  meta.textContent = [entry?.matchScore > 0 ? `${Math.round(entry.matchScore)}% match` : '', entry?.createdAt || '', entry?.location || entry?.path || '']
    .filter(Boolean)
    .join(' - ');
  image.removeAttribute('src');
  image.alt = entry?.name || 'Photo preview';
  image.hidden = true;
  empty.hidden = false;
  empty.textContent = 'Loading preview...';
  primary.disabled = false;
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add('visible'));
  panel?.focus?.();
  try {
    const result = await window.openx?.getGalleryImageData?.(photoId);
    const src = result?.data?.src || '';
    if (!src || imagePreviewState?.photoId !== photoId) {
      empty.textContent = 'Preview unavailable';
      return;
    }
    image.src = src;
    image.hidden = false;
    empty.hidden = true;
  } catch {
    empty.textContent = 'Preview unavailable';
  }
}

function addVisualResultCards(bubble, resultEntries) {
  const strip = document.createElement('div');
  strip.className = 'visual-result-strip';
  strip.setAttribute('aria-label', 'Visual memory search results');
  for (const entry of resultEntries) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'visual-result-card';
    card.dataset.photoId = entry.photoId;
    card.setAttribute('aria-label', `Open ${entry.name}`);

    const image = document.createElement('img');
    image.alt = entry.name;
    image.loading = 'lazy';
    image.decoding = 'async';

    const meta = document.createElement('span');
    meta.className = 'visual-result-meta';
    const title = document.createElement('strong');
    title.textContent = entry.name;
    const confidence = document.createElement('small');
    confidence.textContent = entry.matchScore > 0 ? `${Math.round(entry.matchScore)}% match` : 'Possible match';
    meta.append(title, confidence);
    card.append(image, meta);
    card.addEventListener('click', () => openChatImagePreview(entry));
    strip.appendChild(card);
    hydrateVisualResultCard(card, entry.photoId);
  }
  bubble.appendChild(strip);
}

function addResultCards(bubble, resultEntries) {
  if (!Array.isArray(resultEntries) || resultEntries.length === 0) return;
  const visualEntries = resultEntries.filter(entry => entry.type === 'photo');
  if (visualEntries.length > 0) {
    addVisualResultCards(bubble, visualEntries);
    return;
  }
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
  const hasVisualResultEntries = type === 'assistant' && resultEntries.some(entry => entry?.type === 'photo');
  if (hasVisualResultEntries) {
    bubble.classList.add('message-bubble--visual-results');
  }
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
  if (renderedMessageCount <= MAX_RENDERED_MESSAGES) return;
  const renderedMessages = messagesEl.querySelectorAll('.message');
  const overflow = renderedMessages.length - MAX_RENDERED_MESSAGES;
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

function peopleChatInitials(name) {
  const words = String(name || 'OpenX Chat').trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map(word => word[0]).join('').toUpperCase();
  return initials || 'OX';
}

function formatPeopleChatTime(value) {
  const timestamp = new Date(value || Date.now()).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
  return sameDay
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function normalizePeopleChatHistory(history = []) {
  return (Array.isArray(history) ? history : [])
    .map((entry, index) => {
      const text = String(entry?.text || entry?.searchText || entry?.preview || '').trim().slice(0, 1200);
      if (!text) return null;
      const status = String(entry?.status || entry?.deliveryStatus || '').trim().toLowerCase();
      return {
        messageId: String(entry?.messageId || `local-message-${index}`),
        text,
        direction: entry?.direction === 'outgoing' ? 'outgoing' : 'incoming',
        status: ['sending', 'sent', 'delivered', 'read', 'queued', 'failed'].includes(status) ? status : '',
        timestamp: entry?.timestamp || entry?.createdAt || new Date().toISOString()
      };
    })
    .filter(Boolean)
    .slice(-PEOPLE_CHAT_HISTORY_LIMIT);
}

function normalizePeopleChatConversation(entry = {}) {
  const metadata = entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {};
  const title = String(entry.title || metadata.title || metadata.name || 'New Chat').trim().slice(0, 80) || 'New Chat';
  const peerHandle = String(entry.peerHandle || metadata.peerHandle || metadata.openxId || '').trim().slice(0, 120);
  const history = normalizePeopleChatHistory(entry.history);
  const lastMessage = history.length > 0 ? history[history.length - 1] : null;
  const lastMessageTimestamp = entry.lastMessageTimestamp || lastMessage?.timestamp || entry.updatedAt || entry.createdAt || new Date().toISOString();
  const serverStatus = String(entry.serverStatus || metadata.serverStatus || 'local').trim().slice(0, 40) || 'local';
  const previewFallback = serverStatus === 'request-pending' ? 'Request sent' : 'No messages yet';
  return {
    conversationId: String(entry.conversationId || entry.id || '').trim(),
    relationshipId: String(entry.relationshipId || '').trim(),
    title,
    status: String(entry.status || metadata.status || peerHandle || 'Local messages').trim().slice(0, 120) || 'Local messages',
    peerHandle,
    peerType: String(entry.peerType || metadata.peerType || 'openx').trim().slice(0, 40) || 'openx',
    serverStatus,
    contactRequestId: String(entry.contactRequestId || metadata.contactRequestId || '').trim(),
    senderAccountId: String(entry.senderAccountId || metadata.senderAccountId || '').trim(),
    recipientAccountId: String(entry.recipientAccountId || metadata.recipientAccountId || metadata.peerAccountId || '').trim(),
    preview: String(entry.preview || entry.lastMessagePreview || lastMessage?.text || previewFallback).trim().slice(0, 140),
    unreadCount: Math.max(0, Number(entry.unreadCount || 0)),
    pinned: entry.pinned === true,
    muted: entry.muted === true,
    lastMessageTimestamp,
    history
  };
}

function mergePeopleChatHistory(existingHistory = [], incomingHistory = []) {
  const byId = new Map();
  [...normalizePeopleChatHistory(existingHistory), ...normalizePeopleChatHistory(incomingHistory)].forEach((message) => {
    const id = String(message.messageId || '').trim();
    if (!id) return;
    const previous = byId.get(id) || {};
    byId.set(id, { ...previous, ...message });
  });
  return Array.from(byId.values())
    .sort((left, right) => {
      const leftTime = Date.parse(left.timestamp || '');
      const rightTime = Date.parse(right.timestamp || '');
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return leftTime - rightTime;
      if (Number.isFinite(leftTime)) return -1;
      if (Number.isFinite(rightTime)) return 1;
      return 0;
    })
    .slice(-PEOPLE_CHAT_HISTORY_LIMIT);
}

function publishPeopleChatUiState() {
  if (!window.openx?.setDesktopChatUiState) return;
  window.openx.setDesktopChatUiState({
    visible: activeWorkspaceView === 'people-chat',
    activeConversationId: activePeopleChatId || '',
    threadOpen: peopleChatThreadOpen === true
  }).catch(() => {});
}

function normalizePeopleChatRegistration(entry = {}) {
  const source = entry?.state && typeof entry.state === 'object' ? entry.state : entry;
  const accountId = String(source?.accountId || source?.account?.accountId || '').trim();
  const deviceName = String(source?.device?.deviceName || '').trim();
  const username = String(source?.username || source?.account?.username || '').trim();
  const setupStatus = String(source?.setupStatus || '').trim() || (source?.registered ? 'registered' : 'not-registered');
  const runtimeState = String(source?.runtimeState || '').trim() || (setupStatus === 'chat-ready' ? 'CHAT_READY' : '');
  const registered = source?.registered === true || setupStatus === 'registered' || setupStatus === 'chat-ready';
  const chatReady = source?.chatReady === true || setupStatus === 'chat-ready' || runtimeState === 'CHAT_READY';
  const blockingReason = String(source?.blockingReason || '').trim();
  const message = String(source?.message || entry?.message || '').trim();
  return {
    success: source?.success !== false,
    registered,
    chatReady,
    pending: false,
    setupStatus,
    runtimeState,
    blockingReason,
    deviceApproved: source?.deviceApproved === true,
    deviceApprovalRequired: source?.deviceApprovalRequired === true || blockingReason === 'device_approval_required',
    identityReady: source?.identityReady === true || source?.crypto?.identityReady === true,
    sessionReady: source?.sessionReady === true || source?.crypto?.sessionReady === true,
    apiBaseUrl: String(source?.apiBaseUrl || 'https://openx-chat-server.onrender.com').trim(),
    username,
    accountId,
    account: source?.account && typeof source.account === 'object' ? source.account : null,
    device: source?.device && typeof source.device === 'object' ? source.device : null,
    deviceName,
    pinEnabled: source?.pinEnabled === true,
    message,
    cryptoErrorMessage: String(source?.crypto?.errorMessage || '').trim(),
    errorMessage: String(source?.error?.message || entry?.error?.message || '').trim()
  };
}

function setPeopleChatRegistrationStatus(message, tone = 'muted') {
  if (!peopleChatRegistrationStatusEl) return;
  peopleChatRegistrationStatusEl.textContent = String(message || '');
  peopleChatRegistrationStatusEl.dataset.tone = tone;
}

function validatePeopleChatPassword(value) {
  const password = String(value || '');
  if (!password) return 'Password is required.';
  if (password.length < 10 || password.length > 128) return 'Password must be 10 to 128 characters.';
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter.';
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter.';
  if (!/\d/.test(password)) return 'Password must include a number.';
  if (!/[^\w\s]/.test(password)) return 'Password must include a special character.';
  return '';
}

function normalizePeopleChatRequest(entry = {}) {
  const requestId = String(entry.requestId || '').trim();
  if (!requestId) return null;
  const status = String(entry.status || 'Pending').trim();
  const direction = String(entry.direction || 'incoming').toLowerCase() === 'outgoing' ? 'outgoing' : 'incoming';
  const peerHandle = String(entry.peerHandle || entry.peerAccountId || '').trim().slice(0, 120);
  const title = String(entry.title || peerHandle || 'OpenX user').trim().slice(0, 80) || 'OpenX user';
  return {
    requestId,
    direction,
    status,
    title,
    peerHandle,
    messagePreview: String(entry.messagePreview || '').trim().slice(0, 160),
    createdAt: entry.createdAt || entry.updatedAt || null
  };
}

function normalizePeopleChatRequestsState(value = {}) {
  return {
    incoming: (Array.isArray(value.incoming) ? value.incoming : []).map(normalizePeopleChatRequest).filter(Boolean),
    outgoing: (Array.isArray(value.outgoing) ? value.outgoing : []).map(normalizePeopleChatRequest).filter(Boolean),
    relationships: Array.isArray(value.relationships) ? value.relationships : []
  };
}

function renderPeopleChatRegistration() {
  if (!peopleChatRegistrationEl) return;
  const state = normalizePeopleChatRegistration(peopleChatRegistrationState || {});
  if (peopleChatRegistrationOverlayEl) peopleChatRegistrationOverlayEl.hidden = !peopleChatRegistrationOpen;
  peopleChatRegistrationEl.classList.toggle('registered', state.registered);
  peopleChatRegistrationEl.classList.toggle('pending', state.pending);
  peopleChatRegistrationEl.classList.toggle('open', peopleChatRegistrationOpen);
  peopleChatRegistrationEl.classList.toggle('loading', peopleChatRegistrationLoading);
  peopleChatRegistrationEl.querySelectorAll('.people-chat-registration-submit').forEach(button => {
    button.disabled = peopleChatRegistrationLoading;
  });
  const profileMode = peopleChatRegistrationMode === 'profile';
  peopleChatProfileBtn?.classList.toggle('active', peopleChatRegistrationOpen && profileMode);
  peopleChatProfileBtn?.setAttribute('aria-expanded', String(peopleChatRegistrationOpen && profileMode));
  if (peopleChatProfileBtn) peopleChatProfileBtn.disabled = peopleChatRegistrationLoading;
  peopleChatSettingsBtn?.classList.toggle('active', peopleChatRegistrationOpen && !profileMode);
  peopleChatSettingsBtn?.setAttribute('aria-expanded', String(peopleChatRegistrationOpen && !profileMode));
  if (peopleChatSettingsBtn) peopleChatSettingsBtn.disabled = peopleChatRegistrationLoading;
  if (peopleChatRegistrationTitleEl) {
    peopleChatRegistrationTitleEl.textContent = profileMode
      ? 'Chat profile'
      : state.chatReady
      ? 'Chat account ready'
      : (state.registered ? 'Finish chat setup' : 'Chat settings');
  }
  if (peopleChatRegistrationDetailEl) {
    if (profileMode) {
      peopleChatRegistrationDetailEl.textContent = state.chatReady
        ? 'Manage your OpenX Chat account.'
        : 'Register this desktop before editing profile.';
    } else if (state.chatReady) {
      const accountLabel = state.accountId ? `${state.accountId.slice(0, 10)}...${state.accountId.slice(-4)}` : 'registered account';
      peopleChatRegistrationDetailEl.textContent = state.deviceName
        ? `${accountLabel} on ${state.deviceName}`
        : `${accountLabel} is ready`;
    } else if (state.registered && state.deviceApprovalRequired) {
      peopleChatRegistrationDetailEl.textContent = state.deviceName
        ? `${state.deviceName} is waiting for approval.`
        : 'This desktop is waiting for approval.';
    } else if (state.registered) {
      peopleChatRegistrationDetailEl.textContent = 'Secure chat identity setup is not complete.';
    } else {
      peopleChatRegistrationDetailEl.textContent = 'Connect this desktop with your OpenX username and password.';
    }
  }
  if (peopleChatRegistrationStartEl) peopleChatRegistrationStartEl.hidden = !peopleChatRegistrationOpen || profileMode || state.registered;
  if (peopleChatProfileEl) peopleChatProfileEl.hidden = !peopleChatRegistrationOpen || !profileMode || !state.chatReady;
  if (peopleChatProfileUsernameEl) peopleChatProfileUsernameEl.textContent = state.username || 'Not connected';
  if (peopleChatProfileDeviceEl) peopleChatProfileDeviceEl.textContent = state.deviceName || 'Desktop';
  if (peopleChatServerUrlEl && !peopleChatServerUrlEl.value) peopleChatServerUrlEl.value = state.apiBaseUrl || 'https://openx-chat-server.onrender.com';
  if (peopleChatRegistrationLoading) {
    setPeopleChatRegistrationStatus('Working...', 'muted');
  } else if (profileMode && !state.chatReady) {
    setPeopleChatRegistrationStatus('Register this desktop before opening your chat profile.', 'warning');
  } else if (state.errorMessage) {
    setPeopleChatRegistrationStatus(state.errorMessage, 'error');
  } else if (state.message) {
    setPeopleChatRegistrationStatus(state.message, 'success');
  } else if (profileMode) {
    setPeopleChatRegistrationStatus('Password changes require your current password.', 'muted');
  } else if (state.chatReady) {
    setPeopleChatRegistrationStatus(state.pinEnabled ? 'PIN enabled for this account.' : 'Device registered. PIN can be added during setup.', 'success');
  } else if (state.deviceApprovalRequired) {
    setPeopleChatRegistrationStatus('Approve this desktop from an already trusted OpenX Chat device.', 'warning');
  } else if (state.registered && state.cryptoErrorMessage) {
    setPeopleChatRegistrationStatus(state.cryptoErrorMessage, 'error');
  } else if (state.registered) {
    setPeopleChatRegistrationStatus('Secure identity setup is pending. Keep this settings panel open and refresh.', 'warning');
  } else {
    setPeopleChatRegistrationStatus('', 'muted');
  }
  renderPeopleChatRequests();
}

function renderPeopleChatRequestGroup(container, requests = [], direction = 'incoming') {
  if (!container) return;
  container.replaceChildren();
  if (!requests.length) {
    const empty = document.createElement('div');
    empty.className = 'people-chat-request-empty';
    empty.textContent = direction === 'incoming' ? 'No incoming requests.' : 'No sent requests.';
    container.appendChild(empty);
    return;
  }
  requests.forEach(request => {
    const row = document.createElement('article');
    row.className = 'people-chat-request';

    const copy = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = request.title;
    const detail = document.createElement('small');
    detail.textContent = request.messagePreview || request.peerHandle || request.status;
    copy.append(title, detail);

    const actions = document.createElement('span');
    actions.className = 'people-chat-request-actions';
    if (direction === 'incoming') {
      const accept = document.createElement('button');
      accept.className = 'people-chat-mini-btn';
      accept.type = 'button';
      accept.textContent = 'Accept';
      accept.addEventListener('click', () => acceptPeopleChatRequest(request));
      const decline = document.createElement('button');
      decline.className = 'people-chat-mini-btn danger';
      decline.type = 'button';
      decline.textContent = 'Delete';
      decline.addEventListener('click', () => deletePeopleChatRequest(request));
      actions.append(accept, decline);
    } else {
      const status = document.createElement('b');
      status.textContent = request.status;
      actions.appendChild(status);
      if (request.status.toLowerCase() === 'pending') {
        const cancel = document.createElement('button');
        cancel.className = 'people-chat-mini-btn danger';
        cancel.type = 'button';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', () => cancelPeopleChatRequest(request));
        actions.appendChild(cancel);
      }
    }
    row.append(copy, actions);
    container.appendChild(row);
  });
}

function renderPeopleChatRequests() {
  if (!peopleChatRequestsEl) return;
  const state = normalizePeopleChatRegistration(peopleChatRegistrationState || {});
  peopleChatRequestsEl.hidden = !peopleChatRegistrationOpen || peopleChatRegistrationMode === 'profile' || !state.chatReady;
  if (peopleChatRequestsEl.hidden) return;
  const requestState = normalizePeopleChatRequestsState(peopleChatRequestsState);
  const pendingIncoming = requestState.incoming.filter(request => request.status.toLowerCase() === 'pending').length;
  const pendingOutgoing = requestState.outgoing.filter(request => request.status.toLowerCase() === 'pending').length;
  if (peopleChatRequestsSummaryEl) {
    peopleChatRequestsSummaryEl.textContent = peopleChatRequestsLoading
      ? 'Refreshing requests...'
      : `${pendingIncoming} incoming, ${pendingOutgoing} sent`;
  }
  if (peopleChatRequestsRefreshBtn) peopleChatRequestsRefreshBtn.disabled = peopleChatRequestsLoading;
  renderPeopleChatRequestGroup(peopleChatIncomingRequestsEl, requestState.incoming, 'incoming');
  renderPeopleChatRequestGroup(peopleChatOutgoingRequestsEl, requestState.outgoing, 'outgoing');
}

function focusPeopleChatRegistration() {
  requestAnimationFrame(() => {
    const state = normalizePeopleChatRegistration(peopleChatRegistrationState || {});
    if (peopleChatRegistrationMode === 'profile' && state.chatReady) peopleChatCurrentPasswordEl?.focus();
    else if (!state.registered) peopleChatUsernameEl?.focus();
    else peopleChatRegistrationCloseBtn?.focus();
  });
}

async function loadPeopleChatRegistration(options = {}) {
  if (!window.openx?.getDesktopChatRegistration) {
    peopleChatRegistrationState = normalizePeopleChatRegistration({});
    renderPeopleChatRegistration();
    return;
  }
  if (peopleChatRegistrationLoading && options.force !== true) return;
  try {
    const state = await window.openx.getDesktopChatRegistration();
    peopleChatRegistrationState = normalizePeopleChatRegistration(state);
  } catch (error) {
    peopleChatRegistrationState = normalizePeopleChatRegistration({
      success: false,
      error: { message: error?.message || 'Chat settings state is unavailable.' }
    });
  } finally {
    renderPeopleChatRegistration();
  }
}

async function loadPeopleChatRequests(options = {}) {
  const state = normalizePeopleChatRegistration(peopleChatRegistrationState || {});
  if (!state.chatReady || !window.openx?.listDesktopChatContacts) {
    peopleChatRequestsState = { incoming: [], outgoing: [], relationships: [] };
    renderPeopleChatRequests();
    return;
  }
  if (peopleChatRequestsLoading && options.force !== true) return;
  peopleChatRequestsLoading = true;
  renderPeopleChatRequests();
  try {
    const result = await window.openx.listDesktopChatContacts();
    peopleChatRequestsState = normalizePeopleChatRequestsState(result || {});
    if (Array.isArray(result?.relationships) && result.relationships.length > 0) {
      peopleChatLoaded = false;
      loadPeopleChatConversations({ force: true });
    }
  } catch (error) {
    showToast('Chat requests could not load', error?.message || 'OpenX Chat server is unavailable.', 'error');
  } finally {
    peopleChatRequestsLoading = false;
    renderPeopleChatRequests();
  }
}

async function acceptPeopleChatRequest(request) {
  if (!request?.requestId || !window.openx?.acceptDesktopChatContactRequest) return;
  peopleChatRequestsLoading = true;
  renderPeopleChatRequests();
  try {
    const result = await window.openx.acceptDesktopChatContactRequest({
      requestId: request.requestId,
      peerName: request.title,
      peerHandle: request.peerHandle
    });
    if (result?.conversation) replacePeopleChatConversation(result.conversation);
    showToast('Request accepted', `${request.title} can message you now.`, 'success');
    await loadPeopleChatRequests({ force: true });
    peopleChatLoaded = false;
    await loadPeopleChatConversations({ force: true });
  } catch (error) {
    showToast('Request could not be accepted', error?.message || 'Try again later.', 'error');
  } finally {
    peopleChatRequestsLoading = false;
    renderPeopleChat();
  }
}

async function deletePeopleChatRequest(request) {
  if (!request?.requestId || !window.openx?.deleteDesktopChatContactRequest) return;
  peopleChatRequestsLoading = true;
  renderPeopleChatRequests();
  try {
    await window.openx.deleteDesktopChatContactRequest({ requestId: request.requestId, reason: 'dismissed' });
    showToast('Request deleted', `${request.title} was removed from requests.`, 'success');
    await loadPeopleChatRequests({ force: true });
  } catch (error) {
    showToast('Request could not be deleted', error?.message || 'Try again later.', 'error');
  } finally {
    peopleChatRequestsLoading = false;
    renderPeopleChatRequests();
  }
}

async function cancelPeopleChatRequest(request) {
  if (!request?.requestId || !window.openx?.cancelDesktopChatContactRequest) return;
  peopleChatRequestsLoading = true;
  renderPeopleChatRequests();
  try {
    await window.openx.cancelDesktopChatContactRequest({ requestId: request.requestId, reason: 'cancelled' });
    showToast('Request cancelled', `${request.title} will not receive this request.`, 'success');
    await loadPeopleChatRequests({ force: true });
  } catch (error) {
    showToast('Request could not be cancelled', error?.message || 'Try again later.', 'error');
  } finally {
    peopleChatRequestsLoading = false;
    renderPeopleChatRequests();
  }
}

function openPeopleChatRegistration(mode = 'settings') {
  peopleChatRegistrationMode = mode === 'profile' ? 'profile' : 'settings';
  peopleChatRegistrationOpen = true;
  renderPeopleChatRegistration();
  if (peopleChatRegistrationMode !== 'profile') loadPeopleChatRequests();
  focusPeopleChatRegistration();
}

function closePeopleChatRegistration() {
  const trigger = peopleChatRegistrationMode === 'profile' ? peopleChatProfileBtn : peopleChatSettingsBtn;
  peopleChatRegistrationOpen = false;
  renderPeopleChatRegistration();
  requestAnimationFrame(() => trigger?.focus());
}

function togglePeopleChatRegistration() {
  if (peopleChatRegistrationOpen && peopleChatRegistrationMode === 'settings') closePeopleChatRegistration();
  else openPeopleChatRegistration('settings');
}

function togglePeopleChatProfile() {
  if (peopleChatRegistrationOpen && peopleChatRegistrationMode === 'profile') closePeopleChatRegistration();
  else openPeopleChatRegistration('profile');
}

async function startPeopleChatRegistration(event) {
  event?.preventDefault?.();
  const rawUsername = String(peopleChatUsernameEl?.value || '').trim();
  const username = rawUsername.startsWith('@') ? rawUsername.slice(1).trim() : rawUsername;
  const password = String(peopleChatPasswordEl?.value || '');
  const pin = String(peopleChatPinEl?.value || '').trim();
  const apiBaseUrl = String(peopleChatServerUrlEl?.value || '').trim();
  if (!username) {
    setPeopleChatRegistrationStatus('Username is required.', 'error');
    peopleChatUsernameEl?.focus();
    return;
  }
  if (username.includes('@')) {
    setPeopleChatRegistrationStatus('Use your OpenX username here, not an email address.', 'error');
    peopleChatUsernameEl?.focus();
    return;
  }
  if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) {
    setPeopleChatRegistrationStatus('Username must be 3-32 letters, numbers, dots, hyphens, or underscores.', 'error');
    peopleChatUsernameEl?.focus();
    return;
  }
  if (peopleChatUsernameEl) peopleChatUsernameEl.value = username;
  const passwordProblem = validatePeopleChatPassword(password);
  if (passwordProblem) {
    setPeopleChatRegistrationStatus(passwordProblem, 'error');
    peopleChatPasswordEl?.focus();
    return;
  }
  peopleChatRegistrationLoading = true;
  renderPeopleChatRegistration();
  try {
    const result = await window.openx?.startDesktopChatRegistration?.({ username, password, pin, apiBaseUrl });
    peopleChatRegistrationState = normalizePeopleChatRegistration(result);
    peopleChatRegistrationOpen = true;
    if (result?.success === false) {
      setPeopleChatRegistrationStatus(result?.error?.message || 'Registration could not start.', 'error');
    } else if (peopleChatRegistrationState.chatReady) {
      peopleChatRegistrationOpen = false;
      if (peopleChatUsernameEl) peopleChatUsernameEl.value = '';
      if (peopleChatPasswordEl) peopleChatPasswordEl.value = '';
      if (peopleChatPinEl) peopleChatPinEl.value = '';
      setPeopleChatRegistrationStatus(result?.message || 'Chat account ready.', 'success');
      showToast('Chat account ready', 'This desktop is registered for OpenX Chat.', 'success');
      await loadPeopleChatRequests({ force: true });
    } else if (peopleChatRegistrationState.registered) {
      setPeopleChatRegistrationStatus(
        result?.message || 'This desktop is registered, but it still needs approval before messaging.',
        peopleChatRegistrationState.deviceApprovalRequired ? 'warning' : 'success'
      );
    } else {
      setPeopleChatRegistrationStatus(
        result?.message || 'Chat account setup completed.',
        'success'
      );
    }
  } catch (error) {
    peopleChatRegistrationState = normalizePeopleChatRegistration({
      success: false,
      error: { message: error?.message || 'Registration could not start.' }
    });
  } finally {
    peopleChatRegistrationLoading = false;
    renderPeopleChatRegistration();
    requestAnimationFrame(() => {
      const state = normalizePeopleChatRegistration(peopleChatRegistrationState || {});
      if (!state.registered) peopleChatUsernameEl?.focus();
      else peopleChatRegistrationCloseBtn?.focus();
    });
  }
}

async function resetPeopleChatPassword(event) {
  event?.preventDefault?.();
  const state = normalizePeopleChatRegistration(peopleChatRegistrationState || {});
  if (!state.chatReady) {
    setPeopleChatRegistrationStatus('Register this desktop before changing your chat password.', 'warning');
    return;
  }
  const currentPassword = String(peopleChatCurrentPasswordEl?.value || '');
  const newPassword = String(peopleChatNewPasswordEl?.value || '');
  const confirmPassword = String(peopleChatConfirmPasswordEl?.value || '');
  if (!currentPassword) {
    setPeopleChatRegistrationStatus('Current password is required.', 'error');
    peopleChatCurrentPasswordEl?.focus();
    return;
  }
  const passwordProblem = validatePeopleChatPassword(newPassword);
  if (passwordProblem) {
    setPeopleChatRegistrationStatus(passwordProblem, 'error');
    peopleChatNewPasswordEl?.focus();
    return;
  }
  if (newPassword !== confirmPassword) {
    setPeopleChatRegistrationStatus('New passwords do not match.', 'error');
    peopleChatConfirmPasswordEl?.focus();
    return;
  }
  peopleChatRegistrationLoading = true;
  renderPeopleChatRegistration();
  try {
    const result = await window.openx?.updateDesktopChatPassword?.({ currentPassword, newPassword });
    peopleChatRegistrationState = normalizePeopleChatRegistration({
      ...(result?.state || state),
      message: result?.message || 'Chat password updated.'
    });
    if (peopleChatCurrentPasswordEl) peopleChatCurrentPasswordEl.value = '';
    if (peopleChatNewPasswordEl) peopleChatNewPasswordEl.value = '';
    if (peopleChatConfirmPasswordEl) peopleChatConfirmPasswordEl.value = '';
    setPeopleChatRegistrationStatus(result?.message || 'Chat password updated.', 'success');
    showToast('Chat profile updated', 'Your OpenX Chat password was reset.', 'success');
  } catch (error) {
    peopleChatRegistrationState = normalizePeopleChatRegistration({
      ...state,
      error: { message: error?.message || 'Chat password could not be updated.' }
    });
    setPeopleChatRegistrationStatus(error?.message || 'Chat password could not be updated.', 'error');
  } finally {
    peopleChatRegistrationLoading = false;
    renderPeopleChatRegistration();
  }
}

function handlePeopleChatRegistrationChanged(payload = {}) {
  peopleChatRegistrationState = normalizePeopleChatRegistration(payload);
  renderPeopleChatRegistration();
  if (peopleChatRegistrationState.chatReady) loadPeopleChatRequests({ force: true });
}

function replacePeopleChatConversation(conversation, options = {}) {
  const normalized = normalizePeopleChatConversation(conversation);
  if (!normalized.conversationId) return null;
  const index = peopleChatConversations.findIndex(item => item.conversationId === normalized.conversationId);
  if (index >= 0 && options.preserveExistingHistory === true) {
    const existing = peopleChatConversations[index];
    const mergedHistory = mergePeopleChatHistory(existing.history, normalized.history);
    if (mergedHistory.length > normalized.history.length) {
      normalized.history = mergedHistory;
      const lastMessage = mergedHistory[mergedHistory.length - 1] || null;
      normalized.preview = normalized.preview && normalized.preview !== 'No messages yet'
        ? normalized.preview
        : (lastMessage?.text || existing.preview || normalized.preview);
      normalized.lastMessageTimestamp = normalized.lastMessageTimestamp || lastMessage?.timestamp || existing.lastMessageTimestamp;
    }
  }
  if (index >= 0) {
    peopleChatConversations[index] = normalized;
  } else {
    peopleChatConversations.unshift(normalized);
  }
  peopleChatConversations.sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    return Date.parse(right.lastMessageTimestamp || 0) - Date.parse(left.lastMessageTimestamp || 0);
  });
  return normalized;
}

function getActivePeopleChatConversation() {
  return peopleChatConversations.find(item => item.conversationId === activePeopleChatId) || null;
}

function removePeopleChatConversation(conversationId) {
  const id = String(conversationId || '').trim();
  peopleChatConversations = peopleChatConversations.filter(item => item.conversationId !== id);
  if (activePeopleChatId === id) {
    activePeopleChatId = null;
    peopleChatThreadOpen = false;
    peopleChatEditingUser = false;
    peopleChatConfirmingDelete = false;
  }
}

function visiblePeopleChatConversations() {
  const query = currentPeopleChatSearchQuery();
  return peopleChatConversations.filter(conversation => {
    if (peopleChatFilter === 'unread' && conversation.unreadCount <= 0) return false;
    if (peopleChatFilter === 'pinned' && !conversation.pinned) return false;
    if (!query) return true;
    return [
      conversation.title,
      conversation.status,
      conversation.peerHandle,
      conversation.preview
    ].join(' ').toLowerCase().includes(query);
  });
}

function currentPeopleChatSearchQuery() {
  return String(peopleChatSearchEl?.value || '').trim().toLowerCase();
}

function renderPeopleChatList() {
  if (!peopleChatListEl) return;
  peopleChatListEl.replaceChildren();
  if (peopleChatLoading) {
    const loading = document.createElement('div');
    loading.className = 'people-chat-empty';
    loading.textContent = 'Loading chats...';
    peopleChatListEl.appendChild(loading);
    return;
  }

  const conversations = visiblePeopleChatConversations();
  if (conversations.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'people-chat-empty';
    empty.textContent = peopleChatConversations.length === 0 ? 'No chats yet.' : 'No chats match this view.';
    peopleChatListEl.appendChild(empty);
    return;
  }

  conversations.forEach(conversation => {
    const row = document.createElement('button');
    row.className = 'people-chat-row';
    row.type = 'button';
    row.dataset.conversationId = conversation.conversationId;
    row.setAttribute('role', 'listitem');
    row.classList.toggle('active', conversation.conversationId === activePeopleChatId);

    const avatar = document.createElement('span');
    avatar.className = 'people-chat-avatar';
    avatar.textContent = peopleChatInitials(conversation.title);

    const copy = document.createElement('span');
    copy.className = 'people-chat-row-copy';
    const title = document.createElement('strong');
    title.textContent = conversation.title;
    const preview = document.createElement('small');
    preview.textContent = conversation.preview || 'No messages yet';
    copy.append(title, preview);

    const meta = document.createElement('span');
    meta.className = 'people-chat-row-meta';
    const time = document.createElement('span');
    time.textContent = formatPeopleChatTime(conversation.lastMessageTimestamp);
    meta.appendChild(time);
    if (conversation.unreadCount > 0) {
      const badge = document.createElement('b');
      badge.textContent = String(Math.min(conversation.unreadCount, 99));
      meta.appendChild(badge);
    }

    row.append(avatar, copy, meta);
    row.addEventListener('click', () => selectPeopleChatConversation(conversation.conversationId));
    peopleChatListEl.appendChild(row);
  });
}

function formatPeopleChatMessageStatus(message = {}) {
  if (message.direction !== 'outgoing') return '';
  const status = String(message.status || '').toLowerCase();
  if (status === 'sending') return 'Sending';
  if (status === 'queued') return 'Queued';
  if (status === 'delivered') return 'Delivered';
  if (status === 'read') return 'Read';
  if (status === 'failed') return 'Failed';
  return 'Sent';
}

function renderPeopleChatThread() {
  if (!peopleChatThreadEl) return;
  const active = getActivePeopleChatConversation();
  peopleChatThreadEl.replaceChildren();
  if (peopleChatTitleEl) peopleChatTitleEl.textContent = active?.title || 'OpenX Chat';
  if (peopleChatStatusEl) peopleChatStatusEl.textContent = active?.status || 'Local messages';
  if (peopleChatAvatarEl) peopleChatAvatarEl.textContent = peopleChatInitials(active?.title || 'OpenX Chat');
  if (peopleChatEditBtn) peopleChatEditBtn.disabled = !active;
  if (peopleChatDeleteBtn) peopleChatDeleteBtn.disabled = !active;
  if (!active) {
    const empty = document.createElement('div');
    empty.className = 'people-chat-thread-empty';
    empty.textContent = 'Select a chat or start a new one.';
    peopleChatThreadEl.appendChild(empty);
    return;
  }

  if (active.history.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'people-chat-thread-empty';
    empty.textContent = 'No messages in this chat yet.';
    peopleChatThreadEl.appendChild(empty);
    return;
  }

  active.history.forEach(message => {
    const item = document.createElement('div');
    item.className = `people-chat-message ${message.direction === 'outgoing' ? 'outgoing' : 'incoming'}`;
    const bubble = document.createElement('span');
    bubble.className = 'people-chat-bubble';
    bubble.textContent = message.text;
    const time = document.createElement('small');
    const status = formatPeopleChatMessageStatus(message);
    if (status) time.dataset.status = String(message.status || 'sent').toLowerCase();
    time.textContent = status
      ? `${formatPeopleChatTime(message.timestamp)} · ${status}`
      : formatPeopleChatTime(message.timestamp);
    item.append(bubble, time);
    peopleChatThreadEl.appendChild(item);
  });
  peopleChatThreadEl.scrollTop = peopleChatThreadEl.scrollHeight;
}

function renderPeopleChat() {
  if (peopleChatThreadOpen && !activePeopleChatId && peopleChatConversations.length > 0) {
    activePeopleChatId = peopleChatConversations[0].conversationId;
  }
  const active = getActivePeopleChatConversation();
  if (!active) {
    peopleChatEditingUser = false;
    peopleChatConfirmingDelete = false;
  }
  peopleChatShellEl?.classList.toggle('thread-open', peopleChatThreadOpen);
  peopleChatShellEl?.classList.toggle('list-open', !peopleChatThreadOpen);
  if (peopleChatAddUserEl) peopleChatAddUserEl.hidden = !peopleChatAddUserOpen || peopleChatThreadOpen;
  if (peopleChatEditUserEl) peopleChatEditUserEl.hidden = !peopleChatEditingUser || !peopleChatThreadOpen || !active;
  if (peopleChatDeleteConfirmEl) peopleChatDeleteConfirmEl.hidden = !peopleChatConfirmingDelete || !peopleChatThreadOpen || !active;
  renderPeopleChatRegistration();
  renderPeopleChatList();
  renderPeopleChatThread();
}

function schedulePeopleChatRender() {
  if (peopleChatRenderFrame !== null) return;
  peopleChatRenderFrame = requestAnimationFrame(() => {
    peopleChatRenderFrame = null;
    renderPeopleChat();
  });
}

function returnPeopleChatToList() {
  peopleChatThreadOpen = false;
  activePeopleChatId = null;
  peopleChatAddUserOpen = false;
  peopleChatEditingUser = false;
  peopleChatConfirmingDelete = false;
  publishPeopleChatUiState();
  renderPeopleChat();
  requestAnimationFrame(() => peopleChatSearchEl?.focus());
}

function closePeopleChatApp() {
  peopleChatThreadOpen = false;
  activePeopleChatId = null;
  peopleChatAddUserOpen = false;
  peopleChatEditingUser = false;
  peopleChatConfirmingDelete = false;
  renderPeopleChat();
  setWorkspaceView('apps');
}

function openPeopleChatAddUser() {
  const registration = normalizePeopleChatRegistration(peopleChatRegistrationState || {});
  if (!registration.chatReady) {
    peopleChatRegistrationOpen = true;
    renderPeopleChatRegistration();
    showToast('Finish Chat settings', registration.deviceApprovalRequired
      ? 'Approve this desktop from a trusted device before adding users.'
      : 'Register this desktop before adding real OpenX Chat users.', 'warning');
    focusPeopleChatRegistration();
    return;
  }
  peopleChatAddUserOpen = true;
  peopleChatThreadOpen = false;
  activePeopleChatId = null;
  peopleChatEditingUser = false;
  peopleChatConfirmingDelete = false;
  publishPeopleChatUiState();
  if (peopleChatAddStatusEl) peopleChatAddStatusEl.textContent = '';
  renderPeopleChat();
  requestAnimationFrame(() => peopleChatUserNameEl?.focus());
}

function closePeopleChatAddUser() {
  peopleChatAddUserOpen = false;
  if (peopleChatUserNameEl) peopleChatUserNameEl.value = '';
  if (peopleChatUserIdEl) peopleChatUserIdEl.value = '';
  if (peopleChatAddStatusEl) peopleChatAddStatusEl.textContent = '';
  renderPeopleChat();
  requestAnimationFrame(() => peopleChatSearchEl?.focus());
}

function openPeopleChatEditUser() {
  const active = getActivePeopleChatConversation();
  if (!active) return;
  peopleChatEditingUser = true;
  peopleChatConfirmingDelete = false;
  if (peopleChatEditNameEl) peopleChatEditNameEl.value = active.title || '';
  if (peopleChatEditIdEl) peopleChatEditIdEl.value = active.peerHandle || active.status || '';
  if (peopleChatEditStatusEl) peopleChatEditStatusEl.textContent = '';
  renderPeopleChat();
  requestAnimationFrame(() => peopleChatEditNameEl?.focus());
}

function closePeopleChatEditUser() {
  peopleChatEditingUser = false;
  if (peopleChatEditStatusEl) peopleChatEditStatusEl.textContent = '';
  renderPeopleChat();
  requestAnimationFrame(() => peopleChatInputEl?.focus());
}

async function savePeopleChatUser(event) {
  event?.preventDefault?.();
  const active = getActivePeopleChatConversation();
  if (!active) return;
  const title = String(peopleChatEditNameEl?.value || '').trim();
  const peerHandle = String(peopleChatEditIdEl?.value || '').trim();
  if (!title || !peerHandle) {
    if (peopleChatEditStatusEl) peopleChatEditStatusEl.textContent = 'Name and ID are required.';
    return;
  }
  if (peopleChatEditStatusEl) peopleChatEditStatusEl.textContent = 'Saving...';
  if (window.openx?.updateDesktopChatConversation && /^conv_[a-f0-9]{64}$/i.test(String(active.conversationId))) {
    try {
      const result = await window.openx.updateDesktopChatConversation({
        conversationId: active.conversationId,
        title,
        peerName: title,
        peerHandle,
        peerType: active.peerType || 'openx'
      });
      if (result?.conversation) {
        replacePeopleChatConversation(result.conversation);
        peopleChatEditingUser = false;
        if (peopleChatEditStatusEl) peopleChatEditStatusEl.textContent = '';
        renderPeopleChat();
        requestAnimationFrame(() => peopleChatInputEl?.focus());
        return;
      }
    } catch (error) {
      showToast('Chat could not be updated', error?.message || 'Local chat data is unavailable.', 'error');
    }
  }

  active.title = title;
  active.peerHandle = peerHandle;
  active.status = peerHandle;
  active.lastMessageTimestamp = active.lastMessageTimestamp || new Date().toISOString();
  peopleChatEditingUser = false;
  if (peopleChatEditStatusEl) peopleChatEditStatusEl.textContent = '';
  renderPeopleChat();
  requestAnimationFrame(() => peopleChatInputEl?.focus());
}

function openPeopleChatDeleteConfirm() {
  const active = getActivePeopleChatConversation();
  if (!active) return;
  peopleChatConfirmingDelete = true;
  peopleChatEditingUser = false;
  renderPeopleChat();
  requestAnimationFrame(() => peopleChatDeleteConfirmBtn?.focus());
}

function closePeopleChatDeleteConfirm() {
  peopleChatConfirmingDelete = false;
  renderPeopleChat();
  requestAnimationFrame(() => peopleChatInputEl?.focus());
}

async function deletePeopleChatConversation() {
  const active = getActivePeopleChatConversation();
  if (!active) return;
  if (window.openx?.deleteDesktopChatConversation && /^conv_[a-f0-9]{64}$/i.test(String(active.conversationId))) {
    try {
      const result = await window.openx.deleteDesktopChatConversation(active.conversationId);
      removePeopleChatConversation(result?.conversationId || active.conversationId);
      peopleChatLoaded = false;
      renderPeopleChat();
      loadPeopleChatConversations({ force: true });
      return;
    } catch (error) {
      showToast('Chat could not be deleted', error?.message || 'Local chat data is unavailable.', 'error');
      return;
    }
  }

  removePeopleChatConversation(active.conversationId);
  renderPeopleChat();
}

async function loadPeopleChatConversations(options = {}) {
  if (!peopleChatView) return;
  if (peopleChatLoading) {
    if (options.force === true) peopleChatPendingLoad = true;
    return;
  }
  if (peopleChatLoaded && options.force !== true) {
    renderPeopleChat();
    return;
  }
  peopleChatLoading = true;
  peopleChatPendingLoad = false;
  renderPeopleChatList();
  const query = currentPeopleChatSearchQuery();
  try {
    if (window.openx?.listDesktopChatConversations) {
      const result = await window.openx.listDesktopChatConversations({ query, limit: PEOPLE_CHAT_LIMIT });
      if (peopleChatPendingLoad || query !== currentPeopleChatSearchQuery()) {
        peopleChatPendingLoad = true;
        return;
      }
      const existingById = new Map(peopleChatConversations.map(conversation => [conversation.conversationId, conversation]));
      peopleChatConversations = (Array.isArray(result?.conversations) ? result.conversations : [])
        .map(normalizePeopleChatConversation)
        .filter(conversation => conversation.conversationId)
        .map(conversation => {
          const existing = existingById.get(conversation.conversationId);
          if (!existing) return conversation;
          const mergedHistory = mergePeopleChatHistory(existing.history, conversation.history);
          if (mergedHistory.length <= conversation.history.length) return conversation;
          const lastMessage = mergedHistory[mergedHistory.length - 1] || null;
          return {
            ...conversation,
            history: mergedHistory,
            preview: conversation.preview && conversation.preview !== 'No messages yet'
              ? conversation.preview
              : (lastMessage?.text || existing.preview || conversation.preview),
            lastMessageTimestamp: conversation.lastMessageTimestamp || lastMessage?.timestamp || existing.lastMessageTimestamp
          };
        });
    } else {
      peopleChatConversations = PEOPLE_CHAT_FALLBACK_CONVERSATIONS.map(normalizePeopleChatConversation);
    }
    if (peopleChatThreadOpen && (!activePeopleChatId || !peopleChatConversations.some(item => item.conversationId === activePeopleChatId))) {
      activePeopleChatId = peopleChatConversations[0]?.conversationId || null;
      peopleChatEditingUser = false;
      peopleChatConfirmingDelete = false;
    }
    peopleChatLoaded = true;
  } catch (error) {
    showToast('Chat could not load', error?.message || 'Local chat data is unavailable.', 'error');
  } finally {
    peopleChatLoading = false;
    if (peopleChatPendingLoad) {
      peopleChatPendingLoad = false;
      peopleChatLoaded = false;
      window.setTimeout(() => loadPeopleChatConversations({ force: true }), 0);
    } else {
      renderPeopleChat();
    }
  }
}

async function selectPeopleChatConversation(conversationId) {
  activePeopleChatId = conversationId;
  peopleChatThreadOpen = true;
  peopleChatAddUserOpen = false;
  peopleChatEditingUser = false;
  peopleChatConfirmingDelete = false;
  publishPeopleChatUiState();
  renderPeopleChat();
  if (!window.openx?.openDesktopChatConversation || !/^conv_[a-f0-9]{64}$/i.test(String(conversationId || ''))) return;
  try {
    const result = await window.openx.openDesktopChatConversation(conversationId);
    if (result?.conversation) {
      replacePeopleChatConversation(result.conversation);
      renderPeopleChat();
    }
  } catch (error) {
    showToast('Chat could not open', error?.message || 'Conversation data is unavailable.', 'error');
  }
}

async function createPeopleChatConversation(event) {
  event?.preventDefault?.();
  const registration = normalizePeopleChatRegistration(peopleChatRegistrationState || {});
  if (!registration.chatReady) {
    if (peopleChatAddStatusEl) {
      peopleChatAddStatusEl.textContent = registration.deviceApprovalRequired
        ? 'Approve this desktop before adding real OpenX Chat users.'
        : 'Finish Chat settings before adding real OpenX Chat users.';
    }
    peopleChatRegistrationOpen = true;
    renderPeopleChatRegistration();
    showToast('Chat setup not ready', peopleChatAddStatusEl?.textContent || 'Finish Chat settings first.', 'warning');
    return;
  }
  const title = String(peopleChatUserNameEl?.value || '').trim();
  const peerHandle = String(peopleChatUserIdEl?.value || '').trim();
  if (!title || !peerHandle) {
    if (peopleChatAddStatusEl) peopleChatAddStatusEl.textContent = 'Name and username are required.';
    return;
  }
  if (peopleChatAddStatusEl) peopleChatAddStatusEl.textContent = 'Sending request...';
  if (window.openx?.createDesktopChatConversation) {
    try {
      const result = await window.openx.createDesktopChatConversation({
        title,
        peerName: title,
        peerHandle
      });
      if (result?.conversation) {
        const conversation = replacePeopleChatConversation(result.conversation);
        activePeopleChatId = conversation?.conversationId || activePeopleChatId;
        peopleChatThreadOpen = true;
        peopleChatAddUserOpen = false;
        peopleChatEditingUser = false;
        peopleChatConfirmingDelete = false;
        peopleChatLoaded = true;
        publishPeopleChatUiState();
        if (peopleChatUserNameEl) peopleChatUserNameEl.value = '';
        if (peopleChatUserIdEl) peopleChatUserIdEl.value = '';
        if (peopleChatAddStatusEl) peopleChatAddStatusEl.textContent = '';
        renderPeopleChat();
        if (result?.pending) showToast('Request sent', `${title} will appear as trusted after accepting.`, 'success');
        loadPeopleChatRequests({ force: true });
        requestAnimationFrame(() => peopleChatInputEl?.focus());
        return;
      }
    } catch (error) {
      if (peopleChatAddStatusEl) peopleChatAddStatusEl.textContent = error?.message || 'Request could not be sent.';
      showToast('Request could not be sent', error?.message || 'OpenX Chat server is unavailable.', 'error');
      return;
    }
  }

  if (peopleChatAddStatusEl) peopleChatAddStatusEl.textContent = 'Desktop Chat service is unavailable.';
  showToast('Request could not be sent', 'Desktop Chat service is unavailable.', 'error');
}

async function sendPeopleChatMessage(event) {
  event?.preventDefault?.();
  const text = String(peopleChatInputEl?.value || '').trim();
  if (!text) return;
  if (!activePeopleChatId) {
    showToast('Choose a person first', 'Select a chat or add a user before sending a message.', 'warning');
    return;
  }
  peopleChatInputEl.value = '';
  const conversation = peopleChatConversations.find(item => item.conversationId === activePeopleChatId);
  const optimisticId = `local-message-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const timestamp = new Date().toISOString();
  if (conversation) {
    conversation.history.push({
      messageId: optimisticId,
      direction: 'outgoing',
      text,
      status: 'sending',
      timestamp
    });
    conversation.history = conversation.history.slice(-PEOPLE_CHAT_HISTORY_LIMIT);
    conversation.preview = text.slice(0, 140);
    conversation.lastMessageTimestamp = timestamp;
    renderPeopleChat();
  }

  if (window.openx?.sendDesktopChatMessage && /^conv_[a-f0-9]{64}$/i.test(String(activePeopleChatId))) {
    try {
      const result = await window.openx.sendDesktopChatMessage({ conversationId: activePeopleChatId, text });
      if (result?.conversation) {
        replacePeopleChatConversation(result.conversation);
        renderPeopleChat();
        return;
      }
    } catch (error) {
      if (conversation) {
        conversation.history = conversation.history.map(message => (
          message.messageId === optimisticId ? { ...message, status: 'failed' } : message
        ));
        renderPeopleChat();
      }
      if (peopleChatInputEl && !peopleChatInputEl.value) peopleChatInputEl.value = text;
      showToast('Message could not be sent', error?.message || 'OpenX Chat server is unavailable.', 'error');
      requestAnimationFrame(() => peopleChatInputEl?.focus());
      return;
    }
  }

  if (!conversation) return;
  conversation.history = conversation.history.map(message => (
    message.messageId === optimisticId ? { ...message, status: 'sent' } : message
  ));
  conversation.history = conversation.history.slice(-PEOPLE_CHAT_HISTORY_LIMIT);
  conversation.preview = text.slice(0, 140);
  conversation.lastMessageTimestamp = timestamp;
  renderPeopleChat();
}

function handleDesktopChatChanged(payload = {}) {
  const reason = String(payload.reason || '').toLowerCase();
  if (reason === 'deleted') {
    removePeopleChatConversation(payload.conversationId);
    if (activeWorkspaceView === 'people-chat') schedulePeopleChatRender();
    if (activeWorkspaceView === 'people-chat') {
      peopleChatLoaded = false;
      loadPeopleChatConversations({ force: true });
    }
    return;
  }

  if (payload.conversation) {
    replacePeopleChatConversation(payload.conversation, {
      preserveExistingHistory: ['synced', 'trusted', 'updated'].includes(reason)
    });
    peopleChatLoaded = true;
    if (activeWorkspaceView === 'people-chat') schedulePeopleChatRender();
    return;
  }

  peopleChatLoaded = false;
  if (activeWorkspaceView === 'people-chat') loadPeopleChatConversations({ force: true });
}

function openPeopleChatFromDesktopEvent() {
  setWorkspaceView('people-chat');
  loadPeopleChatRegistration({ force: true }).then(() => loadPeopleChatRequests({ force: true }));
  peopleChatLoaded = false;
  loadPeopleChatConversations({ force: true });
}

function setWorkspaceView(viewName) {
  activeWorkspaceView = ['activity', 'apps', 'people-chat', 'reminders', 'remote', 'mobile', 'home-automation'].includes(viewName) ? viewName : 'chat';
  const showingActivity = activeWorkspaceView === 'activity';
  const showingApps = activeWorkspaceView === 'apps';
  const showingPeopleChat = activeWorkspaceView === 'people-chat';
  const showingReminders = activeWorkspaceView === 'reminders';
  const showingRemote = activeWorkspaceView === 'remote';
  const showingMobile = activeWorkspaceView === 'mobile';
  const showingHomeAutomation = activeWorkspaceView === 'home-automation';
  const showingChat = activeWorkspaceView === 'chat';
  const activeSwitcherView = showingActivity ? 'activity' : showingApps ? 'apps' : showingChat ? 'chat' : 'none';
  if (viewSwitcherEl) viewSwitcherEl.dataset.activeView = activeSwitcherView;
  document.body?.classList.toggle('people-chat-fullscreen', showingPeopleChat);
  document.body?.classList.toggle('reminders-fullscreen', showingReminders);
  document.body?.classList.toggle('remote-fullscreen', showingRemote);
  document.body?.classList.toggle('mobile-fullscreen', showingMobile);
  document.body?.classList.toggle('home-automation-fullscreen', showingHomeAutomation);
  conversationView.classList.toggle('active', showingChat);
  conversationView.hidden = !showingChat;
  peopleChatView.classList.toggle('active', showingPeopleChat);
  peopleChatView.hidden = !showingPeopleChat;
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
  } else if (showingPeopleChat) {
    peopleChatThreadOpen = false;
    activePeopleChatId = null;
    peopleChatAddUserOpen = false;
    peopleChatEditingUser = false;
    peopleChatConfirmingDelete = false;
    loadPeopleChatRegistration().then(() => loadPeopleChatRequests());
    loadPeopleChatConversations();
    requestAnimationFrame(() => peopleChatSearchEl?.focus());
  } else if (showingChat) {
    requestAnimationFrame(() => inputBox.focus());
  }
  publishPeopleChatUiState();
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

function normalizeHomeBluetoothDevice(bluetoothDevice, info = {}) {
  const deviceId = String(info.deviceId || bluetoothDevice?.id || '').trim();
  return {
    deviceId,
    deviceName: String(info.deviceName || bluetoothDevice?.name || 'OpenX Home Device').trim(),
    firmwareVersion: String(info.firmwareVersion || 'unknown').trim(),
    hardwareModel: String(info.hardwareModel || '').trim(),
    protocolVersion: String(info.protocolVersion || 'openx-home-v1').trim(),
    deviceStatus: info.provisioningRequired === false ? 'ready' : 'ready_for_setup',
    connectionStatus: 'ble_advertising',
    pairingStatus: 'unpaired',
    discoverySource: 'bluetooth',
    transport: 'ble',
    bluetoothDeviceId: String(bluetoothDevice?.id || '').trim(),
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
    const serviceResult = await getHomeBluetoothService({ device: bluetoothDevice });
    if (!serviceResult.success) return serviceResult;
    const infoCharacteristic = await serviceResult.service.getCharacteristic(HOME_BLE_DEVICE_INFO_UUID);
    const info = parseHomeBluetoothJson(await infoCharacteristic.readValue(), {});
    const discovered = normalizeHomeBluetoothDevice(bluetoothDevice, info);
    if (!discovered.deviceId) {
      return { success: false, code: 'home-device-id-missing', message: 'The Bluetooth Home Device did not report a device ID.' };
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
  speakAssistantResponse(result.response || `Please confirm this action, ${getHonorific()}.`);
}

function speakAssistantResponse(text) {
  const spokenText = String(text || '').trim();
  if (!isAssistantMuted && spokenText && window.openx?.speak) {
    window.openx.speak(spokenText);
  }
}

function updateAssistantMuteButton() {
  assistantMuteBtn.classList.toggle('active', isAssistantMuted);
  assistantMuteBtn.setAttribute('aria-pressed', String(isAssistantMuted));
  assistantMuteBtn.setAttribute('aria-label', isAssistantMuted ? 'Unmute assistant voice' : 'Mute assistant voice');
  assistantMuteBtn.title = isAssistantMuted ? 'Unmute assistant voice' : 'Mute assistant voice';
  assistantMuteBtn.querySelector('.voice-icon').textContent = isAssistantMuted ? '\u{1F507}' : '\u{1F50A}';
}

async function toggleAssistantMute() {
  isAssistantMuted = !isAssistantMuted;
  saveUiState();
  updateAssistantMuteButton();
  if (isAssistantMuted && window.openx?.stopSpeaking) {
    await window.openx.stopSpeaking();
  }
  showToast(
    isAssistantMuted ? 'Assistant voice muted' : 'Assistant voice on',
    isAssistantMuted ? 'Spoken replies are off. Other app audio is unchanged.' : 'Spoken assistant replies are enabled.',
    'info'
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

async function startVoiceFromChat() {
  if (!window.openx?.startVoice) return;
  voiceStartBtn.disabled = true;
  voiceStartBtn.classList.add('active');
  try {
    await window.openx.startVoice();
  } catch (error) {
    addMessage(error?.message || 'Voice could not start.', 'system', `${getAssistantDisplayName()} - voice`);
  } finally {
    voiceStartBtn.disabled = false;
    voiceStartBtn.classList.remove('active');
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
        speakAssistantResponse(response);
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
    speakAssistantResponse(response);
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

function updateTtsSliderLabels() {
  const volumeEl = document.getElementById(fieldIds.assistantTtsVolume);
  const rateEl = document.getElementById(fieldIds.assistantTtsRate);
  const volumeValueEl = document.getElementById('assistant-tts-volume-value');
  const rateValueEl = document.getElementById('assistant-tts-rate-value');

  if (volumeEl && volumeValueEl) {
    volumeValueEl.textContent = `${volumeEl.value || 100}%`;
  }

  if (rateEl && rateValueEl) {
    const rate = Number(rateEl.value || 0);
    rateValueEl.textContent = rate > 0 ? `+${rate}` : String(rate);
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
  setFieldValue(fieldIds.assistantTtsVolume, String(settings.voice?.tts?.volume ?? 100));
  setFieldValue(fieldIds.assistantTtsRate, String(settings.voice?.tts?.rate ?? 2));
  updateTtsSliderLabels();
  setFieldValue(fieldIds.profileFullName, settings.userProfile.fullName);
  setFieldValue(fieldIds.profileEmail, settings.userProfile.email);
  setFieldValue(fieldIds.profilePhone, settings.userProfile.phone);
  setFieldValue(fieldIds.profileAddressLine1, settings.userProfile.addressLine1);
  setFieldValue(fieldIds.profileCity, settings.userProfile.city);
  setFieldValue(fieldIds.profileState, settings.userProfile.state);
  setFieldValue(fieldIds.profilePostalCode, settings.userProfile.postalCode);
  setFieldValue(fieldIds.profileCountry, settings.userProfile.country);
  setFieldValue(fieldIds.profileCompany, settings.userProfile.company);
  setFieldValue(fieldIds.profileRole, settings.userProfile.role);
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
  settingsFooterSection.classList.toggle('open', Boolean(activeSettingsSection));
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
    voice: {
      tts: {
        volume: Number(document.getElementById(fieldIds.assistantTtsVolume).value || 100),
        rate: Number(document.getElementById(fieldIds.assistantTtsRate).value || 2)
      }
    },
    chat: {
      themeId: selectedThemeId,
      glassTint: Number(document.getElementById(fieldIds.glassTint).value || 42),
      maxHistory: Math.max(50, Math.min(300, Number(document.getElementById(fieldIds.chatMaxHistory).value || 300)))
    },
    userProfile: {
      fullName: document.getElementById(fieldIds.profileFullName).value.trim(),
      email: document.getElementById(fieldIds.profileEmail).value.trim(),
      phone: document.getElementById(fieldIds.profilePhone).value.trim(),
      addressLine1: document.getElementById(fieldIds.profileAddressLine1).value.trim(),
      city: document.getElementById(fieldIds.profileCity).value.trim(),
      state: document.getElementById(fieldIds.profileState).value.trim(),
      postalCode: document.getElementById(fieldIds.profilePostalCode).value.trim(),
      country: document.getElementById(fieldIds.profileCountry).value.trim(),
      company: document.getElementById(fieldIds.profileCompany).value.trim(),
      role: document.getElementById(fieldIds.profileRole).value.trim()
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
  document.getElementById('settings-hero-title').textContent = 'Configured for local automation, profile storage, voice, and theme.';
  document.getElementById('settings-hero-honorific').textContent = settingsSnapshot?.settings?.assistant?.honorific || 'sir';
  document.getElementById('settings-hero-theme').textContent = theme?.label || 'Theme';
  document.getElementById('settings-hero-learning').textContent = settingsSnapshot?.settings?.activeLearning?.enabled === false ? 'Disabled' : 'Enabled';
}

async function openAboutPanel() {
  if (!aboutOverlay) return;
  aboutOverlay.hidden = false;
  aboutButtons.forEach(button => button.setAttribute('aria-expanded', 'true'));
  aboutPanel?.focus?.({ preventScroll: true });
  await refreshAboutPanel();
}

function closeAboutPanel() {
  if (!aboutOverlay || aboutOverlay.hidden) return;
  aboutOverlay.hidden = true;
  aboutButtons.forEach(button => button.setAttribute('aria-expanded', 'false'));
  activeAboutTrigger?.focus?.({ preventScroll: true });
  activeAboutTrigger = null;
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
  renderSecurityStatus(snapshot?.securityStatus);
  if (snapshot?.cloudStatus) {
    renderCloudStatus(snapshot.cloudStatus);
  }
  if (snapshot?.cloudPairingStatus) {
    renderCloudPairingStatus(snapshot.cloudPairingStatus);
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

function closeSettingsPanel() {
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

function initializeCompactSettingsLayout() {
  const panelHeader = document.querySelector('.panel-header');
  const panelActions = settingsFooterSection.querySelector('.panel-actions');
  const resetButton = document.getElementById('settings-reset-btn');
  resetButton.textContent = 'Reset';
  panelActions.classList.add('settings-header-actions');
  panelHeader.insertBefore(panelActions, settingsCloseBtn);
  settingsFooterSection.remove();

}

async function saveSettings() {
  try {
    setSettingsStatus('Saving settings...', 'info');
    const snapshot = await window.openx.saveSettings(collectSettingsPayload());
    applySnapshot(snapshot);
    setProfileEditorOpen(false);
    setSettingsStatus('Settings saved successfully.', 'success');
    addMessage(`Settings updated. ${getAssistantDisplayName()} is ready, ${getHonorific()}.`, 'system', assistantMeta('settings'));
  } catch (err) {
    setSettingsStatus('Unable to save settings.', 'error');
  }
}

async function resetSettings() {
  try {
    setSettingsStatus('Resetting settings...', 'info');
    const snapshot = await window.openx.resetSettings();
    setActiveSettingsSection(null);
    applySnapshot(snapshot);
    setProfileEditorOpen(false);
    setSettingsStatus('Settings reset to defaults.', 'success');
  } catch (err) {
    setSettingsStatus('Unable to reset settings.', 'error');
  }
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
    const version = device?.softwareVersion ? ` - v${device.softwareVersion}` : '';
    mobileConnectedDeviceMetaEl.textContent = connected
      ? `Connected${version}`
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
  if (cloudVersionEl) {
    cloudVersionEl.textContent = safeStatus.serverVersion || '--';
  }
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
  if (aboutOverlay && !aboutOverlay.hidden) {
    refreshAboutPanel();
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
    ['Version', device.softwareVersion || 'Unknown'],
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

document.getElementById(fieldIds.assistantTtsVolume).addEventListener('input', updateTtsSliderLabels);
document.getElementById(fieldIds.assistantTtsRate).addEventListener('input', updateTtsSliderLabels);
document.getElementById(fieldIds.glassTint).addEventListener('input', event => scheduleGlassTintUpdate(event.target.value));
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
peopleChatAppBtn?.addEventListener('click', () => {
  peopleChatAppBtn.classList.add('opening');
  setWorkspaceView('people-chat');
  window.setTimeout(() => peopleChatAppBtn.classList.remove('opening'), 180);
});
calendarAppBtn?.addEventListener('click', () => {
  runHeaderApp(calendarAppBtn, () => window.openx?.openPlanner?.('calendar'));
});
remindersAppBtn?.addEventListener('click', () => {
  remindersAppBtn.classList.add('opening');
  openRemindersApp();
  window.setTimeout(() => remindersAppBtn.classList.remove('opening'), 180);
});
galleryAppBtn?.addEventListener('click', () => {
  runHeaderApp(galleryAppBtn, () => window.openx?.openGallery?.('timeline'));
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
peopleChatNewBtn?.addEventListener('click', openPeopleChatAddUser);
peopleChatCloseBtn?.addEventListener('click', closePeopleChatApp);
peopleChatBackBtn?.addEventListener('click', returnPeopleChatToList);
peopleChatEditBtn?.addEventListener('click', openPeopleChatEditUser);
peopleChatDeleteBtn?.addEventListener('click', openPeopleChatDeleteConfirm);
peopleChatAddUserEl?.addEventListener('submit', createPeopleChatConversation);
peopleChatAddCancelBtn?.addEventListener('click', closePeopleChatAddUser);
peopleChatEditUserEl?.addEventListener('submit', savePeopleChatUser);
peopleChatEditCancelBtn?.addEventListener('click', closePeopleChatEditUser);
peopleChatDeleteCancelBtn?.addEventListener('click', closePeopleChatDeleteConfirm);
peopleChatDeleteConfirmBtn?.addEventListener('click', deletePeopleChatConversation);
peopleChatComposerEl?.addEventListener('submit', sendPeopleChatMessage);
peopleChatProfileBtn?.addEventListener('click', togglePeopleChatProfile);
peopleChatSettingsBtn?.addEventListener('click', togglePeopleChatRegistration);
peopleChatRegistrationCloseBtn?.addEventListener('click', closePeopleChatRegistration);
peopleChatRegistrationOverlayEl?.addEventListener('click', (event) => {
  if (event.target === peopleChatRegistrationOverlayEl) closePeopleChatRegistration();
});
peopleChatRegistrationStartEl?.addEventListener('submit', startPeopleChatRegistration);
peopleChatPasswordResetEl?.addEventListener('submit', resetPeopleChatPassword);
peopleChatRequestsRefreshBtn?.addEventListener('click', () => loadPeopleChatRequests({ force: true }));
peopleChatSearchEl?.addEventListener('input', () => {
  if (peopleChatSearchTimer) clearTimeout(peopleChatSearchTimer);
  peopleChatSearchTimer = window.setTimeout(() => {
    peopleChatSearchTimer = null;
    if (window.openx?.listDesktopChatConversations) {
      peopleChatLoaded = false;
      loadPeopleChatConversations({ force: true });
    } else {
      renderPeopleChatList();
    }
  }, PEOPLE_CHAT_SEARCH_DEBOUNCE_MS);
});
peopleChatFilterButtons.forEach(button => {
  button.addEventListener('click', () => {
    peopleChatFilter = button.dataset.chatFilter || 'all';
    peopleChatFilterButtons.forEach(item => item.classList.toggle('active', item === button));
    renderPeopleChatList();
  });
});
document.getElementById('clear-notifications-btn').addEventListener('click', () => {
  notificationHistory = [];
  saveUiState();
  renderNotifications();
});
closeBtn.addEventListener('click', closeChatWindow);
aboutButtons.forEach(button => {
  button.addEventListener('click', () => {
    activeAboutTrigger = button;
    if (aboutOverlay && !aboutOverlay.hidden) {
      closeAboutPanel();
    } else {
      openAboutPanel();
    }
  });
});
aboutCloseBtn?.addEventListener('click', closeAboutPanel);
voiceStartBtn.addEventListener('click', startVoiceFromChat);
assistantMuteBtn.addEventListener('click', toggleAssistantMute);
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
document.getElementById('settings-save-btn').addEventListener('click', saveSettings);
document.getElementById('settings-reset-btn').addEventListener('click', resetSettings);
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
aboutOverlay?.addEventListener('click', (event) => {
  if (event.target === aboutOverlay) {
    closeAboutPanel();
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
  if (event.key === 'Escape' && aboutOverlay && !aboutOverlay.hidden) {
    closeAboutPanel();
    return;
  }
  if (event.key === 'Escape' && securityUnlockDialog && !securityUnlockDialog.hidden) {
    closeSecurityUnlockDialog('');
    return;
  }
  if (event.key === 'Escape' && phoneDeviceRemoveDialog && !phoneDeviceRemoveDialog.hidden) {
    closePhoneDeviceRemoveDialog();
    return;
  }
  if (event.key === 'Escape' && peopleChatRegistrationOpen) {
    closePeopleChatRegistration();
  }
});

function cleanupRendererResources() {
  stopSettingsStatusPolling();
  stopCloudPairingCountdown();
  if (peopleChatSearchTimer) {
    clearTimeout(peopleChatSearchTimer);
    peopleChatSearchTimer = null;
  }
  if (peopleChatRenderFrame !== null) {
    cancelAnimationFrame(peopleChatRenderFrame);
    peopleChatRenderFrame = null;
  }
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
  window.openx.onOpenSettings?.(openSettingsPanel);
  window.openx.onOpenDesktopChat?.(openPeopleChatFromDesktopEvent);
  window.openx.onDesktopChatChanged?.(handleDesktopChatChanged);
  window.openx.onDesktopChatRegistrationChanged?.(handlePeopleChatRegistrationChanged);
  window.openx.onHomeOnboardingChanged?.(handleHomeOnboardingChanged);
}

async function initialize() {
  setProfileEditorOpen(false);
  initializeCompactSettingsLayout();
  const conversationStart = ensureConversationReady();
  await loadUiState();
  updateAssistantMuteButton();
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
