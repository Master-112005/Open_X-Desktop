const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const AutomationEngine = require('../../core/automation/index');
const ScreenshotController = require('../../core/automation/screenshot-recording');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openx-shot-'));
}

describe('Screenshot and Recording Automation', function() {
  it('should save screenshots with verified metadata', function() {
    const directory = tempDir();
    const controller = new ScreenshotController({
      screenshots: {
        directory,
        clock: () => new Date('2026-07-14T10:20:30.000Z'),
        commandRunner: (_script, context) => {
          fs.writeFileSync(context.filePath, Buffer.alloc(512, 1));
          return '';
        }
      }
    });

    const result = controller.capture();
    assert.equal(result.success, true);
    assert.equal(result.data.filename, 'OpenX-2026-07-14T10-20-30-000Z.png');
    assert.equal(result.data.size, 512);
    assert.equal(result.data.verification.status, 'passed');
    assert.ok(fs.existsSync(result.data.filePath));
  });

  it('should fail clearly when the capture command does not produce a file', function() {
    const controller = new ScreenshotController({
      screenshots: {
        directory: tempDir(),
        commandRunner: () => ''
      }
    });

    const result = controller.capture();
    assert.equal(result.success, false);
    assert.equal(result.data.verified, false);
    assert.equal(result.data.verification.status, 'failed');
    assert.match(result.error, /did not produce|incomplete|screenshot/i);
  });

  it('should reject incomplete screenshot files', function() {
    const controller = new ScreenshotController({
      screenshots: {
        directory: tempDir(),
        commandRunner: (_script, context) => {
          fs.writeFileSync(context.filePath, Buffer.alloc(8, 1));
          return '';
        }
      }
    });

    const result = controller.capture();
    assert.equal(result.success, false);
    assert.equal(result.data.verification.check, 'screenshot-file');
  });

  it('should verify screenshot results through the automation engine', async function() {
    const engine = new AutomationEngine({
      screenshots: {
        directory: tempDir(),
        commandRunner: (_script, context) => {
          fs.writeFileSync(context.filePath, Buffer.alloc(384, 1));
          return '';
        }
      }
    });

    const result = await engine.execute('system.screenshot', {});
    assert.equal(result.success, true);
    assert.equal(result.validation.status, 'passed');
    assert.equal(result.verification.status, 'passed');
    assert.equal(result.verification.check, 'screenshot-file-created');
  });

  it('should expose recording as unsupported instead of pretending to record', function() {
    const controller = new ScreenshotController({});
    const result = controller.startRecording();
    assert.equal(result.success, false);
    assert.equal(result.data.supported, false);
    assert.equal(result.data.verification.check, 'screen-recording-unavailable');
  });
});
