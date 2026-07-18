const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Chat Renderer UI', function() {
  const rendererRoot = path.join(__dirname, '..', '..', 'apps', 'desktop', 'renderer', 'chat');
  const html = fs.readFileSync(path.join(rendererRoot, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(rendererRoot, 'index.css'), 'utf8');
  const glassCss = fs.readFileSync(path.join(rendererRoot, 'index.css'), 'utf8');
  const script = fs.readFileSync(path.join(rendererRoot, 'index.js'), 'utf8');

  it('should provide dedicated chat, activity, apps, notification, and info surfaces', function() {
    const headerActions = html.match(/<div id="header-actions">([\s\S]*?)<\/div>/)?.[1] || '';
    ['conversation-view', 'people-chat-view', 'activity-view', 'apps-view', 'toast-region', 'schedule-list', 'notification-list', 'people-chat-app-btn', 'calendar-app-btn', 'gallery-app-btn', 'settings-app-btn', 'header-about-btn', 'about-btn']
      .forEach(id => assert.match(html, new RegExp(`id="${id}"`)));
    assert.doesNotMatch(html, /id="alarm-overlay"/);
    assert.doesNotMatch(script, /alarmOverlay|alarm-dismiss-btn|alarm-snooze-btn/);
    assert.match(html, /id="header-about-btn"[\s\S]*id="header-title"/);
    assert.match(headerActions, /id="chat-view-btn"[\s\S]*id="activity-view-btn"[\s\S]*id="apps-view-btn"[\s\S]*id="close-btn"/);
    assert.doesNotMatch(headerActions, /assistant-mute-btn|voice-start-btn/);
    assert.match(html, /class="composer-field"[\s\S]*id="voice-start-btn"[\s\S]*voice-start-symbol[\s\S]*&#10022;[\s\S]*id="input-box"[\s\S]*id="send-btn"/);
    assert.match(html, /class="composer-field"[\s\S]*id="send-btn"[\s\S]*<\/div>[\s\S]*class="composer-mute-btn voice-btn" id="assistant-mute-btn"/);
    assert.doesNotMatch(html, /voice-start-icon|&#127908;/);
    assert.doesNotMatch(html, /id="quick-actions"|class="chip-btn"|Downloads|Volume up|System status|What can you do\?/);
    assert.match(html, /class="icon-btn about-btn settings-about-btn" id="about-btn"[\s\S]*id="settings-close-btn"/);
    assert.match(script, /panelHeader\.insertBefore\(panelActions, settingsCloseBtn\)/);
    assert.match(html, /Alarms & reminders/);
    assert.doesNotMatch(html, /Upcoming alarms, timers, reminders, and recent assistant notices\./);
    assert.match(script, /runHeaderApp\(calendarAppBtn, \(\) => window\.openx\?\.openPlanner\?\.\('calendar'\)\)/);
    assert.match(script, /runHeaderApp\(galleryAppBtn, \(\) => window\.openx\?\.openGallery\?\.\('timeline'\)\)/);
    assert.doesNotMatch(script, /ACTIVITY_SCHEDULE_WINDOW_MS/);
    assert.doesNotMatch(script, /ACTIVITY_RECURRING_WINDOW_MS/);
    assert.match(script, /function isSameLocalDay\(value, reference = Date\.now\(\)\)/);
    assert.match(script, /function isActivityScheduleKind\(item = \{\}\)/);
    assert.match(script, /function isActivityScheduleVisible\(item, now = Date\.now\(\)\)/);
    assert.match(script, /window\.openx\?\.getScheduleSnapshot/);
    assert.match(script, /window\.openx\.onScheduleChanged/);
    assert.match(script, /function replaceScheduleItemsFromRuntime\(items = \[\]\)/);
    assert.match(script, /const aboutButtons = Array\.from\(document\.querySelectorAll\('\[data-about-trigger\]'\)\)/);
    assert.match(css, /#header-left/);
    assert.match(css, /\.header-about-btn/);
    assert.match(css, /\.composer-voice-btn/);
    assert.match(css, /\.composer-mute-btn/);
    assert.match(css, /\.voice-start-ring/);
    assert.match(css, /\.voice-start-symbol/);
    assert.match(css, /#send-btn\s*\{[\s\S]*border-radius:\s*50%/);
    assert.match(css, /#send-btn span\s*\{[\s\S]*display:\s*none/);
    assert.match(css, /\.app-card/);
    assert.match(css, /\.settings-header-actions/);
  });

  it('should expose OpenX Chat as an Apps surface with a WhatsApp-style local chat layout', function() {
    assert.match(html, /id="people-chat-app-btn"[\s\S]*<strong>Chat<\/strong>[\s\S]*Messages with people/);
    assert.match(html, /id="people-chat-view"[\s\S]*id="people-chat-list"[\s\S]*id="people-chat-thread"[\s\S]*id="people-chat-composer"/);
    assert.match(html, /class="people-chat-shell list-open"/);
    assert.match(html, /id="people-chat-close-btn"/);
    assert.match(html, /id="people-chat-back-btn"[\s\S]*&lt;/);
    assert.match(html, /id="people-chat-add-user"[\s\S]*id="people-chat-user-name"[\s\S]*id="people-chat-user-id"/);
    assert.doesNotMatch(html, /aria-label="Search in chat"|aria-label="More options"/);
    assert.match(script, /const peopleChatAppBtn = document\.getElementById\('people-chat-app-btn'\)/);
    assert.match(script, /const peopleChatCloseBtn = document\.getElementById\('people-chat-close-btn'\)/);
    assert.match(script, /const peopleChatBackBtn = document\.getElementById\('people-chat-back-btn'\)/);
    assert.match(script, /const peopleChatUserNameEl = document\.getElementById\('people-chat-user-name'\)/);
    assert.match(script, /const peopleChatUserIdEl = document\.getElementById\('people-chat-user-id'\)/);
    assert.match(script, /setWorkspaceView\('people-chat'\)/);
    assert.match(script, /function returnPeopleChatToList\(/);
    assert.match(script, /function closePeopleChatApp\(/);
    assert.match(script, /function openPeopleChatAddUser\(/);
    assert.match(script, /peerHandle/);
    assert.match(script, /window\.openx\?\.listDesktopChatConversations/);
    assert.match(script, /window\.openx\?\.openDesktopChatConversation/);
    assert.match(script, /window\.openx\?\.createDesktopChatConversation/);
    assert.match(script, /window\.openx\?\.sendDesktopChatMessage/);
    assert.match(script, /function renderPeopleChatList\(/);
    assert.match(script, /function renderPeopleChatThread\(/);
    assert.match(script, /function sendPeopleChatMessage\(/);
    assert.doesNotMatch(script, /runHeaderApp\(peopleChatAppBtn/);
    assert.match(css, /\.people-chat-shell\s*\{/);
    assert.match(css, /grid-template-columns:\s*1fr/);
    assert.match(css, /\.people-chat-shell\.thread-open \.people-chat-sidebar/);
    assert.match(css, /\.people-chat-thread-pane\s*\{[\s\S]*display:\s*none/);
    assert.match(css, /\.people-chat-add-user\s*\{/);
    assert.match(css, /\.people-chat-row\s*\{/);
    assert.match(css, /\.people-chat-message\.outgoing/);
    assert.match(css, /\.people-chat-composer\s*\{/);
  });

  it('should keep assistant messages inside their bubbles at narrow widths', function() {
    assert.match(css, /\.message-bubble\s*\{[^}]*overflow-wrap:\s*anywhere;/s);
    assert.match(css, /\.message-stack\s*\{[^}]*min-width:\s*0;/s);
    assert.match(css, /@media\s*\(max-width:\s*460px\)/);
  });

  it('should render clarification choices as selectable chat cards', function() {
    assert.match(script, /className = 'message-choices'/);
    assert.match(script, /sendCommand\(String\(choiceIndex\)\)/);
    assert.match(css, /\.message-choice\s*\{/);
    assert.match(css, /\.message-choice-copy\s*\{/);
  });

  it('should render local file and folder results as dedicated cards', function() {
    assert.match(script, /function normalizeResultEntries\(result\)/);
    assert.match(script, /function addResultCards\(bubble, resultEntries\)/);
    assert.match(script, /className = 'message-result-list'/);
    assert.match(script, /resultEntries: normalizeResultEntries\(result\)/);
    assert.match(css, /\.message-result\s*\{/);
    assert.match(css, /\.message-result-icon\s*\{/);
    assert.match(css, /\.message-result-path\s*\{/);
  });

  it('should render visual memory results as a horizontal photo strip', function() {
    assert.match(html, /img-src 'self' file: data:/);
    assert.match(script, /const visualResults = Array\.isArray\(result\?\.data\?\.visualResults\)/);
    assert.match(script, /MAX_CHAT_VISUAL_RESULTS\s*=\s*10/);
    assert.match(script, /visualResults\.slice\(0, MAX_CHAT_VISUAL_RESULTS\)/);
    assert.match(script, /message-bubble--visual-results/);
    assert.match(script, /type: 'photo'/);
    assert.match(script, /function addVisualResultCards\(bubble, resultEntries\)/);
    assert.match(script, /className = 'visual-result-strip'/);
    assert.match(script, /className = 'visual-result-card'/);
    assert.match(script, /window\.openx\?\.getGalleryImageData\?\.\(photoId\)/);
    assert.match(script, /function openChatImagePreview\(entry\)/);
    assert.match(script, /card\.addEventListener\('click', \(\) => openChatImagePreview\(entry\)\)/);
    assert.match(script, /window\.openx\?\.showGalleryPhoto\?\.\(photoId\)/);
    assert.match(css, /\.visual-result-strip\s*\{/);
    assert.match(css, /overflow-x:\s*auto/);
    assert.match(css, /\.message\.assistant \.message-bubble--visual-results\s*\{/);
    assert.match(css, /\.message-bubble--visual-results \.visual-result-strip\s*\{/);
    assert.match(css, /\.visual-result-strip::-webkit-scrollbar\s*\{[\s\S]*display:\s*block/);
    assert.match(css, /\.visual-result-strip::-webkit-scrollbar-thumb\s*\{/);
    assert.match(css, /\.visual-result-card\s*\{/);
    assert.match(css, /scroll-snap-align:\s*start/);
    assert.match(css, /#chat-image-preview-overlay/);
    assert.match(css, /\.chat-image-preview-close/);
    assert.match(css, /\.chat-image-preview-primary/);
  });

  it('should render web search sources as result cards', function() {
    assert.match(script, /intent === 'browser\.search'/);
    assert.match(script, /result\?\.data\?\.searchSummary\?\.sources/);
    assert.match(script, /type: 'web'/);
    assert.match(script, /entry\.type === 'web' \? 'Web'/);
    assert.match(css, /\.message-result\.web-result \.message-result-icon/);
  });

  it('should display category-specific reminder symbols', function() {
    assert.match(script, /education: \{ color: '[^']+', symbol: '🎓'/);
    assert.match(script, /water: \{ color: '[^']+', symbol: '💧'/);
    assert.match(script, /exercise: \{ color: '[^']+', symbol: '🏃'/);
    assert.match(script, /inferReminderCategory\(message, category\)/);
  });

  it('should render and persist alarms, reminders, and notifications', function() {
    assert.match(script, /function addScheduleFromResult\(/);
    assert.match(script, /function triggerSchedule\(/);
    assert.match(script, /function showToast\(/);
    assert.match(script, /SCHEDULE_STORAGE_KEY/);
    assert.match(script, /NOTIFICATION_STORAGE_KEY/);
    assert.match(script, /handleScheduleAlert/);
    assert.doesNotMatch(html, /id="alarm-symbol"/);
    assert.doesNotMatch(script, /function playScheduleSound\(kind\)/);
    assert.doesNotMatch(script, /function stopScheduleSound\(\)/);
    assert.doesNotMatch(glassCss, /Dedicated timer and reminder alert/);
  });

  it('should keep recurring scheduler reminders synced into Activity', function() {
    assert.match(script, /recurrence: entry\.recurrence \|\| ''/);
    assert.match(script, /function isActivityScheduleKind\(item = \{\}\)/);
    assert.match(script, /return kind === 'alarm' \|\| kind === 'reminder'/);
    assert.match(script, /return isSameLocalDay\(item\.dueAt, now\)/);
    assert.match(script, /repeats \$\{recurrence\.replace/);
    assert.match(script, /replaceScheduleItemsFromRuntime\(payload\?\.snapshot\?\.entries \|\| payload\?\.entries \|\| \[\]\)/);
  });

  it('should provide a dedicated assistant-only voice mute control', function() {
    assert.match(html, /id="assistant-mute-btn"/);
    assert.match(script, /ASSISTANT_MUTED_STORAGE_KEY/);
    assert.match(script, /window\.openx\?\.stopSpeaking/);
    assert.match(script, /if \(!isAssistantMuted && spokenText/);
  });

  it('should keep settings compact without contact-storage controls', function() {
    assert.doesNotMatch(html, /id="minimize-btn"/);
    assert.doesNotMatch(html, /data-section-target="contacts"/);
    assert.match(script, /initializeCompactSettingsLayout/);
    assert.doesNotMatch(html, /settings-section-contacts|contact-save-btn|contact-delete-btn/);
    assert.doesNotMatch(script, /saveContact|deleteContact|renderContacts/);
    assert.match(glassCss, /Compact in-window settings/);
    assert.match(glassCss, /#settings-overlay\.open/);
  });

  it('should expose adaptive glass and horizontal mode controls', function() {
    assert.match(html, /id="glass-tint"/);
    assert.doesNotMatch(script, /securitySettingsUnlocked/);
    assert.match(script, /function applyGlassTint/);
    assert.match(script, /mode-tabs/);
    assert.match(script, /mode-app-tabs/);
    assert.match(glassCss, /Adaptive glass themes and controls/);
    assert.match(script, /glassContrast/);
    assert.match(script, /const shellAlpha = useDarkText \? 0\.78 \+ \(strength \* 0\.14\) : 0\.72 \+ \(strength \* 0\.2\)/);
    assert.match(script, /formatAlpha\(shellAlpha\)/);
    assert.match(glassCss, /Tint-aware foreground contrast/);
  });

  it('should expose OpenX-lock-protected cloud mobile pairing controls', function() {
    assert.match(html, /data-section-target="phone"/);
    assert.match(html, /data-phone-panel-target="connect"/);
    assert.match(html, /data-phone-panel-target="devices"/);
    assert.match(html, /data-phone-panel="connect"/);
    assert.match(html, /data-phone-panel="devices"/);
    assert.match(html, /id="cloud-generate-qr-btn"/);
    assert.match(html, /id="security-unlock-dialog"/);
    assert.match(html, /id="security-unlock-password"/);
    assert.doesNotMatch(html, /id="cloud-pairing-password"/);
    assert.match(html, /id="cloud-pairing-qr"/);
    assert.match(script, /requestSecurityPasswordForPairing/);
    assert.match(script, /openSecurityUnlockDialog/);
    assert.match(script, /closeSecurityUnlockDialog/);
    assert.match(script, /window\.openx\.generateCloudPairingQR\(unlock\.password\)/);
    assert.doesNotMatch(script, /window\.prompt/);
    assert.match(script, /Waiting for OpenX security unlock/);
    assert.match(script, /Generate New QR/);
    assert.match(script, /function formatPairingCountdown\(/);
    assert.match(script, /Expires in \$\{formatPairingCountdown\(remaining\)\}/);
    assert.match(script, /setInterval\(update, 1000\)/);
    assert.match(script, /Cloud pairing QR expired\./);
    assert.match(script, /function setActivePhonePanel/);
    assert.match(script, /phoneSectionTabs\.forEach/);
    assert.match(css, /\.phone-section-tabs/);
    assert.match(css, /\.phone-panel\.active/);
    assert.doesNotMatch(html, /Local QR|Local Details|data-phone-connect-mode/);
    assert.doesNotMatch(script, /generatePairingQR|getPhoneServerStatus|loadPhoneServerStatus/);
  });

  it('should not expose chat-provider communication connection controls', function() {
    assert.doesNotMatch(html, /data-section-target="communication"/);
    assert.doesNotMatch(html, /id="settings-section-communication"/);
    assert.doesNotMatch(script, /loadCommunicationStatus/);
    assert.doesNotMatch(script, /connectCommunicationProvider/);
    assert.doesNotMatch(script, /disconnectCommunicationProvider/);
  });

  it('should group identity, theme, and security under System while keeping Phone separate', function() {
    assert.match(html, /data-section-target="system"/);
    assert.match(html, /id="system-options"/);
    assert.match(html, /data-system-block-target="identity"/);
    assert.match(html, /data-system-block-target="theme"/);
    assert.match(html, /data-system-block-target="security"/);
    assert.match(html, /data-system-block-target="storage"/);
    assert.doesNotMatch(html, /data-section-target="identity"/);
    assert.doesNotMatch(html, /data-section-target="theme"/);
    assert.doesNotMatch(html, /data-section-target="access"/);
    assert.match(html, /id="settings-section-identity"[^>]*data-settings-section="system"|data-settings-section="system"[^>]*id="settings-section-identity"/);
    assert.match(html, /id="settings-section-theme"[^>]*data-settings-section="system"|data-settings-section="system"[^>]*id="settings-section-theme"/);
    assert.match(html, /id="settings-section-security"/);
    assert.match(html, /id="settings-section-storage"/);
    assert.match(html, /data-system-block="identity"/);
    assert.match(html, /data-system-block="theme"/);
    assert.match(html, /data-system-block="security"/);
    assert.match(html, /data-system-block="storage"/);
    assert.match(html, /id="security-new-password"/);
    assert.match(html, /id="clear-chat-history-btn"/);
    assert.match(script, /function saveSecurityPassword/);
    assert.match(script, /setSecurityPassword/);
    assert.match(script, /function clearConversationHistory/);
    assert.match(script, /clearChatHistory/);
    assert.match(html, /id="settings-section-phone"[^>]*data-settings-section="phone"|data-settings-section="phone"[^>]*id="settings-section-phone"/);
    assert.doesNotMatch(html, /id="assistant-title"|Assistant Title/);
    assert.doesNotMatch(html, /id="assistant-activation-shortcut"|Chat Shortcut|Alt\+Space to show/);
    assert.match(script, /setActiveSettingsSection\(activeSettingsSection \|\| 'system'\)/);
    assert.match(script, /function setActiveSystemBlock/);
    assert.match(script, /activeSettingsSection !== 'system' \|\| section\.dataset\.systemBlock === activeSystemBlock/);
    assert.doesNotMatch(script, /getActivationShortcut|assistantActivationShortcut/);
  });

  it('should store chat history through OpenX_Data-backed IPC instead of renderer-only localStorage', function() {
    assert.match(script, /window\.openx\?\.getChatHistory/);
    assert.match(script, /window\.openx\.saveChatHistory/);
    assert.match(script, /window\.openx\.clearChatHistory/);
    assert.match(script, /localStorage\.removeItem\(CHAT_HISTORY_STORAGE_KEY\)/);
    assert.match(script, /await window\.openx\.getChatHistory\(\)/);
    assert.match(html, /Chat History/);
    assert.match(css, /\.storage-action-card/);
  });

  it('should store chat UI state through OpenX_Data-backed IPC', function() {
    assert.match(script, /window\.openx\?\.getUiState/);
    assert.match(script, /window\.openx\.saveUiState/);
    assert.match(script, /function loadUiState/);
    assert.match(script, /clearLegacyUiStateStorage/);
    assert.match(script, /await loadUiState\(\)/);
    assert.doesNotMatch(script, /let isAssistantMuted = localStorage\.getItem/);
    assert.doesNotMatch(script, /localStorage\.setItem\(ASSISTANT_MUTED_STORAGE_KEY/);
  });

  it('should show profile details as read-only rows before opening the editor', function() {
    assert.match(html, /id="settings-section-profile"/);
    assert.match(html, /id="profile-edit-btn"/);
    assert.match(html, /id="profile-summary-list"/);
    assert.match(html, /class="profile-editor" id="profile-editor" aria-hidden="true"/);
    assert.match(script, /PROFILE_SUMMARY_FIELDS/);
    assert.match(script, /function renderProfileSummary/);
    assert.match(script, /function setProfileEditorOpen/);
    assert.match(script, /profileEditBtn\?\.addEventListener\('click'/);
    assert.match(css, /\.profile-summary-row/);
    assert.match(css, /\.profile-summary-list\s*\{[^}]*overflow-y:\s*auto;/s);
    assert.match(css, /\.profile-editor\.open/);
    assert.match(css, /\.profile-editor\.open\s*\{[^}]*overflow-y:\s*auto;/s);
  });

  it('should render compact trusted device cards and device actions', function() {
    assert.match(html, /id="phone-device-list"/);
    assert.match(html, /<button class="phone-section-tab"[^>]*>Connected Devices<\/button>[\s\S]*<div class="phone-panel" data-phone-panel="devices" hidden>/);
    assert.match(script, /phone-device-status-dot/);
    assert.match(script, /phone-device-essentials/);
    assert.match(script, /getDeviceBoxCode/);
    assert.match(script, /phone-device-box-code/);
    assert.match(script, /phone-device-box-list/);
    assert.match(script, /Status/);
    assert.match(script, /Trust/);
    assert.match(script, /Version/);
    assert.match(script, /Last seen/);
    assert.doesNotMatch(script, /Assistant Access|File Transfer|Receive Files|Send Files|Desktop Control|Clipboard|Future Screen Sharing|Future Camera|Future Microphone/);
    assert.doesNotMatch(script, /Save Permissions|updatePhonePermissions/);
    assert.match(script, /Remove/);
    assert.doesNotMatch(script, /disconnectPhoneDevice/);
    assert.doesNotMatch(script, /Rename/);
    assert.match(script, /Trust/);
    assert.doesNotMatch(script, /renamePhoneDevice/);
    assert.doesNotMatch(script, /updatePhoneTrust/);
    assert.doesNotMatch(html, /All devices|<option value="status">Status<\/option>/);
    assert.doesNotMatch(script, /device-meta-item|device-type-icon|permissionSummary|\['Type'|\['Platform'/);
    assert.match(html, /id="phone-device-remove-dialog"/);
    assert.match(script, /openPhoneDeviceRemoveDialog/);
    assert.match(script, /confirmPhoneDeviceRemoval/);
    assert.doesNotMatch(script, /window\.confirm\(/);
  });

  it('should render relay server version separately from the local app version', function() {
    assert.match(html, /Server Version/);
    assert.match(script, /cloudVersionEl\.textContent = safeStatus\.serverVersion \|\| '--'/);
    assert.doesNotMatch(script, /\[safeStatus\.version,\s*safeStatus\.serverVersion/);
  });

  it('should bound long-session rendering and coalesce glass tint updates', function() {
    assert.match(script, /CHAT_HISTORY_LIMIT\s*=\s*100/);
    assert.match(script, /MAX_RENDERED_MESSAGES\s*=\s*CHAT_HISTORY_LIMIT/);
    assert.match(script, /renderedMessages\[index\]\.remove\(\)/);
    assert.match(script, /function scheduleGlassTintUpdate\(/);
    assert.match(script, /requestAnimationFrame\(/);
    assert.match(glassCss, /GPU and long-session performance/);
    assert.match(glassCss, /content-visibility:\s*auto/);
  });
});
