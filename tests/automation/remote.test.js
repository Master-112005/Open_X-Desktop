const assert = require('assert');

const RemoteController = require('../../core/automation/remote');

describe('Remote Controller', function() {
  it('lists active browser and presentation targets only from running windows', function() {
    const remote = new RemoteController({}, {
      windows: {
        listWindows: () => [
          { title: 'Quarterly update - PowerPoint', processName: 'POWERPNT' },
          { title: 'Notes', processName: 'notepad' }
        ],
        listBrowserTabs: () => [
          {
            title: 'Dulander song - YouTube',
            windowTitle: 'Dulander song - YouTube - Google Chrome',
            processName: 'chrome',
            isActiveTab: true
          },
          {
            title: 'Search results',
            windowTitle: 'Search results - Google Chrome',
            processName: 'chrome',
            isActiveTab: false
          }
        ]
      }
    });

    const result = remote.listTargets();
    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.data.targets.map((target) => target.id), ['youtube', 'powerpoint']);
  });

  it('focuses a YouTube browser tab before sending the play pause shortcut', function() {
    const calls = [];
    const remote = new RemoteController({}, {
      windows: {
        listWindows: () => [],
        listBrowserTabs: () => [],
        focusBrowserTab: (title, processes) => {
          calls.push({ type: 'focusBrowserTab', title, processes });
          return { success: true };
        },
        sendKeys: (windowName, keys, options) => {
          calls.push({ type: 'sendKeys', windowName, keys, options });
          return {
            success: true,
            data: {
              matchedWindow: 'Dulander song - YouTube - Google Chrome',
              matchedHandle: 'handle-1',
              processName: 'chrome'
            }
          };
        }
      }
    });

    const result = remote.sendControl({
      targetId: 'youtube',
      action: 'playPause',
      tabTitle: 'Dulander song - YouTube',
      windowTitle: 'Google Chrome'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(calls[0].type, 'focusBrowserTab');
    assert.strictEqual(calls[0].title, 'Dulander song - YouTube');
    assert.strictEqual(calls[1].type, 'sendKeys');
    assert.strictEqual(calls[1].windowName, 'Dulander song - YouTube');
    assert.strictEqual(calls[1].keys, 'k');
    assert.strictEqual(calls[1].options.requireTitleTokenMatch, true);
    assert.strictEqual(calls[1].options.settleDelayMs, 80);
  });

  it('reuses a short target cache so repeated remote refreshes do not rescan windows', function() {
    let windowScans = 0;
    let tabScans = 0;
    const remote = new RemoteController({}, {
      windows: {
        listWindows: () => {
          windowScans += 1;
          return [
            { title: 'Quarterly update - PowerPoint', processName: 'POWERPNT', handle: 7, processId: 70 }
          ];
        },
        listBrowserTabs: () => {
          tabScans += 1;
          return [
            {
              title: 'Dulander song - YouTube',
              windowTitle: 'Dulander song - YouTube - Google Chrome',
              processName: 'chrome',
              handle: 11,
              processId: 110,
              isActiveTab: true
            }
          ];
        }
      }
    });

    const first = remote.listTargets();
    const second = remote.listTargets();

    assert.strictEqual(first.success, true);
    assert.strictEqual(second.success, true);
    assert.strictEqual(windowScans, 1);
    assert.strictEqual(tabScans, 1);
    assert.strictEqual(second.data.targets[0].handle, 11);
    assert.strictEqual(second.data.targets[0].processId, 110);
  });

  it('sends direct handle details for cached remote targets and normalizes app-specific next aliases', function() {
    const calls = [];
    const remote = new RemoteController({}, {
      windows: {
        listWindows: () => [],
        listBrowserTabs: () => [
          {
            title: 'Dulander song - YouTube',
            windowTitle: 'Dulander song - YouTube - Google Chrome',
            processName: 'chrome',
            handle: 1234,
            processId: 4567,
            isActiveTab: true
          }
        ],
        sendKeys: (windowName, keys, options) => {
          calls.push({ windowName, keys, options });
          return {
            success: true,
            data: {
              matchedWindow: windowName,
              matchedHandle: options.targetHandle,
              processId: options.targetProcessId,
              processName: options.targetProcessName
            }
          };
        }
      }
    });

    remote.listTargets();
    const result = remote.sendControl({ targetId: 'youtube', action: 'next' });

    assert.strictEqual(result.success, true);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].keys, '+n');
    assert.strictEqual(calls[0].options.targetHandle, 1234);
    assert.strictEqual(calls[0].options.targetProcessId, 4567);
    assert.strictEqual(calls[0].options.settleDelayMs, 80);
    assert.strictEqual(result.data.processId, 4567);
  });

  it('uses presentation-specific controls for PowerPoint slide shows', function() {
    const calls = [];
    const remote = new RemoteController({}, {
      windows: {
        listWindows: () => [
          { title: 'Quarterly update - PowerPoint', processName: 'POWERPNT', handle: 77, processId: 700 }
        ],
        listBrowserTabs: () => [],
        sendKeys: (windowName, keys, options) => {
          calls.push({ windowName, keys, options });
          return {
            success: true,
            data: {
              matchedWindow: windowName,
              matchedHandle: options.targetHandle,
              processId: options.targetProcessId,
              processName: options.targetProcessName
            }
          };
        }
      }
    });

    remote.listTargets();
    const start = remote.sendControl({ targetId: 'powerpoint', action: 'slideshow' });
    const next = remote.sendControl({ targetId: 'powerpoint', action: 'next' });

    assert.strictEqual(start.success, true);
    assert.strictEqual(next.success, true);
    assert.strictEqual(calls[0].keys, '{F5}');
    assert.strictEqual(calls[1].keys, '{PGDN}');
    assert.strictEqual(calls[0].options.settleDelayMs, 80);
  });

  it('rejects unsupported remote targets', function() {
    const remote = new RemoteController({}, {
      windows: {
        listWindows: () => [],
        listBrowserTabs: () => [],
        sendKeys: () => ({ success: true })
      }
    });

    const result = remote.sendControl({ targetId: 'calculator', action: 'center' });
    assert.strictEqual(result.success, false);
    assert.match(result.error, /supported remote target/i);
  });
});
