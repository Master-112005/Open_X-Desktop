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
