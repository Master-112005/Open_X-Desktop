const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ActionVerifier = require('../../core/automation/common/action-verification');

describe('Action Verification Contract', function() {
  it('should attach confidence, evidence, and summary metadata to verified actions', function() {
    const verifier = new ActionVerifier({
      apps: {
        waitForVisibleApp(appName) {
          return {
            ProcessName: appName,
            MainWindowTitle: 'Chrome\u0000 - Google Chrome'
          };
        }
      }
    });

    const result = verifier.verify('app.open', { appName: 'chrome' }, {
      success: true,
      data: { app: 'chrome', launchMethod: 'start-menu' }
    });

    assert.equal(result.success, true);
    assert.equal(result.verification.status, 'passed');
    assert.equal(result.verification.check, 'app-open');
    assert.ok(result.verification.confidence > 0.9);
    assert.ok(result.verification.evidence.some(item => item.type === 'window'));
    assert.equal(result.verificationSummary.verified, true);
    assert.equal(result.data.verificationSummary.verified, true);
    assert.doesNotMatch(result.verification.matchedWindow, /\u0000/);
  });

  it('should fail safely when file postcondition inspection throws', function() {
    const verifier = new ActionVerifier();
    const target = path.join(os.tmpdir(), `openx-verifier-${Date.now()}.txt`);
    fs.writeFileSync(target, 'blocked');

    const originalStatSync = fs.statSync;
    fs.statSync = function patchedStatSync(filePath) {
      if (filePath === target) {
        throw new Error('Access is denied\u0000');
      }
      return originalStatSync.apply(this, arguments);
    };

    try {
      const result = verifier.verify('file.create', { filename: path.basename(target) }, {
        success: true,
        data: { path: target, filename: path.basename(target) }
      });

      assert.equal(result.success, false);
      assert.equal(result.verification.status, 'failed');
      assert.equal(result.verification.blocking, true);
      assert.match(result.error, /Could not inspect target file/i);
      assert.doesNotMatch(result.error, /\u0000/);
    } finally {
      fs.statSync = originalStatSync;
      fs.rmSync(target, { force: true });
    }
  });

  it('should not match every window when a process name is empty', function() {
    const verifier = new ActionVerifier({
      windows: {
        listWindows() {
          return [{ title: '', processName: '' }];
        }
      }
    });

    const result = verifier.verify('app.close', { appName: 'instagram' }, {
      success: true,
      data: { app: 'instagram', closeMethod: 'window' }
    });

    assert.equal(result.success, true);
    assert.equal(result.verification.status, 'passed');
    assert.equal(result.verification.check, 'app-closed');
  });

  it('should keep dispatch-only browser launches nonblocking', function() {
    const verifier = new ActionVerifier();
    const result = verifier.verify('browser.open', { url: 'https://example.com' }, {
      success: true,
      data: {
        url: 'https://example.com',
        launchMethod: 'browser-executable',
        controllerVerified: false
      }
    });

    assert.equal(result.success, true);
    assert.equal(result.verification.status, 'unknown');
    assert.equal(result.verification.blocking, false);
    assert.equal(result.verificationSummary.verified, false);
    assert.ok(result.verificationSummary.confidence < 0.6);
  });
});
