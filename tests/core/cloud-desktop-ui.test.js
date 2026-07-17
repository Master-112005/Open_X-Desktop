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
    assert.match(main, /registerIpcHandler\('cloud:fileTransferAction'/);
    assert.match(main, /Documents\\\\OpenX/);
    assert.doesNotMatch(main, /showMessageBox\(\{/);
    assert.match(preload, /ipcRenderer\.invoke\('cloud:fileTransferAction'/);
    assert.match(preload, /Accepting\.\.\./);
    assert.match(preload, /Rejecting\.\.\./);
    assert.match(voiceOverlay, /transferId: String\(action\?\.transferId/);
    assert.match(voiceOverlay, /intent\.startsWith\('cloud\.fileTransfer'\)/);
  });
});
