const { strict: assert } = require('assert');
const fs = require('fs');
const path = require('path');

describe('Cloud desktop UI routing', () => {
  it('does not show mobile assistant chat commands in the Dynamic Island', () => {
    const main = fs.readFileSync(
      path.join(__dirname, '..', '..', 'apps', 'desktop', 'electron', 'main.js'),
      'utf8'
    );

    assert.doesNotMatch(main, /presentCloudPhoneCommandInDynamicIsland/);
    assert.doesNotMatch(main, /presentCloudPhoneResultInDynamicIsland/);
    assert.doesNotMatch(main, /intent:\s*['"]phone\.cloudCommand['"]/);
    assert.doesNotMatch(main, /intent:\s*result\.intent\s*\|\|\s*['"]phone\.cloudResult['"]/);
    assert.match(main, /Cloud assistant command received from mobile/);
    assert.match(main, /Cloud assistant result returned to mobile/);
  });

  it('uses the Dynamic Island for incoming cloud file approvals', () => {
    const root = path.join(__dirname, '..', '..');
    const main = fs.readFileSync(path.join(root, 'apps', 'desktop', 'electron', 'main.js'), 'utf8');
    const preload = fs.readFileSync(path.join(root, 'apps', 'desktop', 'preload.js'), 'utf8');
    const voiceOverlay = fs.readFileSync(path.join(root, 'apps', 'desktop', 'voice', 'ui', 'VoiceOverlay.js'), 'utf8');

    assert.match(main, /function presentCloudFileTransferPrompt\(transfer = \{\}\)/);
    assert.match(main, /intent: 'cloud\.fileTransfer\.incoming'/);
    assert.match(main, /File sent to mobile/);
    assert.match(main, /File received/);
    assert.match(main, /direction === 'desktop-to-phone'/);
    assert.match(main, /outgoingToMobile \? 5000 : 8000/);
    assert.match(main, /registerIpcHandler\('cloud:fileTransferAction'/);
    assert.match(main, /Documents\\\\OpenX/);
    assert.doesNotMatch(main, /showMessageBox\(\{/);
    assert.match(preload, /ipcRenderer\.invoke\('cloud:fileTransferAction'/);
    assert.match(preload, /Accepting\.\.\./);
    assert.match(preload, /Rejecting\.\.\./);
    assert.match(voiceOverlay, /transferId: String\(action\?\.transferId/);
    assert.match(voiceOverlay, /intent\.startsWith\('cloud\.fileTransfer'\)/);
  });

  it('keeps OpenX Chat mailbox sync adaptive and bounded', () => {
    const main = fs.readFileSync(
      path.join(__dirname, '..', '..', 'apps', 'desktop', 'electron', 'main.js'),
      'utf8'
    );

    assert.match(main, /DESKTOP_CHAT_SYNC_REQUEST_TIMEOUT_MS\s*=\s*8000/);
    assert.match(main, /DESKTOP_CHAT_SYNC_IDLE_MAX_MS\s*=\s*60000/);
    assert.match(main, /DESKTOP_CHAT_SYNC_FAILURE_MAX_MS\s*=\s*120000/);
    assert.match(main, /function getDesktopChatNextSyncDelay\(envelopeCount = 0, hasMore = false\)/);
    assert.match(main, /function getDesktopChatFailureSyncDelay\(\)/);
    assert.match(main, /writeDesktopChatSyncCursor\(deviceId, suggestedAck\)/);
    assert.match(main, /timeoutMs: DESKTOP_CHAT_SYNC_REQUEST_TIMEOUT_MS/);
  });

  it('defers and bounds startup temp cleanup work', () => {
    const main = fs.readFileSync(
      path.join(__dirname, '..', '..', 'apps', 'desktop', 'electron', 'main.js'),
      'utf8'
    );

    assert.match(main, /TEMP_CLEANUP_STARTUP_DELAY_MS\s*=\s*12 \* 1000/);
    assert.match(main, /TEMP_CLEANUP_MAX_SCAN_ENTRIES\s*=\s*1000/);
    assert.match(main, /TEMP_CLEANUP_MAX_DELETE_ENTRIES\s*=\s*128/);
    assert.match(main, /fs\.promises\.opendir\(tempRoot\)/);
    assert.match(main, /function scheduleOpenXTempCleanup\(reason = 'startup'/);
    assert.match(main, /scheduleOpenXTempCleanup\('desktop-runtime-ready'\)/);
    assert.doesNotMatch(main, /void cleanupOpenXTempArtifacts\(\)/);
  });
});
