const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('App Controller', async function() {
  let AppController;

  before(async function() {
    AppController = require('../../core/automation/apps');
  });

  it('should prefer Start menu apps over command fallback when opening apps', async function() {
    const controller = new AppController({});
    let launched = null;
    controller.findVisibleApp = () => null;

    controller._resolveStartApp = (name) => {
      assert.equal(name, 'discord');
      return { name: 'Discord', appId: 'Discord.Discord' };
    };
    controller._launchStartApp = (startApp) => {
      launched = startApp;
    };
    controller._commandExists = () => {
      throw new Error('command fallback should not be checked when Start menu resolves');
    };

    const result = await controller.open('discord');

    assert.equal(result.success, true);
    assert.equal(launched.appId, 'Discord.Discord');
  });

  it('should open special Windows shell apps', async function() {
    const controller = new AppController({});
    let launched = null;
    controller.findVisibleApp = () => null;

    controller._resolveStartApp = () => null;
    controller._launchSpecialApp = (name) => {
      launched = name;
      return { success: true, data: { app: name, launchMethod: 'special' } };
    };

    const result = await controller.open('recycle bin');

    assert.equal(result.success, true);
    assert.equal(result.data.launchMethod, 'special');
    assert.equal(launched, 'recycle bin');
  });

  it('should fail clearly when an app cannot be found', async function() {
    const controller = new AppController({});
    controller.findVisibleApp = () => null;

    controller._resolveStartApp = () => null;
    controller._launchSpecialApp = () => ({ success: false });
    controller._commandExists = () => false;

    const result = await controller.open('missing app');

    assert.equal(result.success, false);
    assert.equal(result.error, 'Could not find app: missing app');
  });

  it('should escalate from graceful close to forced termination when a non-browser process stays alive', async function() {
    const controller = new AppController({});
    let state = 'running';

    controller._resolveStartApp = () => null;
    controller._getRunningProcessDetails = () => (
      state === 'closed'
        ? []
        : [{
            Id: 42,
            ProcessName: 'notepad',
            MainWindowTitle: 'Untitled - Notepad',
            MainWindowHandle: 123,
            Path: 'C:\\Windows\\System32\\notepad.exe'
          }]
    );
    controller._closeProcessesGracefully = () => true;
    controller._forceTerminateProcesses = () => {
      state = 'closed';
      return true;
    };
    controller._sleep = () => {};

    const result = await controller.close('notepad');
    assert.equal(result.success, true);
  });

  it('should not query Start menu metadata when closing known apps', async function() {
    const controller = new AppController({});
    let startMenuQueried = false;
    let state = 'running';

    controller._resolveStartApp = () => {
      startMenuQueried = true;
      return null;
    };
    controller.windowSession.closeWindow = () => ({ success: false, error: 'No matching window' });
    controller._getRunningProcessDetails = () => (
      state === 'closed'
        ? []
        : [{
            Id: 42,
            ProcessName: 'chrome',
            MainWindowTitle: 'Google Chrome',
            Path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
          }]
    );
    controller._closeProcessesGracefully = () => {
      state = 'closed';
      return true;
    };
    controller._sleep = () => {};

    const result = await controller.close('chrome');

    assert.equal(result.success, true);
    assert.equal(startMenuQueried, false);
  });

  it('should not close unrelated apps from broad Start menu publisher tokens', async function() {
    const controller = new AppController({});
    const processes = [
      {
        Id: 100,
        ProcessName: 'Code',
        MainWindowTitle: 'Visual Studio Code',
        Path: 'C:\\Users\\user\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe'
      },
      {
        Id: 101,
        ProcessName: 'notepad',
        MainWindowTitle: 'Untitled - Notepad',
        Path: 'C:\\Windows\\System32\\notepad.exe'
      }
    ];

    controller._getRunningProcessDetails = () => processes;

    const matches = await controller._findRunningProcesses('notepad', [
      'notepad',
      'Microsoft',
      'WindowsNotepad'
    ]);

    assert.equal(matches.length, 1);
    assert.equal(matches[0].ProcessName, 'notepad');
  });

  it('should close browser-hosted apps by window title when process matching is not usable', async function() {
    const controller = new AppController({});

    controller.windowSession.closeWindow = (windowQuery, options) => {
      assert.equal(windowQuery, 'youtube');
      assert.ok(options.preferredTitleTokens.includes('youtube'));
      return {
        success: true,
        data: {
          matchedWindow: 'Playdate - YouTube',
          processName: 'chrome'
        }
      };
    };
    controller._getRunningProcessDetails = () => [];

    const result = await controller.close('youtube');

    assert.equal(result.success, true);
    assert.equal(result.data.closeMethod, 'window');
    assert.equal(result.data.processName, 'chrome');
  });

  it('should close window-targeted web apps by exact window even when unrelated chrome is running', async function() {
    const controller = new AppController({});
    controller.windowSession.closeWindow = (windowQuery, options) => {
      assert.equal(windowQuery, 'youtube');
      assert.ok(options.preferredTitleTokens.includes('youtube'));
      return {
        success: true,
        data: {
          matchedWindow: 'Music - YouTube',
          processName: 'chrome'
        }
      };
    };
    controller._getRunningProcessDetails = () => ([
      { Id: 601, ProcessName: 'chrome', MainWindowTitle: 'Google Chrome', MainWindowHandle: 123 },
      { Id: 602, ProcessName: 'chrome', MainWindowTitle: 'New Tab - Google Chrome', MainWindowHandle: 234 }
    ]);

    const result = await controller.close('youtube');

    assert.equal(result.success, true);
    assert.equal(result.data.closeMethod, 'window');
  });

  it('should not treat unrelated browser windows as an open web app', async function() {
    const controller = new AppController({});

    controller._getRunningProcessDetails = () => ([
      { Id: 301, ProcessName: 'chrome', MainWindowTitle: 'Google Chrome', MainWindowHandle: 111 },
      { Id: 302, ProcessName: 'msedge', MainWindowTitle: 'OpenX_Desktop - Visual Studio Code', MainWindowHandle: 222 }
    ]);

    const visible = await controller.findVisibleApp('youtube', { allowWindowFallback: false });

    assert.equal(visible, null);
  });

  it('should recognize a browser-hosted web app window by its title', async function() {
    const controller = new AppController({});

    controller._getRunningProcessDetails = () => ([
      { Id: 401, ProcessName: 'chrome', MainWindowTitle: 'Music - YouTube', MainWindowHandle: 456 },
      { Id: 402, ProcessName: 'chrome', MainWindowTitle: 'Google Chrome', MainWindowHandle: 123 }
    ]);

    const visible = await controller.findVisibleApp('youtube', { allowWindowFallback: false });

    assert.equal(visible.ProcessName, 'chrome');
    assert.equal(visible.MainWindowTitle, 'Music - YouTube');
  });

  it('should not close YouTube app windows when closing Chrome', async function() {
    const controller = new AppController({});
    let normalChromeClosed = false;
    let forcedTerminationUsed = false;

    controller._getRunningProcessDetails = () => {
      const processes = [
        {
          Id: 101,
          ProcessName: 'chrome',
          MainWindowTitle: 'Music - YouTube',
          MainWindowHandle: 456,
          Path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        }
      ];

      if (!normalChromeClosed) {
        processes.push({
          Id: 100,
          ProcessName: 'chrome',
          MainWindowTitle: 'Google Chrome',
          MainWindowHandle: 123,
          Path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        });
      }

      return processes;
    };
    controller._closeProcessesGracefully = (processes) => {
      assert.equal(processes.length, 1);
      assert.equal(processes[0].Id, 100);
      normalChromeClosed = true;
      return true;
    };
    controller._forceTerminateProcesses = () => {
      forcedTerminationUsed = true;
      return true;
    };
    controller._sleep = () => {};

    const result = await controller.close('chrome');

    assert.equal(result.success, true);
    assert.equal(forcedTerminationUsed, false);
  });

  it('should not force terminate browser child processes after visible windows close', async function() {
    const controller = new AppController({});
    let visibleWindowClosed = false;
    let forcedTerminationUsed = false;

    controller._getRunningProcessDetails = () => {
      const processes = [
        {
          Id: 201,
          ProcessName: 'chrome',
          MainWindowTitle: '',
          MainWindowHandle: 0,
          Path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        }
      ];

      if (!visibleWindowClosed) {
        processes.push({
          Id: 200,
          ProcessName: 'chrome',
          MainWindowTitle: 'Google Chrome',
          MainWindowHandle: 789,
          Path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        });
      }

      return processes;
    };
    controller._closeProcessesGracefully = (processes) => {
      assert.equal(processes.length, 1);
      assert.equal(processes[0].Id, 200);
      visibleWindowClosed = true;
      return true;
    };
    controller._forceTerminateProcesses = () => {
      forcedTerminationUsed = true;
      return true;
    };
    controller._sleep = () => {};

    const result = await controller.close('chrome');

    assert.equal(result.success, true);
    assert.equal(forcedTerminationUsed, false);
  });

  it('should not report browser close success while the visible window remains', async function() {
    const controller = new AppController({});
    let forcedTerminationUsed = false;

    controller._getRunningProcessDetails = () => ([
      {
        Id: 200,
        ProcessName: 'chrome',
        MainWindowTitle: 'New Tab - Google Chrome',
        MainWindowHandle: 789,
        Path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      }
    ]);
    controller._closeProcessesGracefully = (processes) => {
      assert.equal(processes.length, 1);
      assert.equal(processes[0].Id, 200);
      return true;
    };
    controller._forceTerminateProcesses = () => {
      forcedTerminationUsed = true;
      return true;
    };
    controller._sleep = () => {};

    const result = await controller.close('chrome');

    assert.equal(result.success, false);
    assert.match(result.error, /Could not close every chrome browser window/);
    assert.equal(forcedTerminationUsed, false);
  });

  it('should close all matching browser windows after confirmation', async function() {
    const controller = new AppController({});
    let closeAttempted = false;
    let closed = false;

    controller._getRunningProcessDetails = () => closed ? [] : ([
      {
        Id: 200,
        ProcessName: 'chrome',
        MainWindowTitle: 'Project A - Google Chrome',
        MainWindowHandle: 789,
        Path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      },
      {
        Id: 201,
        ProcessName: 'chrome',
        MainWindowTitle: 'Project B - Google Chrome',
        MainWindowHandle: 790,
        Path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      }
    ]);
    controller._closeProcessesGracefully = () => {
      closeAttempted = true;
      closed = true;
      return true;
    };
    controller._sleep = () => {};

    const result = await controller.close('chrome');

    assert.equal(result.success, true);
    assert.equal(result.data.closedCount, 2);
    assert.equal(closeAttempted, true);
  });

  it('should focus an existing app instead of asking to open a duplicate', async function() {
    const controller = new AppController({});

    controller._getRunningProcessDetails = () => ([{
      Id: 300,
      ProcessName: 'SampleApp',
      MainWindowTitle: 'Sample App',
      MainWindowHandle: 123,
      Path: 'C:\\Program Files\\SampleApp\\SampleApp.exe'
    }]);
    controller._launchSpecialApp = () => ({ success: false });
    controller._resolveStartApp = () => null;
    controller._commandExists = () => true;
    controller._sleep = () => {};
    controller.windowSession.focusWindow = () => ({
      success: true,
      data: { matchedWindow: 'Sample App', processName: 'SampleApp' }
    });

    const result = await controller.open('sample app');

    assert.equal(result.success, true);
    assert.equal(result.data.launchMethod, 'focus-existing');
    assert.equal(result.data.verified, true);
  });

  it('should prefer known command launchers before Start menu entries for known apps', async function() {
    const childProcess = require('child_process');
    const fs = require('fs');
    const originalExecFile = childProcess.execFile;
    const originalExistsSync = fs.existsSync;
    const appsPath = require.resolve('../../core/automation/apps');
    const launcherPath = require.resolve('../../core/automation/common/launcher');
    const previousApps = require.cache[appsPath];
    const previousLauncher = require.cache[launcherPath];
    let launchedCommand = '';

    try {
      delete require.cache[appsPath];
      delete require.cache[launcherPath];
      fs.existsSync = (target) => {
        if (String(target).toLowerCase().includes('google\\chrome\\application\\chrome.exe')) {
          return false;
        }
        return originalExistsSync(target);
      };
      childProcess.execFile = (command, args, options, callback) => {
        if (command === 'where.exe') {
          callback(null, '');
          return;
        }
        const serialized = Array.isArray(args) ? args.join(' ') : '';
        if (command === 'powershell.exe' && serialized.includes("Start-Process -FilePath 'chrome'")) {
          launchedCommand = 'chrome';
          callback(null, '');
          return;
        }
        if (command === 'powershell.exe' && serialized.includes('Get-StartApps')) {
          callback(null, JSON.stringify([{ Name: 'Google Chrome', AppID: 'C:\\Users\\rakes\\AppData\\Chrome' }]));
          return;
        }
        return originalExecFile(command, args, options, callback);
      };

      const FreshAppController = require('../../core/automation/apps');
      const controller = new FreshAppController({});
      controller._getRunningProcessDetails = () => [];
      controller.windowSession.findWindow = () => null;
      let startMenuUsed = false;
      controller._launchStartApp = () => {
        startMenuUsed = true;
      };

      const result = await controller.open('chrome');

      assert.equal(result.success, true);
      assert.equal(result.data.launchMethod, 'command');
      assert.equal(launchedCommand, 'chrome');
      assert.equal(startMenuUsed, false);
    } finally {
      childProcess.execFile = originalExecFile;
      fs.existsSync = originalExistsSync;
      delete require.cache[appsPath];
      delete require.cache[launcherPath];
      if (previousApps) require.cache[appsPath] = previousApps;
      if (previousLauncher) require.cache[launcherPath] = previousLauncher;
    }
  });

  it('should cache command existence checks to avoid repeated where.exe calls', async function() {
    const childProcess = require('child_process');
    const originalExecFile = childProcess.execFile;
    const appsPath = require.resolve('../../core/automation/apps');
    const previousApps = require.cache[appsPath];
    let whereCalls = 0;

    try {
      delete require.cache[appsPath];
      childProcess.execFile = (command, args, options, callback) => {
        if (command === 'where.exe') {
          whereCalls += 1;
          if (args[0] === 'known-command') {
            callback(null, '');
            return;
          }
          const error = new Error('not found');
          error.status = 1;
          callback(error);
          return;
        }
        return originalExecFile(command, args, options, callback);
      };

      const FreshAppController = require('../../core/automation/apps');
      const controller = new FreshAppController({});

      assert.equal(await controller._commandExists('known-command'), true);
      assert.equal(await controller._commandExists('known-command'), true);
      assert.equal(await controller._commandExists('missing-command'), false);
      assert.equal(await controller._commandExists('missing-command'), false);
      assert.equal(whereCalls, 2);
    } finally {
      childProcess.execFile = originalExecFile;
      delete require.cache[appsPath];
      if (previousApps) require.cache[appsPath] = previousApps;
    }
  });

  it('should close window-targeted apps by visible window before process fallback', async function() {
    const controller = new AppController({});
    let windowCloseAttempted = false;
    let processCloseAttempted = false;

    controller._closeAppWindow = (name) => {
      windowCloseAttempted = name === 'instagram';
      return { success: true, data: { app: name, closeMethod: 'window' } };
    };
    controller._closeProcessesGracefully = () => {
      processCloseAttempted = true;
      return true;
    };

    const result = await controller.close('instagram');

    assert.equal(result.success, true);
    assert.equal(result.data.closeMethod, 'window');
    assert.equal(windowCloseAttempted, true);
    assert.equal(processCloseAttempted, false);
  });

  it('should open when the user confirms a new app window', async function() {
    const controller = new AppController({});
    let launched = null;
    const windowCounts = [1, 2];
    controller._countAppWindows = () => windowCounts.shift() ?? 2;

    controller._getRunningProcessDetails = () => ([{
      Id: 300,
      ProcessName: 'SampleApp',
      MainWindowTitle: 'Sample App',
      MainWindowHandle: 123,
      Path: 'C:\\Program Files\\SampleApp\\SampleApp.exe'
    }]);
    controller._launchSpecialApp = () => ({ success: false });
    controller._resolveStartApp = () => ({ name: 'Sample App', appId: 'Sample.App' });
    controller._launchStartApp = (startApp) => {
      launched = startApp;
    };

    const result = await controller.open('sample app', { forceNewWindow: true });

    assert.equal(result.success, true);
    assert.equal(launched.appId, 'Sample.App');
    assert.equal(result.data.requestedOperation, 'open-new-window');
    assert.equal(result.data.forceNewWindow, true);
    assert.equal(result.data.beforeWindowCount, 1);
    assert.equal(result.data.afterWindowCount, 2);
    assert.equal(result.data.newWindowVerified, true);
  });

  it('should launch Chrome with an explicit new-window argument', async function() {
    const fs = require('fs');
    const appsPath = require.resolve('../../core/automation/apps');
    const launcherPath = require.resolve('../../core/automation/common/launcher');
    const previousApps = require.cache[appsPath];
    const previousLauncher = require.cache[launcherPath];
    const originalExistsSync = fs.existsSync;
    let launch = null;

    try {
      delete require.cache[appsPath];
      require.cache[launcherPath] = {
        id: launcherPath,
        filename: launcherPath,
        loaded: true,
        exports: {
          launchTarget(target, args) {
            launch = { target, args };
          }
        }
      };
      fs.existsSync = target => String(target).toLowerCase().endsWith('chrome.exe') || originalExistsSync(target);
      const FreshAppController = require('../../core/automation/apps');
      const controller = new FreshAppController({});
      const counts = [1, 2];
      controller._countAppWindows = () => counts.shift() ?? 2;

      const result = await controller.open('chrome', {
        requestedOperation: 'open-new-window',
        forceNewWindow: true
      });

      assert.equal(result.success, true);
      assert.deepEqual(launch.args, ['--new-window']);
      assert.equal(result.data.newWindowVerified, true);
    } finally {
      fs.existsSync = originalExistsSync;
      delete require.cache[appsPath];
      delete require.cache[launcherPath];
      if (previousApps) require.cache[appsPath] = previousApps;
      if (previousLauncher) require.cache[launcherPath] = previousLauncher;
    }
  });

  it('should launch another VS Code window through the command instead of Start menu', async function() {
    const appsPath = require.resolve('../../core/automation/apps');
    const launcherPath = require.resolve('../../core/automation/common/launcher');
    const previousApps = require.cache[appsPath];
    const previousLauncher = require.cache[launcherPath];
    let launch = null;

    try {
      delete require.cache[appsPath];
      require.cache[launcherPath] = {
        id: launcherPath,
        filename: launcherPath,
        loaded: true,
        exports: {
          launchTarget(target, args) {
            launch = { target, args };
          }
        }
      };
      const FreshAppController = require('../../core/automation/apps');
      const controller = new FreshAppController({});
      const counts = [1, 2];
      controller._countAppWindows = () => counts.shift() ?? 2;
      controller._sleep = () => {};
      controller._launchSpecialApp = () => ({ success: false });
      controller._commandExists = command => command === 'code';
      controller._resolveStartApp = () => {
        throw new Error('Start menu must not be used for an explicit new VS Code window');
      };

      const result = await controller.open('visual studio code', {
        requestedOperation: 'open-new-window',
        forceNewWindow: true
      });

      assert.equal(result.success, true);
      assert.deepEqual(launch, { target: 'code', args: ['--new-window'] });
      assert.equal(result.data.launchMethod, 'command');
      assert.equal(result.data.newWindowVerified, true);
    } finally {
      delete require.cache[appsPath];
      delete require.cache[launcherPath];
      if (previousApps) require.cache[appsPath] = previousApps;
      if (previousLauncher) require.cache[launcherPath] = previousLauncher;
    }
  });

  it('should wait for a delayed VS Code window and preserve its strict display name', async function() {
    const controller = new AppController({});
    const counts = [1, 2];
    const delays = [];
    controller._countAppWindows = () => counts.shift() ?? 2;
    controller._sleep = milliseconds => delays.push(milliseconds);

    const result = await controller._completeAppOpen('code', {
      success: true,
      data: { app: 'code', launchMethod: 'command' }
    }, {
      forceNewWindow: true,
      requestedOperation: 'open-new-window',
      beforeWindowCount: 1,
      launchArgs: ['--new-window'],
      displayName: 'visual studio code'
    });

    assert.equal(result.data.app, 'visual studio code');
    assert.equal(result.data.appId, 'code');
    assert.equal(result.data.newWindowVerified, true);
    assert.deepEqual(delays, [600, 350]);
  });

  it('should open a new Notepad tab in Notepad, never in Chrome', async function() {
    const controller = new AppController({});
    controller.findVisibleApp = () => ({
      Id: 50,
      ProcessName: 'Notepad',
      MainWindowTitle: 'Notes - Notepad',
      MainWindowHandle: 100
    });
    controller._resolveProcessCandidates = () => ['Notepad'];
    let controlled = null;
    controller.windowSession.sendKeys = (windowName, keys, options) => {
      controlled = { windowName, keys, options };
      return {
        success: true,
        data: { matchedWindow: 'Notes - Notepad', processName: 'Notepad' }
      };
    };

    const result = await controller.openNewTab('notepad');

    assert.equal(result.success, true);
    assert.equal(controlled.windowName, 'Notes - Notepad');
    assert.equal(controlled.keys, '^n');
    assert.deepEqual(controlled.options.preferredProcessNames, ['Notepad']);
    assert.equal(result.data.app, 'notepad');
    assert.equal(result.data.verified, true);
  });

  it('should stop new-window verification immediately when observation is unavailable', async function() {
    const controller = new AppController({});
    let observations = 0;
    controller._countAppWindows = () => {
      observations += 1;
      return null;
    };
    controller._sleep = () => {
      throw new Error('unavailable observation must not be retried');
    };

    const result = await controller._completeAppOpen('chrome', {
      success: true,
      data: { app: 'chrome', launchMethod: 'executable' }
    }, {
      forceNewWindow: true,
      requestedOperation: 'open-new-window',
      beforeWindowCount: 1,
      launchArgs: ['--new-window']
    });

    assert.equal(observations, 1);
    assert.equal(result.data.newWindowVerified, null);
    assert.equal(result.data.verificationMethod, 'top-level-window-count-unavailable');
  });

  it('should not treat a YouTube Chrome PWA as an open Chrome browser', async function() {
    const controller = new AppController({});
    let fallbackOptions = null;

    controller._getRunningProcessDetails = () => ([{
      Id: 901,
      ProcessName: 'chrome',
      MainWindowTitle: 'Music - YouTube',
      MainWindowHandle: 456,
      Path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    }]);
    controller.windowSession.listProcessWindows = () => [];
    controller.windowSession.findWindow = (_query, options) => {
      fallbackOptions = options;
      return null;
    };

    assert.equal(await controller.findVisibleApp('google chrome'), null);
    assert.equal(fallbackOptions.requireTitleTokenMatch, true);
    assert.deepEqual(fallbackOptions.preferredTitleTokens, ['chrome']);
  });

  it('should find a regular Chrome window when Get-Process reports a PWA window', async function() {
    const controller = new AppController({});
    controller._getRunningProcessDetails = () => ([{
      Id: 901,
      ProcessName: 'chrome',
      MainWindowTitle: 'Music - YouTube',
      MainWindowHandle: 456,
      Path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    }]);
    controller.windowSession.listProcessWindows = processNames => {
      assert.ok(processNames.includes('chrome'));
      return [
        { id: 901, processName: 'chrome', title: 'Music - YouTube', handle: 456 },
        { id: 901, processName: 'chrome', title: 'OpenX - Google Chrome', handle: 789 }
      ];
    };

    const found = await controller.findVisibleApp('chrome', { allowWindowFallback: false });

    assert.ok(found);
    assert.equal(found.MainWindowTitle, 'OpenX - Google Chrome');
    assert.equal(found.MainWindowHandle, 789);
  });

  it('should resolve and launch installed Store apps such as Instagram', async function() {
    const controller = new AppController({});
    let launched = null;

    controller.findVisibleApp = () => null;
    controller._launchSpecialApp = () => ({ success: false });
    controller._resolveStartApp = name => {
      assert.equal(name, 'instagram');
      return { name: 'Instagram', appId: 'Facebook.InstagramBeta_8xx8rvfyw5nnt!App' };
    };
    controller._launchStartApp = startApp => {
      launched = startApp;
    };

    const result = await controller.open('instgram');

    assert.equal(result.success, true);
    assert.equal(result.data.launchMethod, 'start-menu');
    assert.equal(launched.name, 'Instagram');
  });

  it('should try Start menu before web fallback launchers', async function() {
    const controller = new AppController({});
    let launched = null;
    let specialUsed = false;

    controller.findVisibleApp = () => null;
    controller._resolveStartApp = name => {
      assert.equal(name, 'youtube');
      return { name: 'YouTube', appId: 'YouTube.App' };
    };
    controller._launchStartApp = startApp => {
      launched = startApp;
    };
    controller._launchSpecialApp = () => {
      specialUsed = true;
      return { success: true };
    };

    const result = await controller.open('youtube');

    assert.equal(result.success, true);
    assert.equal(result.data.launchMethod, 'start-menu');
    assert.equal(launched.appId, 'YouTube.App');
    assert.equal(specialUsed, false);
  });

it('should always search the system before falling back to the web, even with a fallback URL', async function() {
    const controller = new AppController({});
    let launched = null;

    controller.findVisibleApp = () => null;
    controller._resolveStartApp = () => ({ name: 'YouTube', appId: 'YouTube.App' });
    controller._launchStartApp = startApp => {
      launched = startApp;
    };
    controller._launchSpecialApp = () => {
      throw new Error('special launcher should be skipped for web fallback apps');
    };

    const result = await controller.open('youtube', {
      webFallbackUrl: 'https://www.youtube.com/',
      webFallbackBrowser: 'chrome'
    });

    assert.equal(result.success, true);
    assert.equal(result.data.launchMethod, 'start-menu');
    assert.equal(launched.appId, 'YouTube.App');
  });

  it('should ask before opening the web when the app is not installed locally', async function() {
    const controller = new AppController({});

    controller.findVisibleApp = () => null;
    controller._resolveStartApp = () => null;
    controller._getStartApps = async () => [];
    controller._launchSpecialApp = () => ({ success: false });

    const result = await controller.open('youtube', {
      webFallbackUrl: 'https://www.youtube.com/',
      webFallbackBrowser: 'chrome'
    });

    assert.equal(result.success, false);
    assert.equal(result.needsClarification, true);
    assert.equal(result.data.clarificationType, 'app.open.webFallback');
    assert.equal(result.data.webFallbackUrl, 'https://www.youtube.com/');
    assert.equal(result.data.confirmEntities.webRequested, true);
    assert.equal(result.data.confirmEntities.webFallbackUrl, 'https://www.youtube.com/');
  });

  it('should defer directly to the web when the user explicitly requests it', async function() {
    const controller = new AppController({});

    controller.findVisibleApp = () => {
      throw new Error('local lookup should not run when the user explicitly requests web');
    };

    const result = await controller.open('youtube', {
      webFallbackUrl: 'https://www.youtube.com/',
      webFallbackBrowser: 'chrome',
      webRequested: true
    });

    assert.equal(result.success, false);
    assert.equal(result.data.launchMethod, 'web-fallback-deferred');
    assert.equal(result.data.webFallbackUrl, 'https://www.youtube.com/');
  });

  it('should honor explicit native app preference for trusted web fallback launchers', async function() {
    const controller = new AppController({});
    let launched = null;

    controller.findVisibleApp = () => null;
    controller._resolveStartApp = () => ({ name: 'YouTube', appId: 'YouTube.App' });
    controller._launchStartApp = startApp => {
      launched = startApp;
    };

    const result = await controller.open('youtube', {
      webFallbackUrl: 'https://www.youtube.com/',
      webFallbackBrowser: 'chrome',
      preferLocalApp: true
    });

    assert.equal(result.success, true);
    assert.equal(result.data.launchMethod, 'start-menu');
    assert.equal(launched.appId, 'YouTube.App');
  });

  it('should never force terminate shared Windows host processes', async function() {
    const controller = new AppController({});
    const terminated = await controller._forceTerminateProcesses([{
      Id: 400,
      ProcessName: 'ApplicationFrameHost',
      MainWindowTitle: 'Instagram'
    }]);

    assert.equal(terminated, false);
  });

  it('should exclude YouTube windows from Chrome window fallback', async function() {
    const controller = new AppController({});
    let fallbackOptions = null;

    controller._getRunningProcessDetails = () => [];
    controller.windowSession.closeWindow = (windowQuery, options) => {
      fallbackOptions = options;
      assert.equal(windowQuery, 'chrome');
      return { success: false, error: 'Window not found: chrome' };
    };

    const result = await controller.close('chrome');

    assert.equal(result.success, false);
    assert.equal(fallbackOptions.requireTitleTokenMatch, true);
    assert.deepEqual(fallbackOptions.preferredTitleTokens, ['chrome']);
  });

  it('should not close a browser window when an unknown app name only matches the tab title', async function() {
    const controller = new AppController({});
    let closedWindow = false;

    controller._getRunningProcessDetails = () => [];
    controller.windowSession.findWindow = (windowQuery) => {
      assert.equal(windowQuery, 'chatgpt');
      return {
        id: 401,
        title: 'ChatGPT - Google Chrome',
        handle: 9001,
        processName: 'chrome'
      };
    };
    controller.windowSession.closeWindow = () => {
      closedWindow = true;
      return { success: true, data: { matchedWindow: 'ChatGPT - Google Chrome', processName: 'chrome' } };
    };

    const result = await controller.close('chatgpt');

    assert.equal(result.success, false);
    assert.equal(closedWindow, false);
    assert.match(result.error, /browser tab/i);
  });

  it('should treat a regular YouTube tab as part of Chrome, not as a PWA', async function() {
    const controller = new AppController({});
    controller._getRunningProcessDetails = () => ([{
      Id: 902,
      ProcessName: 'chrome',
      MainWindowTitle: 'YouTube - Google Chrome',
      MainWindowHandle: 457,
      Path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    }]);

    const target = await controller.findVisibleApp('chrome', { allowWindowFallback: false });
    assert.equal(target.Id, 902);
  });

  it('should resolve the first existing executable from install-location candidates', async function() {
    const controller = new AppController({});
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-app-paths-'));
    const executablePath = path.join(tempDir, 'Example.exe');

    try {
      fs.writeFileSync(executablePath, '', 'utf8');

      const resolved = controller._resolveExecutablePath({
        paths: [
          path.join(tempDir, 'missing.exe'),
          executablePath
        ]
      });

      assert.equal(resolved, executablePath);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should reject invalid app names before automation starts', async function() {
    const controller = new AppController({});
    let processListed = false;
    controller._getRunningProcessDetails = () => {
      processListed = true;
      return [];
    };

    const result = await controller.open('bad\u0000app');

    assert.equal(result.success, false);
    assert.equal(result.code, 'app.open.validation');
    assert.equal(processListed, false);
  });

  it('should not report selected close success when verification fails', async function() {
    const controller = new AppController({});
    controller._resolveProcessCandidates = () => ['notepad'];
    controller._findRunningProcesses = () => ([{
      Id: 42,
      ProcessName: 'notepad',
      MainWindowTitle: 'Untitled - Notepad',
      MainWindowHandle: 123
    }]);
    controller._closeProcessesGracefully = () => true;
    controller._forceTerminateProcesses = () => true;
    controller._sleep = () => {};

    const result = await controller.close('notepad', { processId: 42 });

    assert.equal(result.success, false);
    assert.match(result.error, /Could not verify/);
    assert.equal(result.data.verified, false);
  });

  it('should switch apps without shell-interpolating the app name', async function() {
    const childProcess = require('child_process');
    const appsPath = require.resolve('../../core/automation/apps');
    const originalExecFile = childProcess.execFile;
    const previousApps = require.cache[appsPath];
    let commandArgs = null;

    try {
      delete require.cache[appsPath];
      childProcess.execFile = (command, args, options, callback) => {
        assert.equal(command, 'powershell.exe');
        commandArgs = args;
        if (typeof callback === 'function') callback(null, '');
      };
      const FreshAppController = require('../../core/automation/apps');
      const controller = new FreshAppController({});
      controller.findVisibleApp = () => ({
        ProcessName: 'notepad',
        MainWindowTitle: "Bob's Notes - Notepad"
      });
      controller._resolveProcessCandidates = () => ['notepad'];

      const result = await controller.switchTo('notepad');

      assert.equal(result.success, true);
      assert.ok(Array.isArray(commandArgs));
      assert.ok(commandArgs.includes('-Command'));
      assert.match(commandArgs[commandArgs.length - 1], /Bob''s Notes - Notepad/);
    } finally {
      childProcess.execFile = originalExecFile;
      delete require.cache[appsPath];
      if (previousApps) require.cache[appsPath] = previousApps;
    }
  });

  it('should return structured running app window metadata', async function() {
    const childProcess = require('child_process');
    const appsPath = require.resolve('../../core/automation/apps');
    const originalExecFile = childProcess.execFile;
    const previousApps = require.cache[appsPath];

    try {
      delete require.cache[appsPath];
      childProcess.execFile = (command, args, options, callback) => {
        if (typeof callback === 'function') {
          callback(null, JSON.stringify([{
            Id: 10,
            ProcessName: 'notepad',
            MainWindowTitle: 'Notes - Notepad',
            MainWindowHandle: 100
          }]));
        }
      };
      const FreshAppController = require('../../core/automation/apps');
      const controller = new FreshAppController({});

      const result = await controller.getRunningApps();

      assert.equal(result.success, true);
      assert.equal(result.data.count, 1);
      assert.deepEqual(result.data.processes, ['notepad']);
      assert.equal(result.data.windows[0].title, 'Notes - Notepad');
      assert.equal(result.data.verified, true);
    } finally {
      childProcess.execFile = originalExecFile;
      delete require.cache[appsPath];
      if (previousApps) require.cache[appsPath] = previousApps;
    }
  });
});
