const assert = require('assert');
const AutomationEngine = require('../../core/automation/index');
const VolumeController = require('../../core/automation/volume');
const BrightnessController = require('../../core/automation/brightness');

function assertNear(actual, expected, tolerance = 3) {
  assert.ok(
    typeof actual === 'number' && Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

describe('Volume and Brightness Control', function() {
  this.timeout(10000); // Allow longer timeout for system operations
  let restoreVolumeController;
  let restoreBrightnessController;
  let originalVolume = 50;
  let originalBrightness = null;

  before(async function() {
    restoreVolumeController = new VolumeController({ logging: { level: 'info' }, system: { volumeStep: 5 } });
    restoreBrightnessController = new BrightnessController({ logging: { level: 'info' }, system: { brightnessStep: 10 } });
    originalVolume = await restoreVolumeController.getCurrentVolume();
    originalBrightness = await restoreBrightnessController.getCurrentBrightness();
  });

  after(async function() {
    await restoreVolumeController.setVolume(originalVolume);
    if (originalBrightness !== null) {
      await restoreBrightnessController.setBrightness(originalBrightness);
    }
  });

  describe('Volume Controller', function() {
    let volumeController;

    before(function() {
      volumeController = new VolumeController({ logging: { level: 'info' }, system: { volumeStep: 5 } });
    });

    it('should get current volume', async function() {
      const volume = await volumeController.getCurrentVolume();
      assert.ok(typeof volume === 'number');
      assert.ok(volume >= 0 && volume <= 100);
    });

    it('should set volume to specific value', async function() {
      const result = await volumeController.setVolume(50);
      assert.ok(result.success);
      assertNear(result.data.value, 50);
    });

    it('should clamp volume to 0-100 range', async function() {
      const resultHigh = await volumeController.setVolume(150);
      assert.ok(resultHigh.success);
      assert.equal(resultHigh.data.value, 100);

      const resultLow = await volumeController.setVolume(-10);
      assert.ok(resultLow.success);
      assert.equal(resultLow.data.value, 0);
    });

    it('should increase volume', async function() {
      await volumeController.setVolume(30);
      const result = await volumeController.increaseVolume();
      assert.ok(result.success);
      assertNear(result.data.value, 35); // 30 + 5 (default step)
    });

    it('should decrease volume', async function() {
      await volumeController.setVolume(40);
      const result = await volumeController.decreaseVolume();
      assert.ok(result.success);
      assertNear(result.data.value, 35); // 40 - 5 (default step)
    });

    it('should mute volume', async function() {
      const result = await volumeController.mute();
      assert.ok(result.success);
      assert.equal(result.data.value, 0);
    });

    it('should unmute volume', async function() {
      const result = await volumeController.unmute();
      assert.ok(result.success);
      assert.ok(typeof result.data.value === 'number');
      assert.ok(result.data.value >= 0 && result.data.value <= 100);
    });

    it('should handle custom step for increase', async function() {
      await volumeController.setVolume(20);
      const result = await volumeController.increaseVolume(15); // Custom step
      assert.ok(result.success);
      assertNear(result.data.value, 35);
    });

    it('should handle custom step for decrease', async function() {
      await volumeController.setVolume(60);
      const result = await volumeController.decreaseVolume(15); // Custom step
      assert.ok(result.success);
      assertNear(result.data.value, 45);
    });
  });

  describe('Brightness Controller', function() {
    let brightnessController;

    before(function() {
      brightnessController = new BrightnessController({ logging: { level: 'info' }, system: { brightnessStep: 10 } });
    });

    it('should get current brightness', async function() {
      const brightness = await brightnessController.getCurrentBrightness();
      // Brightness might be null if not supported
      if (brightness !== null) {
        assert.ok(typeof brightness === 'number');
        assert.ok(brightness >= 0 && brightness <= 100);
      }
    });

    it('should set brightness to specific value', async function() {
      const result = await brightnessController.setBrightness(60);
      assert.ok(result.success);
      assert.equal(result.data.value, 60);
    });

    it('should clamp brightness to 0-100 range', async function() {
      const resultHigh = await brightnessController.setBrightness(150);
      assert.ok(resultHigh.success);
      assert.equal(resultHigh.data.value, 100);

      const resultLow = await brightnessController.setBrightness(-20);
      assert.ok(resultLow.success);
      assert.equal(resultLow.data.value, 0);
    });

    it('should increase brightness if supported', async function() {
      const current = await brightnessController.getCurrentBrightness();
      if (current !== null) {
        await brightnessController.setBrightness(40);
        const result = await brightnessController.increaseBrightness();
        assert.ok(result.success);
        assert.equal(result.data.value, 50); // 40 + 10 (default step)
      }
    });

    it('should decrease brightness if supported', async function() {
      const current = await brightnessController.getCurrentBrightness();
      if (current !== null) {
        await brightnessController.setBrightness(60);
        const result = await brightnessController.decreaseBrightness();
        assert.ok(result.success);
        assert.equal(result.data.value, 50); // 60 - 10 (default step)
      }
    });

    it('should return error if brightness not supported', async function() {
      const current = await brightnessController.getCurrentBrightness();
      if (current === null) {
        const result = await brightnessController.increaseBrightness();
        assert.equal(result.success, false);
        assert.ok(result.error.includes('not supported'));
      }
    });

    it('should handle custom step for increase', async function() {
      const current = await brightnessController.getCurrentBrightness();
      if (current !== null) {
        await brightnessController.setBrightness(30);
        const result = await brightnessController.increaseBrightness(20); // Custom step
        assert.ok(result.success);
        assert.equal(result.data.value, 50);
      }
    });

    it('should handle custom step for decrease', async function() {
      const current = await brightnessController.getCurrentBrightness();
      if (current !== null) {
        await brightnessController.setBrightness(70);
        const result = await brightnessController.decreaseBrightness(20); // Custom step
        assert.ok(result.success);
        assert.equal(result.data.value, 50);
      }
    });
  });

  describe('Controller Parsing and Verification Metadata', function() {
    it('should preserve requested zero for volume and return readback metadata', async function() {
      const controller = new VolumeController({
        logging: { level: 'info' },
        system: {
          volumeCommandRunner: script => {
            if (script.includes('SetMasterVolume(0)')) return '0';
            if (script.includes('GetMute()')) return 'False\n25';
            return '25';
          }
        }
      });

      const result = await controller.setVolume(0);
      assert.equal(result.success, true);
      assert.equal(result.data.value, 0);
      assert.equal(result.data.requestedValue, 0);
      assert.equal(result.data.verification.status, 'passed');
    });

    it('should preserve requested zero for brightness and return readback metadata', async function() {
      const controller = new BrightnessController({
        logging: { level: 'info' },
        system: {
          brightnessCommandRunner: script => script.includes('Brightness = 0') ? '0' : '40'
        }
      });

      const result = await controller.setBrightness(0);
      assert.equal(result.success, true);
      assert.equal(result.data.value, 0);
      assert.equal(result.data.requestedValue, 0);
      assert.equal(result.data.verification.status, 'passed');
    });

    it('should report unsupported brightness without throwing', async function() {
      const controller = new BrightnessController({
        logging: { level: 'info' },
        system: {
          brightnessCommandRunner: () => null
        }
      });

      const result = await controller.getState();
      assert.equal(result.success, false);
      assert.equal(result.data.supported, false);
      assert.equal(result.data.verification.status, 'failed');
    });
  });

  describe('Automation Engine Volume Actions', function() {
    let engine;

    before(function() {
      engine = new AutomationEngine({});
    });

    it('should have volume actions registered', function() {
      const actions = engine.getActions();
      assert.ok(actions.includes('volume.set'));
      assert.ok(actions.includes('volume.up'));
      assert.ok(actions.includes('volume.down'));
      assert.ok(actions.includes('volume.mute'));
      assert.ok(actions.includes('volume.unmute'));
      assert.ok(actions.includes('volume.get'));
    });

    it('should execute volume.set action', async function() {
      const result = await engine.execute('volume.set', { value: 50 });
      assert.ok(result.success);
    });

    it('should execute volume.up action', async function() {
      const result = await engine.execute('volume.up', {});
      assert.ok(result.success);
    });

    it('should execute volume.down action', async function() {
      const result = await engine.execute('volume.down', {});
      assert.ok(result.success);
    });

    it('should execute volume.mute action', async function() {
      const result = await engine.execute('volume.mute', {});
      assert.ok(result.success);
    });

    it('should execute volume.unmute action', async function() {
      const result = await engine.execute('volume.unmute', {});
      assert.ok(result.success);
    });

    it('should execute volume.get action', async function() {
      const result = await engine.execute('volume.get', {});
      assert.ok(result.success);
      assert.ok(typeof result.data.value === 'number');
    });

    it('should execute volume.set with zero instead of defaulting to 50', async function() {
      const zeroEngine = new AutomationEngine({
        system: {
          volumeCommandRunner: script => {
            if (script.includes('SetMasterVolume(0)')) return '0';
            if (script.includes('GetMute()')) return 'False\n0';
            return '0';
          }
        }
      });

      const result = await zeroEngine.execute('volume.set', { value: 0 });
      assert.equal(result.success, true);
      assert.equal(result.data.value, 0);
      assert.equal(result.validation.status, 'passed');
      assert.equal(result.verification.status, 'passed');
    });
  });

  describe('Automation Engine Brightness Actions', function() {
    let engine;

    before(function() {
      engine = new AutomationEngine({});
    });

    it('should have brightness actions registered', function() {
      const actions = engine.getActions();
      assert.ok(actions.includes('brightness.set'));
      assert.ok(actions.includes('brightness.up'));
      assert.ok(actions.includes('brightness.down'));
      assert.ok(actions.includes('brightness.get'));
    });

    it('should execute brightness.set action', async function() {
      const result = await engine.execute('brightness.set', { value: 70 });
      assert.ok(result.success);
    });

    it('should execute brightness.up action', async function() {
      const result = await engine.execute('brightness.up', {});
      assert.ok(result.success);
    });

    it('should execute brightness.down action', async function() {
      const result = await engine.execute('brightness.down', {});
      assert.ok(result.success);
    });

    it('should execute brightness.get action', async function() {
      const result = await engine.execute('brightness.get', {});
      // May fail if brightness not supported, but shouldn't crash
      assert.ok(typeof result.success === 'boolean');
    });

    it('should execute brightness.set with zero instead of defaulting to 50', async function() {
      const zeroEngine = new AutomationEngine({
        system: {
          brightnessCommandRunner: script => script.includes('Brightness = 0') ? '0' : '0'
        }
      });

      const result = await zeroEngine.execute('brightness.set', { value: 0 });
      assert.equal(result.success, true);
      assert.equal(result.data.value, 0);
      assert.equal(result.validation.status, 'passed');
      assert.equal(result.verification.status, 'passed');
    });
  });

  describe('Integration Tests', function() {
    let engine;

    before(function() {
      engine = new AutomationEngine({});
    });

    it('should handle volume sequence: set -> get', async function() {
      await engine.execute('volume.set', { value: 45 });
      const getResult = await engine.execute('volume.get', {});
      assert.ok(getResult.success);
      assertNear(getResult.data.value, 45);
    });

    it('should handle brightness sequence: set -> get', async function() {
      const setResult = await engine.execute('brightness.set', { value: 65 });
      if (setResult.success) {
        const getResult = await engine.execute('brightness.get', {});
        if (getResult.success) {
          assert.equal(getResult.data.value, 65);
        }
      }
    });

    it('should handle volume up -> get sequence', async function() {
      await engine.execute('volume.set', { value: 40 });
      await engine.execute('volume.up', {});
      const getResult = await engine.execute('volume.get', {});
      assert.ok(getResult.success);
      assertNear(getResult.data.value, 45); // 40 + 5
    });

    it('should handle volume mute -> unmute sequence', async function() {
      await engine.execute('volume.mute', {});
      let getResult = await engine.execute('volume.get', {});
      assert.equal(getResult.data.value, 0);

      await engine.execute('volume.unmute', {});
      getResult = await engine.execute('volume.get', {});
      assert.ok(typeof getResult.data.value === 'number');
      assert.ok(getResult.data.value >= 0 && getResult.data.value <= 100);
    });
  });
});
