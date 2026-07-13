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
});
