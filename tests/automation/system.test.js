const assert = require('assert');
const SystemController = require('../../core/automation/system');

function controllerWithRunner(handler, options = {}) {
  return new SystemController({
    logging: { level: 'error' },
    system: {
      powershellRunner: (file, args) => {
        assert.equal(file, 'powershell.exe');
        assert.ok(args.includes('-NoProfile'));
        assert.ok(args.includes('-NonInteractive'));
        return handler(args[args.length - 1]);
      },
      ...options
    }
  });
}

describe('SystemController', function() {
  it('should read CPU through the shared PowerShell runner and cache the result', function() {
    let calls = 0;
    const system = controllerWithRunner(() => {
      calls += 1;
      return '42';
    });

    const first = system.getCPUUsage();
    const second = system.getCPUUsage();

    assert.equal(first.success, true);
    assert.equal(first.data.cpu, 42);
    assert.equal(first.data.metricSource, 'cim-win32-processor');
    assert.equal(first.data.controllerVerified, true);
    assert.equal(second.data.cpu, 42);
    assert.equal(calls, 1);
  });

  it('should parse disk details without exposing unnecessary fields', function() {
    const system = controllerWithRunner(() => JSON.stringify([
      { DeviceID: 'D:', FreeGB: 12.5, TotalGB: 100 },
      { DeviceID: 'C:', FreeGB: 55.1, TotalGB: 250 }
    ]));

    const result = system.getDiskSpace();

    assert.equal(result.success, true);
    assert.equal(result.data.label, 'C:');
    assert.equal(result.data.free, 55.1);
    assert.equal(result.data.total, 250);
    assert.deepEqual(result.data.drives.map(drive => drive.label), ['D:', 'C:']);
    assert.equal(result.data.metricSource, 'cim-win32-logicaldisk');
  });

  it('should bound visible app payloads while preserving query status', function() {
    const rows = Array.from({ length: 6 }, (_, index) => ({
      ProcessName: index === 2 ? 'chrome' : `app${index}`,
      MainWindowTitle: index === 2 ? 'Chrome - Docs' : `Window ${index}`,
      Id: index + 10
    }));
    const system = controllerWithRunner(() => JSON.stringify(rows), { processListLimit: 3 });

    const result = system.getRunningApps({ queryApp: 'chrome' });

    assert.equal(result.success, true);
    assert.equal(result.data.target, 'apps');
    assert.equal(result.data.count, 6);
    assert.equal(result.data.apps.length, 3);
    assert.equal(result.data.isOpen, true);
    assert.equal(result.data.matchedApps[0].name, 'chrome');
    assert.ok(!Object.prototype.hasOwnProperty.call(result.data.apps[0], 'commandLine'));
  });

  it('should return calculation results with verification metadata', function() {
    const system = new SystemController({ logging: { level: 'error' } });
    const result = system.calculate('25 percent of 200');

    assert.equal(result.success, true);
    assert.equal(result.data.result, 50);
    assert.equal(result.data.verification.status, 'passed');
    assert.equal(result.data.verification.check, 'calculation-result');
    assert.equal(result.data.metricSource, 'local-parser');
  });

  it('should report missing battery as a non-blocking system read', function() {
    const system = controllerWithRunner(() => '');
    const result = system.getBatteryStatus();

    assert.equal(result.success, true);
    assert.equal(result.data.battery, 'N/A');
    assert.equal(result.data.controllerVerified, false);
    assert.equal(result.data.verification.status, 'unknown');
  });
});
