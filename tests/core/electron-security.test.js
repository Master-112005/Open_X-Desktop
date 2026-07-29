const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const {
  IPC_VALIDATORS,
  assertTrustedIpcSender,
  createSecureWebPreferences,
  isTrustedRendererUrl
} = require('../../apps/desktop/electron/security');

describe('Electron Security Boundary', function() {
  const rendererRoot = path.resolve(__dirname, '..', '..', 'apps', 'desktop', 'renderer');
  const chatFile = path.join(rendererRoot, 'chat', 'index.html');
  const mainScript = fs.readFileSync(path.join(__dirname, '..', '..', 'apps', 'desktop', 'electron', 'main.js'), 'utf8');

  it('should accept only local files inside the renderer root', function() {
    assert.equal(isTrustedRendererUrl(pathToFileURL(chatFile).href, rendererRoot), true);
    assert.equal(isTrustedRendererUrl('https://example.com/', rendererRoot), false);
    assert.equal(isTrustedRendererUrl(pathToFileURL(path.join(rendererRoot, '..', 'preload', 'index.js')).href, rendererRoot), false);
    assert.equal(isTrustedRendererUrl('not a url', rendererRoot), false);
  });

  it('should validate the sender frame before allowing IPC', function() {
    const trustedEvent = { senderFrame: { url: pathToFileURL(chatFile).href } };
    const untrustedEvent = { senderFrame: { url: 'https://example.com/' } };

    assert.equal(assertTrustedIpcSender(trustedEvent, rendererRoot), trustedEvent.senderFrame.url);
    assert.throws(() => assertTrustedIpcSender(untrustedEvent, rendererRoot), /trusted local renderer/);
  });

  it('should expose hardened BrowserWindow preferences', function() {
    const preferences = createSecureWebPreferences('C:\\app\\preload.js');

    assert.equal(preferences.nodeIntegration, false);
    assert.equal(preferences.nodeIntegrationInWorker, false);
    assert.equal(preferences.nodeIntegrationInSubFrames, false);
    assert.equal(preferences.contextIsolation, true);
    assert.equal(preferences.sandbox, true);
    assert.equal(preferences.webSecurity, true);
    assert.equal(preferences.backgroundThrottling, false);
    assert.equal(preferences.allowRunningInsecureContent, false);
    assert.equal(preferences.enableRemoteModule, false);
    assert.equal(preferences.safeDialogs, true);
    assert.equal(preferences.navigateOnDragDrop, false);
    assert.equal(preferences.webviewTag, false);
    assert.equal(Object.isFrozen(preferences), true);
  });

  it('should normalize valid command payloads and reject malformed ones', function() {
    assert.deepEqual(
      IPC_VALIDATORS['command:process']({ input: '  open chrome  ', source: 'chat' }),
      { input: 'open chrome', source: 'chat' }
    );
    assert.throws(() => IPC_VALIDATORS['command:process']({ input: '', source: 'chat' }), /must not be empty/);
    assert.throws(() => IPC_VALIDATORS['command:process']({ input: 'hello', source: 'web' }), /not supported/);
    assert.throws(() => IPC_VALIDATORS['command:process']({ input: 'x'.repeat(5001) }), /exceeds/);
    assert.throws(() => IPC_VALIDATORS['command:process']({ input: 'open\u0000chrome', source: 'chat' }), /unsafe control/);
    assert.throws(() => IPC_VALIDATORS['command:process']({ input: 'open\u202Echrome', source: 'chat' }), /unsafe directional/);
  });

  it('should reject dangerous or oversized structured IPC payloads', function() {
    const polluted = JSON.parse('{"__proto__":{"isAdmin":true}}');

    assert.throws(() => IPC_VALIDATORS['settings:save'](polluted), /forbidden field/);
    assert.throws(() => IPC_VALIDATORS['settings:save']({ value: Number.POSITIVE_INFINITY }), /invalid number/);
    assert.throws(
      () => IPC_VALIDATORS['settings:save']({ value: 'x'.repeat(256 * 1024) }),
      /exceeds/
    );
    assert.throws(() => IPC_VALIDATORS['settings:get']({}), /does not accept/);
    assert.throws(() => IPC_VALIDATORS['security:verifyAccess']({}), /password must be a string/);
  });

  it('should validate disk-backed assistant chat history IPC payloads', function() {
    assert.deepEqual(
      IPC_VALIDATORS['assistantChatHistory:save']({
        entries: [
          { type: 'user', text: ' hello ', meta: 'You - now', createdAt: 123 },
          { type: 'assistant', text: 'Ready', meta: '', createdAt: 124 },
          { type: 'assistant', text: 'Missing meta is valid', createdAt: 125 }
        ]
      }),
      {
        entries: [
          { type: 'user', text: 'hello', meta: 'You - now', createdAt: 123 },
          { type: 'assistant', text: 'Ready', meta: '', createdAt: 124 },
          { type: 'assistant', text: 'Missing meta is valid', meta: '', createdAt: 125 }
        ]
      }
    );
    assert.deepEqual(
      IPC_VALIDATORS['assistantChatHistory:saveSync']({
        entries: [{ type: 'user', text: ' Persist now ', meta: '', createdAt: 126 }]
      }),
      { entries: [{ type: 'user', text: 'Persist now', meta: '', createdAt: 126 }] }
    );
    assert.throws(() => IPC_VALIDATORS['assistantChatHistory:save']({ entries: [{ type: 'bad', text: 'No' }] }), /entry type/);
    assert.equal(
      IPC_VALIDATORS['assistantChatHistory:save']({ entries: new Array(300).fill({ type: 'user', text: 'x' }) }).entries.length,
      300
    );
    assert.throws(() => IPC_VALIDATORS['assistantChatHistory:save']({ entries: new Array(301).fill({ type: 'user', text: 'x' }) }), /too many/);
    assert.throws(() => IPC_VALIDATORS['assistantChatHistory:get']({}), /does not accept/);
    assert.throws(() => IPC_VALIDATORS['assistantChatHistory:getSync']({}), /does not accept/);
    assert.throws(() => IPC_VALIDATORS['assistantChatHistory:clear']({}), /does not accept/);
  });

  it('should validate desktop chat conversation IPC payloads', function() {
    const conversationId = `conv_${'a'.repeat(64)}`;
    assert.deepEqual(
      IPC_VALIDATORS['desktopChat:list']({ query: '  mummy ', limit: 120 }),
      { query: 'mummy', limit: 50 }
    );
    assert.deepEqual(
      IPC_VALIDATORS['desktopChat:open']({ conversationId }),
      { conversationId }
    );
    assert.deepEqual(
      IPC_VALIDATORS['desktopChat:create']({ title: ' Family ' }),
      { title: 'Family', peerName: 'Family', peerHandle: '', peerType: 'openx' }
    );
    assert.deepEqual(
      IPC_VALIDATORS['desktopChat:create']({ peerName: ' Mummy ', peerHandle: ' mummy_user ', peerType: 'username' }),
      { title: 'Mummy', peerName: 'Mummy', peerHandle: 'mummy_user', peerType: 'username' }
    );
    assert.deepEqual(
      IPC_VALIDATORS['desktopChat:send']({ conversationId, text: ' hello ' }),
      { conversationId, text: 'hello' }
    );
    assert.deepEqual(
      IPC_VALIDATORS['desktopChat:quickReply']({ conversationId, text: ' OK ' }),
      { conversationId, text: 'OK' }
    );
    assert.deepEqual(
      IPC_VALIDATORS['desktopChat:update']({ conversationId, title: ' Daddy ', peerHandle: ' dad@openx ' }),
      { conversationId, title: 'Daddy', peerName: 'Daddy', peerHandle: 'dad@openx', peerType: 'openx' }
    );
    assert.deepEqual(
      IPC_VALIDATORS['desktopChat:delete']({ conversationId }),
      { conversationId }
    );
    assert.deepEqual(
      IPC_VALIDATORS['desktopChat:contacts:list'](),
      undefined
    );
    assert.deepEqual(
      IPC_VALIDATORS['desktopChat:contacts:accept']({ requestId: `creq_${'b'.repeat(64)}`, peerName: ' Friend ', peerHandle: ' +1 555 0101 ' }),
      { requestId: `creq_${'b'.repeat(64)}`, peerName: 'Friend', peerHandle: '+1 555 0101' }
    );
    assert.deepEqual(
      IPC_VALIDATORS['desktopChat:contacts:cancel']({ requestId: `creq_${'c'.repeat(64)}`, reason: ' no longer needed ' }),
      { requestId: `creq_${'c'.repeat(64)}`, reason: 'no longer needed' }
    );
    assert.deepEqual(
      IPC_VALIDATORS['desktopChat:registration:get'](),
      undefined
    );
    assert.deepEqual(
      IPC_VALIDATORS['desktopChat:registration:start']({
        username: ' Mummy.User ',
        password: 'StrongPass1!',
        apiBaseUrl: ' http://localhost:8090/ ',
        pin: ' 2468 '
      }),
      { username: 'Mummy.User', password: 'StrongPass1!', apiBaseUrl: 'http://localhost:8090', pin: '2468' }
    );
    assert.deepEqual(
      IPC_VALIDATORS['desktopChat:profile:password']({
        currentPassword: 'StrongPass1!',
        newPassword: 'NewStrong1!'
      }),
      { currentPassword: 'StrongPass1!', newPassword: 'NewStrong1!' }
    );
    assert.deepEqual(
      IPC_VALIDATORS['desktopChat:uiState']({
        visible: true,
        threadOpen: true,
        activeConversationId: conversationId
      }),
      { visible: true, threadOpen: true, activeConversationId: conversationId }
    );
    assert.throws(() => IPC_VALIDATORS['desktopChat:open']({ conversationId: 'bad' }), /conversationId is invalid/);
    assert.throws(() => IPC_VALIDATORS['desktopChat:send']({ conversationId, text: '' }), /must not be empty/);
    assert.throws(() => IPC_VALIDATORS['desktopChat:quickReply']({ conversationId: 'bad', text: 'OK' }), /conversationId is invalid/);
    assert.throws(() => IPC_VALIDATORS['desktopChat:quickReply']({ conversationId, text: 'x'.repeat(121) }), /exceeds/);
    assert.throws(() => IPC_VALIDATORS['desktopChat:update']({ conversationId, title: '', peerHandle: 'dad@openx' }), /must not be empty/);
    assert.throws(() => IPC_VALIDATORS['desktopChat:update']({ conversationId, title: 'Dad', peerHandle: '' }), /must not be empty/);
    assert.throws(() => IPC_VALIDATORS['desktopChat:delete']({ conversationId: 'bad' }), /conversationId is invalid/);
    assert.throws(() => IPC_VALIDATORS['desktopChat:create']({ title: 'x'.repeat(81) }), /exceeds/);
    assert.throws(() => IPC_VALIDATORS['desktopChat:create']({ peerName: 'Mummy', peerHandle: 'x'.repeat(121) }), /exceeds/);
    assert.throws(() => IPC_VALIDATORS['desktopChat:contacts:accept']({ requestId: 'bad' }), /requestId is invalid/);
    assert.throws(() => IPC_VALIDATORS['desktopChat:registration:start']({ username: '', password: 'StrongPass1!' }), /must not be empty/);
    assert.throws(() => IPC_VALIDATORS['desktopChat:registration:start']({ username: 'mummy', password: '' }), /10-128/);
    assert.throws(() => IPC_VALIDATORS['desktopChat:registration:start']({ username: 'mummy', password: 'StrongPass1!', apiBaseUrl: 'file:///tmp/chat' }), /protocol is not supported/);
    assert.throws(() => IPC_VALIDATORS['desktopChat:registration:start']({ username: 'bad user', password: 'StrongPass1!' }), /3-32/);
    assert.throws(() => IPC_VALIDATORS['desktopChat:profile:password']({ currentPassword: 'short', newPassword: 'NewStrong1!' }), /10-128/);
    assert.throws(() => IPC_VALIDATORS['desktopChat:uiState']({ visible: true, activeConversationId: 'bad' }), /conversationId is invalid/);
  });

  it('should validate disk-backed renderer UI state IPC payloads', function() {
    assert.deepEqual(
      IPC_VALIDATORS['uiState:save']({
        assistantMuted: true,
        schedules: [{
          id: 'reminder-1',
          kind: 'Reminder',
          message: 'Drink water',
          category: 'water',
          symbol: '',
          dueAt: '2026-07-16T10:00:00.000Z',
          recurrence: '',
          status: 'scheduled',
          createdAt: '2026-07-16T09:00:00.000Z',
          source: 'scheduler'
        }],
        notifications: [{
          id: 'notice-1',
          title: 'Reminder scheduled',
          message: 'Drink water',
          tone: 'reminder',
          createdAt: '2026-07-16T09:00:00.000Z'
        }]
      }),
      {
        assistantMuted: true,
        schedules: [{
          id: 'reminder-1',
          kind: 'Reminder',
          message: 'Drink water',
          category: 'water',
          symbol: null,
          dueAt: '2026-07-16T10:00:00.000Z',
          recurrence: '',
          status: 'scheduled',
          createdAt: '2026-07-16T09:00:00.000Z',
          source: 'scheduler'
        }],
        notifications: [{
          id: 'notice-1',
          title: 'Reminder scheduled',
          message: 'Drink water',
          tone: 'reminder',
          createdAt: '2026-07-16T09:00:00.000Z'
        }]
      }
    );
    assert.throws(() => IPC_VALIDATORS['uiState:save']({ schedules: new Array(81).fill({ id: 'x', dueAt: 'now' }) }), /too many/);
    assert.throws(() => IPC_VALIDATORS['uiState:get']({}), /does not accept/);
  });

  it('should validate cloud device mutations', function() {
    assert.deepEqual(
      IPC_VALIDATORS['cloud:device:rename']({ deviceId: 'phone001', deviceName: '  Rakesh   Phone  ' }),
      { deviceId: 'phone001', deviceName: 'Rakesh Phone' }
    );
    assert.throws(
      () => IPC_VALIDATORS['cloud:device:remove']({ deviceId: '..\\bad' }),
      /deviceId is invalid/
    );
  });

  it('should validate cloud pairing approval payloads', function() {
    assert.deepEqual(
      IPC_VALIDATORS['cloud:pairing:approve']({ pairRequestId: 'pair_001' }),
      { pairRequestId: 'pair_001' }
    );
    assert.throws(
      () => IPC_VALIDATORS['cloud:pairing:reject']({ pairRequestId: '../bad' }),
      /pairRequestId is invalid/
    );
  });

  it('should validate planner IPC payloads', function() {
    assert.deepEqual(
      IPC_VALIDATORS['window:openPlanner']({ view: 'timetable' }),
      { view: 'timetable' }
    );
    assert.deepEqual(
      IPC_VALIDATORS['planner:addEntry']({ type: 'calendar', title: 'Review', date: '2026-06-29', startTime: '09:30' }),
      { type: 'calendar', title: 'Review', date: '2026-06-29', startTime: '09:30' }
    );
    assert.throws(() => IPC_VALIDATORS['window:openPlanner']({ view: 'settings' }), /planner view/);
    assert.throws(() => IPC_VALIDATORS['planner:addEntry']({ type: 'email', title: 'Bad' }), /planner entry type/);
    assert.throws(() => IPC_VALIDATORS['planner:addEntry']({ type: 'calendar', title: 'Bad', date: '06/29/2026' }), /YYYY-MM-DD/);
    assert.throws(() => IPC_VALIDATORS['planner:addEntry']({ type: 'calendar', title: 'Bad', startTime: '9:30' }), /HH:MM/);
  });

  it('should validate Dynamic Island collapse payloads', function() {
    assert.deepEqual(
      IPC_VALIDATORS['voiceOverlay:collapse']({ statusText: ' Snoozed ', icon: 'ok', hideAfterMs: 5000 }),
      { statusText: 'Snoozed', icon: 'ok', hideAfterMs: 5000 }
    );
    assert.deepEqual(
      IPC_VALIDATORS['voiceOverlay:collapse']({ presentationClass: 'schedule-live-compact' }),
      { presentationClass: 'schedule-live-compact' }
    );
    assert.deepEqual(IPC_VALIDATORS['voiceOverlay:collapse'](), {});
    assert.throws(
      () => IPC_VALIDATORS['voiceOverlay:collapse']({ statusText: 'x'.repeat(81) }),
      /exceeds/
    );
  });

  it('should validate external browser URLs for Dynamic Island result links', function() {
    assert.deepEqual(
      IPC_VALIDATORS['browser:openExternal']({ url: ' https://example.com/path?q=openx ' }),
      { url: 'https://example.com/path?q=openx' }
    );
    assert.throws(
      () => IPC_VALIDATORS['browser:openExternal']({ url: 'file:///C:/secret.txt' }),
      /protocol is not supported/
    );
    assert.throws(
      () => IPC_VALIDATORS['browser:openExternal']({ url: 'javascript:alert(1)' }),
      /protocol is not supported/
    );
  });

  it('should normalize Dynamic Island end actions as stop actions', function() {
    assert.deepEqual(
      IPC_VALIDATORS['schedule:alertAction']({ id: 'reminder-1', action: 'end', minutes: 5 }),
      { id: 'reminder-1', action: 'stop', minutes: 5 }
    );
    assert.deepEqual(
      IPC_VALIDATORS['schedule:alertAction']({ id: 'reminder-1', action: 'remove', minutes: 5 }),
      { id: 'reminder-1', action: 'remove', minutes: 5 }
    );
  });

  it('should validate Dynamic Island file transfer actions', function() {
    assert.deepEqual(
      IPC_VALIDATORS['cloud:fileTransferAction']({ transferId: 'cloud_mobile_transfer_abc-123', action: 'accept' }),
      { transferId: 'cloud_mobile_transfer_abc-123', action: 'accept' }
    );
    assert.throws(
      () => IPC_VALIDATORS['cloud:fileTransferAction']({ transferId: '..\\bad', action: 'accept' }),
      /transferId is invalid/
    );
    assert.throws(
      () => IPC_VALIDATORS['cloud:fileTransferAction']({ transferId: 'cloud_1', action: 'delete' }),
      /file transfer action is not supported/
    );
  });

  it('should validate app-specific remote control actions', function() {
    assert.deepEqual(
      IPC_VALIDATORS['remote:control']({
        targetId: 'youtube',
        action: 'next',
        tabTitle: 'Music - YouTube',
        targetHandle: 123,
        targetProcessId: 456,
        processName: 'chrome'
      }),
      {
        targetId: 'youtube',
        action: 'next',
        tabTitle: 'Music - YouTube',
        targetHandle: 123,
        targetProcessId: 456,
        processName: 'chrome'
      }
    );
    assert.equal(
      IPC_VALIDATORS['remote:control']({ targetId: 'powerpoint', action: 'slideshow' }).action,
      'slideshow'
    );
    assert.throws(
      () => IPC_VALIDATORS['remote:control']({ targetId: 'youtube', action: 'delete' }),
      /remote action is not supported/
    );
  });

  it('should provide a validator for every registered IPC channel', function() {
    const expectedChannels = [
      'command:process', 'command:confirm', 'assistant:status', 'tts:speak', 'tts:stop', 'voice:start',
      'browser:openExternal',
      'voiceOverlay:collapse', 'voiceOverlay:expandLiveSchedule',
      'window:openChat', 'window:hideChat', 'window:openPeopleChat', 'window:openSettings', 'window:openPlanner', 'window:closePlanner',
      'window:openGallery', 'window:closeGallery',
      'config:get', 'settings:get',
      'assistantChatHistory:get', 'assistantChatHistory:getSync', 'assistantChatHistory:save', 'assistantChatHistory:saveSync', 'assistantChatHistory:clear',
      'desktopChat:list', 'desktopChat:open', 'desktopChat:create', 'desktopChat:update', 'desktopChat:delete', 'desktopChat:send',
      'desktopChat:quickReply',
      'desktopChat:contacts:list', 'desktopChat:contacts:accept', 'desktopChat:contacts:delete', 'desktopChat:contacts:cancel',
      'desktopChat:registration:get', 'desktopChat:registration:start', 'desktopChat:profile:password', 'desktopChat:uiState',
      'remote:listTargets', 'remote:control',
      'uiState:get', 'uiState:save',
      'security:status', 'security:verifyAccess', 'security:setPassword',
      'cloud:status', 'cloud:connect', 'cloud:disconnect',
      'cloud:pairingQR:create', 'cloud:pairing:status', 'cloud:pairing:approve', 'cloud:pairing:reject',
      'cloud:devices:list', 'cloud:device:rename', 'cloud:device:remove',
      'settings:save', 'settings:reset',
      'schedule:alertAction', 'cloud:fileTransferAction', 'schedule:getSnapshot', 'timerWidget:getState', 'timerWidget:close',
      'timerWidget:stopStopwatch', 'timerWidget:resumeStopwatch',
      'timerWidget:resetStopwatch', 'planner:getEntries', 'planner:addEntry',
      'planner:deleteEntry',
      'gallery:getView', 'gallery:getPhotos', 'gallery:getImageData', 'gallery:openPhoto',
      'gallery:showPhoto', 'gallery:toggleFavorite', 'gallery:nameFace',
      'gallery:setFaceRelationship', 'gallery:updateFacePerson', 'gallery:deleteFacePerson',
      'gallery:addFaceToPerson', 'gallery:removeFaceCluster', 'gallery:scanPeople',
      'app:quit'
    ];

    assert.deepEqual(Object.keys(IPC_VALIDATORS).sort(), expectedChannels.sort());
    assert.match(mainScript, /registerSyncIpcHandler\('assistantChatHistory:getSync'/);
    assert.match(mainScript, /registerSyncIpcHandler\('assistantChatHistory:saveSync'/);
    assert.match(mainScript, /function assistantChatHistoryPath\(\)/);
    assert.match(mainScript, /dataPaths\.assistantChatHistoryPath/);
    assert.match(mainScript, /function migrateAccidentalAssistantChatHistory\(\)/);
    assert.match(mainScript, /function ensureDataDir\(\) \{[\s\S]*migrateAccidentalAssistantChatHistory\(\);/);
    assert.match(mainScript, /function writeAssistantChatHistory\(entries = \[\]\) \{[\s\S]*const existing = readAssistantChatHistory\(\);[\s\S]*const incoming = normalizeChatHistoryEntries\(entries\);[\s\S]*mergeChatHistoryEntries\(existing, incoming\)/);
    assert.match(mainScript, /Recovered assistant chat history from larger backup/);
    assert.match(mainScript, /backup\.length > entries\.length && recovered\.length > entries\.length/);
    assert.doesNotMatch(mainScript, /function chatHistoryPath\(\)/);
  });
});
