const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('OpenX Security Lock', function() {
  let OpenXSecurityLock;

  before(function() {
    OpenXSecurityLock = require('../../apps/desktop/security-lock');
  });

  function createLock(nowRef = { value: Date.now() }) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-security-lock-'));
    return {
      lock: new OpenXSecurityLock({
        securityDir: tempDir,
        now: () => nowRef.value
      }),
      tempDir,
      nowRef
    };
  }

  it('stores only a salted hash and verifies the password', function() {
    const { lock, tempDir } = createLock();
    const saved = lock.setPassword({ newPassword: 'correct horse battery' });
    assert.equal(saved.success, true);
    assert.equal(lock.verify('correct horse battery').success, true);
    assert.equal(lock.verify('wrong password').success, false);

    const raw = fs.readFileSync(path.join(tempDir, 'assistant-lock.json'), 'utf8');
    assert.doesNotMatch(raw, /correct horse battery/);
    const record = JSON.parse(raw);
    assert.equal(record.algorithm, 'pbkdf2');
    assert.ok(record.passwordHash);
    assert.ok(record.salt);
  });

  it('requires current password before changing an existing lock', function() {
    const { lock } = createLock();
    assert.equal(lock.setPassword({ newPassword: 'first password' }).success, true);
    assert.equal(lock.setPassword({ currentPassword: 'bad', newPassword: 'second password' }).success, false);
    assert.equal(lock.verify('first password').success, true);

    assert.equal(lock.setPassword({ currentPassword: 'first password', newPassword: 'second password' }).success, true);
    assert.equal(lock.verify('first password').success, false);
    assert.equal(lock.verify('second password').success, true);
  });

  it('locks temporarily after repeated failed attempts', function() {
    const nowRef = { value: 1000 };
    const { lock } = createLock(nowRef);
    lock.setPassword({ newPassword: 'lockout password' });

    for (let index = 0; index < 5; index += 1) {
      lock.verify('wrong');
    }
    assert.equal(lock.getStatus().locked, true);
    assert.equal(lock.verify('lockout password').success, false);

    nowRef.value += 5 * 60 * 1000 + 1;
    assert.equal(lock.verify('lockout password').success, true);
  });
});
