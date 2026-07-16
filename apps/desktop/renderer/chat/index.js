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
const securityLockStatusEl = document.getElementById('security-lock-status');
const securityRefreshBtn = document.getElementById('security-refresh-btn');
const securityCurrentPasswordEl = document.getElementById('security-current-password');
const securityNewPasswordEl = document.getElementById('security-new-password');
const securityConfirmPasswordEl = document.getElementById('security-confirm-password');
const securitySavePasswordBtn = document.getElementById('security-save-password-btn');
const securityPasswordMessageEl = document.getElementById('security-password-message');
const phoneDeviceListEl = document.getElementById('phone-device-list');
const deviceSearchEl = document.getElementById('device-search');
const deviceFilterEl = document.getElementById('device-filter');
const deviceSortEl = document.getElementById('device-sort');
const deviceRefreshBtn = document.getElementById('device-refresh-btn');
const phoneSectionTabs = document.querySelectorAll('.phone-section-tab');
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
const chatViewBtn = document.getElementById('chat-view-btn');
const activityViewBtn = document.getElementById('activity-view-btn');
const appsViewBtn = document.getElementById('apps-view-btn');
const calendarAppBtn = document.getElementById('calendar-app-btn');
const galleryAppBtn = document.getElementById('gallery-app-btn');
const settingsAppBtn = document.getElementById('settings-app-btn');
const conversationView = document.getElementById('conversation-view');
const activityView = document.getElementById('activity-view');
const appsView = document.getElementById('apps-view');
const activityBadge = document.getElementById('activity-badge');
const scheduleListEl = document.getElementById('schedule-list');
const scheduleCountEl = document.getElementById('schedule-count');
const notificationListEl = document.getElementById('notification-list');
const toastRegionEl = document.getElementById('toast-region');

const MODE_LIMIT = 5;
const MODE_APP_LIMIT = 5;
const SCHEDULE_STORAGE_KEY = 'openx-ui-schedules-v1';
const NOTIFICATION_STORAGE_KEY = 'openx-ui-notifications-v1';
const CHAT_HISTORY_STORAGE_KEY = 'openx-ui-chat-history-v2';
const MAX_NOTIFICATION_HISTORY = 30;
const CHAT_HISTORY_LIMIT = 100;
const MAX_RENDERED_MESSAGES = CHAT_HISTORY_LIMIT;
const ASSISTANT_MUTED_STORAGE_KEY = 'openx-assistant-voice-muted-v1';

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
let activeAboutTrigger = null;
let scheduleItems = loadStoredList(SCHEDULE_STORAGE_KEY);
let notificationHistory = loadStoredList(NOTIFICATION_STORAGE_KEY);
let conversationHistory = [];
let isAssistantMuted = localStorage.getItem(ASSISTANT_MUTED_STORAGE_KEY) === 'true';
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
let imagePreviewState = null;
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

function saveStoredList(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {}
}

function chatHistoryLimit() {
  const configured = Number(settingsSnapshot?.settings?.chat?.maxHistory);
  if (!Number.isFinite(configured) || configured <= 0) return CHAT_HISTORY_LIMIT;
  return Math.max(1, Math.min(CHAT_HISTORY_LIMIT, Math.round(configured)));
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

function loadConversationHistory() {
  return loadStoredList(CHAT_HISTORY_STORAGE_KEY)
    .map(normalizeChatHistoryItem)
    .filter(Boolean)
    .slice(-CHAT_HISTORY_LIMIT);
}

function saveConversationHistory() {
  conversationHistory = conversationHistory
    .map(normalizeChatHistoryItem)
    .filter(Boolean)
    .slice(-chatHistoryLimit());
  saveStoredList(CHAT_HISTORY_STORAGE_KEY, conversationHistory);
}

function rememberConversationMessage(text, type, meta) {
  const item = normalizeChatHistoryItem({ text, type, meta, createdAt: Date.now() });
  if (!item) return;
  conversationHistory.push(item);
  saveConversationHistory();
}

function restoreConversationHistory() {
  if (!messagesEl) return 0;
  conversationHistory = loadConversationHistory().slice(-chatHistoryLimit());
  messagesEl.replaceChildren();
  renderedMessageCount = 0;
  conversationHistory.forEach(item => {
    addMessage(item.text, item.type, item.meta, { persist: false });
  });
  hasRenderedWelcome = conversationHistory.length > 0;
  return conversationHistory.length;
}

function normalizeResultEntries(result) {
  const intent = String(result?.intent || '');
  const visualResults = Array.isArray(result?.data?.visualResults) ? result.data.visualResults : [];
  if (visualResults.length > 0) {
    return visualResults.slice(0, 12).map((entry, index) => ({
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
  overlay.innerHTML = `
    <section class="chat-image-preview-panel" role="dialog" aria-modal="true" aria-labelledby="chat-image-preview-title" tabindex="-1">
      <button class="chat-image-preview-close" type="button" aria-label="Close image preview">&times;</button>
      <div class="chat-image-preview-media">
        <img alt="" decoding="async">
        <div class="chat-image-preview-empty">Preview unavailable</div>
      </div>
      <div class="chat-image-preview-copy">
        <strong id="chat-image-preview-title">Photo Memory</strong>
        <span id="chat-image-preview-meta"></span>
      </div>
      <div class="chat-image-preview-actions">
        <button class="chat-image-preview-secondary" type="button">Close</button>
        <button class="chat-image-preview-primary" type="button">Open in Gallery</button>
      </div>
    </section>
  `;
  const close = () => closeChatImagePreview();
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  overlay.querySelector('.chat-image-preview-close')?.addEventListener('click', close);
  overlay.querySelector('.chat-image-preview-secondary')?.addEventListener('click', close);
  overlay.querySelector('.chat-image-preview-primary')?.addEventListener('click', () => {
    const photoId = imagePreviewState?.photoId;
    if (photoId) {
      window.openx?.showGalleryPhoto?.(photoId);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !overlay.hidden) close();
  });
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
    item.className = `message-result ${entry.type === 'folder' ? 'folder-result' : entry.type === 'web' ? 'web-result' : 'file-result'}`;
    const icon = document.createElement('span');
    icon.className = 'message-result-icon';
    icon.textContent = entry.type === 'folder' ? 'Folder' : entry.type === 'web' ? 'Web' : 'File';
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

function setWorkspaceView(viewName) {
  activeWorkspaceView = viewName === 'activity' || viewName === 'apps' ? viewName : 'chat';
  const showingActivity = activeWorkspaceView === 'activity';
  const showingApps = activeWorkspaceView === 'apps';
  const showingChat = activeWorkspaceView === 'chat';
  conversationView.classList.toggle('active', showingChat);
  conversationView.hidden = !showingChat;
  activityView.classList.toggle('active', showingActivity);
  activityView.hidden = !showingActivity;
  appsView.classList.toggle('active', showingApps);
  appsView.hidden = !showingApps;
  chatViewBtn.classList.toggle('active', showingChat);
  chatViewBtn.setAttribute('aria-pressed', String(showingChat));
  activityViewBtn.classList.toggle('active', showingActivity);
  activityViewBtn.setAttribute('aria-pressed', String(showingActivity));
  appsViewBtn.classList.toggle('active', showingApps);
  appsViewBtn.setAttribute('aria-pressed', String(showingApps));
  if (showingActivity) {
    renderActivity();
  } else if (showingChat) {
    requestAnimationFrame(() => inputBox.focus());
  }
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
  saveStoredList(NOTIFICATION_STORAGE_KEY, notificationHistory);
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
  saveStoredList(SCHEDULE_STORAGE_KEY, scheduleItems);
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
  saveStoredList(SCHEDULE_STORAGE_KEY, scheduleItems);
  renderActivity();
}

async function refreshActivitySchedulesFromRuntime() {
  if (!window.openx?.getScheduleSnapshot) return;
  try {
    const snapshot = await window.openx.getScheduleSnapshot();
    replaceScheduleItemsFromRuntime(snapshot?.entries || snapshot?.data?.entries || []);
  } catch (error) {
    console.warn('Schedule activity sync failed', error);
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
  saveStoredList(SCHEDULE_STORAGE_KEY, scheduleItems);
  showToast(`${item.kind} due`, item.message, scheduleTone(item.kind, item.category, item.message).tone, { duration: 0 });
  renderActivity();
}

function updateSchedule(id, changes) {
  const item = scheduleItems.find(entry => entry.id === id);
  if (!item) return;
  Object.assign(item, changes);
  saveStoredList(SCHEDULE_STORAGE_KEY, scheduleItems);
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
  localStorage.setItem(ASSISTANT_MUTED_STORAGE_KEY, String(isAssistantMuted));
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
    window.setTimeout(() => window.close(), 80);
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
  const allowedBlocks = new Set(['identity', 'theme', 'security']);
  activeSystemBlock = allowedBlocks.has(blockName) ? blockName : 'identity';

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
  const allowedPanels = new Set(['connect', 'devices']);
  activePhonePanel = allowedPanels.has(panelName) ? panelName : 'connect';
  phoneSectionTabs.forEach(button => {
    const isActive = button.dataset.phonePanelTarget === activePhonePanel;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });
  phonePanels.forEach(panel => {
    const isOpen = panel.dataset.phonePanel === activePhonePanel;
    panel.classList.toggle('active', isOpen);
    panel.hidden = !isOpen;
  });
  if (activePhonePanel === 'devices') {
    loadPhoneDevices();
  } else {
    loadCloudStatus();
    loadCloudPairingStatus();
  }
}

function setActiveSettingsSection(sectionName) {
  activeSettingsSection = sectionName || null;

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
  if (activeSettingsSection === 'phone') setActivePhonePanel(activePhonePanel);
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
      maxHistory: Math.max(50, Math.min(250, Number(document.getElementById(fieldIds.chatMaxHistory).value || 250)))
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

function ensureConversationReady() {
  const restored = restoreConversationHistory();
  if (restored === 0) ensureWelcomeMessage();
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

function openSettingsPanel() {
  setActiveSettingsSection(activeSettingsSection || 'system');
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
    if (activeSettingsSection === 'phone') {
      if (activePhonePanel === 'devices') {
        tasks.push(loadPhoneDevices());
      } else {
        tasks.push(loadCloudStatus(), loadCloudPairingStatus());
      }
    }
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

function startCloudPairingCountdown(expiresAt) {
  stopCloudPairingCountdown();
  const update = () => {
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      stopCloudPairingCountdown();
      if (cloudPairingStatusEl) cloudPairingStatusEl.textContent = 'Cloud pairing QR expired.';
      if (cloudPairingCountdownEl) cloudPairingCountdownEl.textContent = 'Expired';
      if (cloudPairingQrEl) cloudPairingQrEl.classList.add('expired');
      if (cloudGenerateQrBtn) cloudGenerateQrBtn.textContent = 'Generate New QR';
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
    cloudGenerateQrBtn.textContent = 'Generate New QR';
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
    cloudConnectBtn.textContent = safeStatus.connected ? 'Disconnect' : 'Connect to Cloud';
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
  if (activeSettingsSection === 'phone' && activePhonePanel === 'devices') {
    loadPhoneDevices();
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
  const filteredDevices = getFilteredDevices(latestManagedDevices);
  if (latestManagedDevices.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'phone-device-empty';
    empty.textContent = 'No paired devices yet. Use Connect Mobile to pair a device.';
    phoneDeviceListEl.appendChild(empty);
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
calendarAppBtn?.addEventListener('click', () => {
  runHeaderApp(calendarAppBtn, () => window.openx?.openPlanner?.('calendar'));
});
galleryAppBtn?.addEventListener('click', () => {
  runHeaderApp(galleryAppBtn, () => window.openx?.openGallery?.('timeline'));
});
settingsAppBtn?.addEventListener('click', () => {
  openSettingsPanel();
});
document.getElementById('clear-notifications-btn').addEventListener('click', () => {
  notificationHistory = [];
  saveStoredList(NOTIFICATION_STORAGE_KEY, notificationHistory);
  renderNotifications();
});
closeBtn.addEventListener('click', () => window.close());
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
    }
  });
});
systemOptionButtons.forEach(button => {
  button.addEventListener('click', () => {
    const targetBlock = button.dataset.systemBlockTarget;
    setActiveSystemBlock(targetBlock);
    if (targetBlock === 'security') refreshSecurityStatus();
    const settingsContent = document.querySelector('.settings-content');
    if (settingsContent) settingsContent.scrollTop = 0;
  });
});
securityRefreshBtn?.addEventListener('click', refreshSecurityStatus);
securitySavePasswordBtn?.addEventListener('click', saveSecurityPassword);
phoneSectionTabs.forEach(button => {
  button.addEventListener('click', () => {
    setActivePhonePanel(button.dataset.phonePanelTarget);
  });
});
deviceSearchEl?.addEventListener('input', () => renderPhoneDevices(latestManagedDevices));
deviceFilterEl?.addEventListener('change', () => renderPhoneDevices(latestManagedDevices));
deviceSortEl?.addEventListener('change', () => renderPhoneDevices(latestManagedDevices));
deviceRefreshBtn?.addEventListener('click', () => loadPhoneDevices());
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
  }
});

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
}

async function initialize() {
  setProfileEditorOpen(false);
  initializeCompactSettingsLayout();
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
        chat: { activationShortcut: 'Control+Space', themeId: 'graphite', glassTint: 42, maxHistory: 250 },
        system: { permissionLevel: 'medium' },
        user: { profile: {} },
        modes: []
      },
      availableThemes: []
    };
    updateBranding();
    ensureConversationReady();
    renderActivity();
    setWorkspaceView('chat');
    if (settingsOnly) openSettingsPanel();
    return;
  }
  const snapshot = await window.openx.getSettings();
  applySnapshot(snapshot);
  await refreshActivitySchedulesFromRuntime();
  if (!window.openx) {
    scheduleItems.forEach(item => {
      if (item.status === 'scheduled') armSchedule(item);
    });
  }
  ensureConversationReady();
  renderActivity();
  setWorkspaceView('chat');
  if (settingsOnly) {
    document.title = `${getAssistantDisplayName()} Settings`;
    openSettingsPanel();
  } else {
    inputBox.focus();
  }
}

initialize();
