const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Automation Engine', function() {
  let AutomationEngine;

  before(function() {
    AutomationEngine = require('../../core/automation/index');
  });

  it('should register all default actions', function() {
    const engine = new AutomationEngine({});
    const actions = engine.getActions();
    assert.ok(actions.includes('volume.set'));
    assert.ok(actions.includes('app.open'));
    assert.ok(actions.includes('app.newTab'));
    assert.ok(actions.includes('mode.start'));
    assert.ok(actions.includes('file.create'));
    assert.ok(actions.includes('file.open'));
    assert.ok(actions.includes('file.list'));
    assert.ok(actions.includes('folder.create'));
    assert.ok(actions.includes('folder.move'));
    assert.ok(actions.includes('phone.sendFile'));
    assert.ok(actions.includes('browser.open'));
    assert.ok(actions.includes('browser.search'));
    assert.ok(actions.includes('browser.closeTab'));
    assert.ok(actions.includes('browser.listTabs'));
    assert.ok(actions.includes('form.fill'));
    assert.ok(actions.includes('message.compose'));
    assert.ok(actions.includes('email.compose'));
    assert.ok(actions.includes('call.start'));
    assert.ok(actions.includes('timer.set'));
    assert.ok(actions.includes('alarm.set'));
    assert.ok(actions.includes('reminder.set'));
    assert.ok(actions.includes('system.status'));
    assert.ok(actions.includes('system.time'));
    assert.ok(actions.includes('system.date'));
    assert.ok(actions.includes('system.calculate'));
    assert.ok(actions.includes('system.screenshot'));
    assert.ok(actions.includes('system.shutdown'));
    assert.ok(actions.includes('window.minimize'));
    assert.ok(actions.includes('help'));
    assert.ok(actions.includes('greeting'));
    assert.ok(actions.includes('thanks'));
  });

  it('should parse alarm times that include today', function() {
    const SchedulerController = require('../../core/automation/scheduler');
    const scheduler = new SchedulerController({});

    const timeThenToday = scheduler._parseTimeExpression('2:43 pm today');
    const todayThenTime = scheduler._parseTimeExpression('today at 2:43 pm');

    assert.ok(timeThenToday instanceof Date);
    assert.ok(todayThenTime instanceof Date);
    assert.equal(timeThenToday.getHours(), 14);
    assert.equal(timeThenToday.getMinutes(), 43);
    assert.equal(todayThenTime.getHours(), 14);
    assert.equal(todayThenTime.getMinutes(), 43);
  });

  it('should schedule one reminder for each explicit reminder time expression', async function() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-multi-reminder-'));
    const engine = new AutomationEngine({ app: { dataDir: tempDir } });

    try {
      const result = await engine.execute('reminder.set', {
        reminderText: 'mark attendance',
        timeExpressions: ['9:30 pm', '9:55 pm'],
        timeExpression: '9:30 pm',
        recurrence: 'daily',
        reminderCategory: 'work'
      });

      assert.equal(result.success, true);
      assert.equal(result.data.count, 2);
      assert.equal(result.data.entries.length, 2);
      assert.equal(result.data.entries[0].message, 'mark attendance');
      assert.equal(result.data.entries[1].message, 'mark attendance');
      assert.equal(result.data.entries[0].recurrence, 'daily');
      assert.equal(result.data.entries[1].recurrence, 'daily');
    } finally {
      engine.scheduler.destroy();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should fill extracted form fields from saved personal context', async function() {
    const engine = new AutomationEngine({});
    const result = await engine.execute('form.fill', {
      userFacts: {
        name: 'Rakesh',
        email: 'rakesh@example.com',
        phone: '+919876543210'
      },
      fields: [
        { name: 'Name', required: true },
        { name: 'Gmail', required: true },
        { name: 'Phone Number', required: true }
      ]
    });

    assert.equal(result.success, true);
    assert.equal(result.data.filledData.Name, 'Rakesh');
    assert.equal(result.data.filledData.Gmail, 'rakesh@example.com');
    assert.equal(result.data.filledData['Phone Number'], '+919876543210');
    assert.equal(result.data.skippedFields.length, 0);
    assert.equal(result.data.canSubmit, true);
  });

  it('should fill blank text form templates from saved personal context', async function() {
    const FormAutomation = require('../../plugins/forms');
    const forms = new FormAutomation({});
    const result = await forms.fill({
      userFacts: {
        name: 'Rakesh',
        email: 'rakesh@example.com',
        phone: '+919876543210'
      },
      formText: 'Name:\nGmail:\nPhone Number:'
    });

    assert.equal(result.success, true);
    assert.equal(result.data.filledText, 'Name: Rakesh\nGmail: rakesh@example.com\nPhone Number: +919876543210');
    assert.equal(result.data.filledFields.length, 3);
    assert.equal(result.data.skippedFields.length, 0);
  });

  it('should inspect a Google Form and open a prefilled URL', async function() {
    const FormAutomation = require('../../plugins/forms');
    const opened = [];
    const forms = new FormAutomation({}, {
      browser: {
        open(url) {
          opened.push(url);
          return { success: true, data: { url } };
        }
      }
    });
    forms._resolveUrl = async url => url;
    forms._fetchTextResponse = async url => ({
      finalUrl: url,
      body: '<script>var FB_PUBLIC_LOAD_DATA_ = [null,[null,[[null,"Name",null,0,[[123,null,1]]],[null,"Gmail",null,0,[[456,null,1]]],[null,"Phone Number",null,0,[[789,null,1]]]]]];</script>'
    });

    const result = await forms.fill({
      url: 'https://docs.google.com/forms/d/e/sample/viewform',
      userFacts: {
        name: 'Rakesh',
        email: 'rakesh@example.com',
        phone: '+919876543210'
      }
    });

    assert.equal(result.success, true);
    assert.equal(result.data.mode, 'google-form-prefill');
    assert.equal(result.data.filledFields.length, 3);
    assert.ok(opened[0].includes('usp=pp_url'));
    assert.ok(opened[0].includes('entry.123=Rakesh'));
    assert.ok(opened[0].includes('entry.456=rakesh%40example.com'));
    assert.ok(opened[0].includes('entry.789=%2B919876543210'));
  });

  it('should allow registering custom actions', async function() {
    const engine = new AutomationEngine({});
    engine.registerAction('test.action', () => ({ success: true, data: { value: 42 } }));
    const result = await engine.execute('test.action', {});
    assert.ok(result.success);
    assert.equal(result.data.value, 42);
    assert.equal(result.verification.status, 'unknown');
  });

  it('should open the OpenX Chat surface through desktop actions', async function() {
    let opened = false;
    const engine = new AutomationEngine({
      desktopActions: {
        openPeopleChat: () => {
          opened = true;
          return { success: true };
        }
      }
    });

    const result = await engine.execute('app.open', { appName: 'chat' });

    assert.equal(opened, true);
    assert.equal(result.success, true);
    assert.equal(result.data.action, 'openPeopleChat');
    assert.equal(result.data.app, 'OpenX Chat');
    assert.equal(result.data.launchMethod, 'openx-desktop');
  });

  it('should send assistant message commands through OpenX Chat desktop actions', async function() {
    const sent = [];
    const engine = new AutomationEngine({
      desktopActions: {
        sendOpenXChatMessage(payload) {
          sent.push(payload);
          return {
            success: true,
            data: {
              contactName: 'Rishi',
              messageText: payload.messageText,
              platform: 'openx-chat',
              delivery: 'sent',
              conversationId: `conv_${'b'.repeat(64)}`
            }
          };
        }
      }
    });

    const result = await engine.execute('message.compose', {
      contactName: 'rishi',
      messageText: 'hi'
    });

    assert.equal(result.success, true);
    assert.equal(result.data.contactName, 'Rishi');
    assert.equal(result.data.messageText, 'hi');
    assert.equal(result.data.platform, 'openx-chat');
    assert.equal(result.data.delivery, 'sent');
    assert.equal(result.verification.status, 'passed');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].contactName, 'rishi');
    assert.equal(sent[0].messageText, 'hi');
  });

  it('should open recognized web apps in Chrome only after local app lookup fails', async function() {
    const engine = new AutomationEngine({});
    let opened = null;

    engine.apps.open = appName => ({ success: false, error: `Could not find app: ${appName}` });
    engine.folders.open = () => ({ success: false, error: 'not a folder' });
    engine.browser.checkInternetConnection = async () => true;
    engine.browser.open = (url, options) => {
      opened = { url, options };
      return { success: true, data: { url, browserName: options.browserName } };
    };
    engine.verifier.controllers.apps.waitForVisibleApp = () => null;

    const result = await engine.execute('app.open', {
      appName: 'instagram',
      webFallbackUrl: 'https://www.instagram.com/',
      webFallbackBrowser: 'chrome'
    });

    assert.equal(result.success, true);
    assert.equal(result.data.launchMethod, 'chrome-web-app-fallback');
    assert.equal(opened.options.browserName, 'chrome');
    assert.equal(opened.url, 'https://www.instagram.com/');
    assert.equal(result.data.webFallback, true);
    assert.equal(result.data.webFallbackBrowser, 'chrome');
    assert.equal(result.data.tabQuery, 'instagram');
  });

  it('should not open unknown app requests in Chrome', async function() {
    const engine = new AutomationEngine({});
    let browserOpened = false;

    engine.apps.open = appName => ({ success: false, error: `Could not find app: ${appName}` });
    engine.folders.open = () => ({ success: false, error: 'not a folder' });
    engine.browser.open = () => {
      browserOpened = true;
      return { success: true };
    };

    const result = await engine.execute('app.open', { appName: 'totally unknown app' });

    assert.equal(result.success, false);
    assert.equal(browserOpened, false);
  });

  it('should use web search fallback only when an app request explicitly allows it', async function() {
    const engine = new AutomationEngine({});
    let openedQuery = '';

    engine.apps.open = appName => ({ success: false, error: `Could not find app: ${appName}` });
    engine.folders.open = () => ({ success: false, error: 'not a folder' });
    engine.browser.checkInternetConnection = async () => true;
    engine.browser.openFirstResult = async query => {
      openedQuery = query;
      return {
        success: true,
        data: {
          browserName: 'chrome',
          query,
          title: 'Sparkdeck',
          url: 'https://example.com/sparkdeck',
          launchMethod: 'ranked-search-result'
        }
      };
    };
    engine.verifier.controllers.apps.waitForVisibleApp = () => null;

    const result = await engine.execute('app.open', {
      appName: 'sparkdeck',
      allowWebSearchFallback: true,
      webSearchFallbackQuery: 'sparkdeck',
      webFallbackBrowser: 'chrome'
    });

    assert.equal(result.success, true);
    assert.equal(openedQuery, 'sparkdeck');
    assert.equal(result.data.webFallback, true);
    assert.equal(result.data.webSearchFallback, true);
    assert.equal(result.data.webSearchFallbackQuery, 'sparkdeck');
    assert.equal(result.data.launchMethod, 'ranked-search-result');
  });

  it('should send a resolved local file to the requesting phone device', async function() {
    const tempDir = fs.mkdtempSync(path.join(path.join(os.homedir(), 'Documents'), 'openx-phone-send-'));
    const source = path.join(tempDir, 'report.pdf');
    fs.writeFileSync(source, 'hello', 'utf8');

    const sent = [];
    const engine = new AutomationEngine({
      fileTransferManager: {
        async sendFileToDevice(deviceId, sourcePath) {
          sent.push({ deviceId, sourcePath });
          return {
            record: {
              deviceId,
              fileName: path.basename(sourcePath),
              direction: 'desktop-to-phone'
            }
          };
        }
      }
    });

    const result = await engine.execute('phone.sendFile', {
      path: source,
      transferKind: 'file'
    }, {
      phoneContext: {
        deviceId: 'phone001',
        deviceName: 'Galaxy S25'
      }
    });

    assert.equal(result.success, true);
    assert.deepEqual(sent, [{ deviceId: 'phone001', sourcePath: source }]);
    assert.equal(result.data.deviceId, 'phone001');
    assert.equal(result.data.transferredName, 'report.pdf');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should resolve special folders for phone transfer requests', async function() {
    const home = os.homedir();
    const downloads = path.join(home, 'Downloads');
    fs.mkdirSync(downloads, { recursive: true });

    const sent = [];
    const engine = new AutomationEngine({
      fileTransferManager: {
        async sendFileToDevice(deviceId, sourcePath) {
          sent.push({ deviceId, sourcePath });
          return { record: { deviceId, fileName: path.basename(sourcePath) } };
        }
      }
    });

    const result = await engine.execute('phone.sendFile', {
      path: 'downloads folder',
      transferKind: 'folder'
    }, {
      phoneContext: { deviceId: 'phone001' }
    });

    assert.equal(result.success, true);
    assert.equal(sent[0].sourcePath, downloads);
  });

  it('should choose the only connected phone for chat-origin file transfers', async function() {
    const tempDir = fs.mkdtempSync(path.join(path.join(os.homedir(), 'Documents'), 'openx-phone-send-'));
    const source = path.join(tempDir, 'report.pdf');
    fs.writeFileSync(source, 'hello', 'utf8');

    const sent = [];
    const engine = new AutomationEngine({
      fileTransferManager: {
        getConnectedDevices() {
          return [{ deviceId: 'phone001', deviceName: 'Galaxy S25' }];
        },
        async sendFileToDevice(deviceId, sourcePath) {
          sent.push({ deviceId, sourcePath });
          return { record: { deviceId, fileName: path.basename(sourcePath) } };
        }
      }
    });

    const result = await engine.execute('phone.sendFile', {
      path: source,
      transferKind: 'file'
    });

    assert.equal(result.success, true);
    assert.deepEqual(sent, [{ deviceId: 'phone001', sourcePath: source }]);
    assert.equal(result.data.deviceName, 'Galaxy S25');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should explain phone transfer when no phone or multiple phones are connected', async function() {
    const noPhone = new AutomationEngine({
      fileTransferManager: {
        getConnectedDevices() {
          return [];
        },
        async sendFileToDevice() {
          throw new Error('should not send');
        }
      }
    });

    const noPhoneResult = await noPhone.execute('phone.sendFile', {
      path: 'report.pdf',
      transferKind: 'file'
    });

    assert.equal(noPhoneResult.success, false);
    assert.match(noPhoneResult.error, /No phone is connected/i);

    const multiplePhones = new AutomationEngine({
      fileTransferManager: {
        getConnectedDevices() {
          return [
            { deviceId: 'phone001', deviceName: 'Galaxy S25' },
            { deviceId: 'phone002', deviceName: 'Pixel 10' }
          ];
        },
        async sendFileToDevice() {
          throw new Error('should not send');
        }
      }
    });

    const multipleResult = await multiplePhones.execute('phone.sendFile', {
      path: 'report.pdf',
      transferKind: 'file'
    });

    assert.equal(multipleResult.success, false);
    assert.equal(multipleResult.needsClarification, true);
    assert.match(multipleResult.error, /Galaxy S25/);
    assert.match(multipleResult.error, /Pixel 10/);
  });

  it('should return structured choices when a phone file transfer has multiple matching files', async function() {
    const previousUserProfile = process.env.USERPROFILE;
    const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-phone-choice-'));
    const firstDir = path.join(tempProfile, 'Documents', 'Work');
    const secondDir = path.join(tempProfile, 'Downloads', 'Archive');
    fs.mkdirSync(firstDir, { recursive: true });
    fs.mkdirSync(secondDir, { recursive: true });
    const firstFile = path.join(firstDir, 'resume.docx');
    const secondFile = path.join(secondDir, 'resume.docx');
    fs.writeFileSync(firstFile, 'first', 'utf8');
    fs.writeFileSync(secondFile, 'second', 'utf8');

    process.env.USERPROFILE = tempProfile;
    try {
      const engine = new AutomationEngine({
        fileTransferManager: {
          async sendFileToDevice() {
            throw new Error('should not transfer before user chooses a file');
          }
        }
      });
      const result = await engine.execute('phone.sendFile', {
        path: 'resume.docx',
        transferKind: 'file'
      }, {
        phoneContext: { deviceId: 'phone001', deviceName: 'My Android Phone' }
      });

      assert.equal(result.success, false);
      assert.equal(result.needsClarification, true);
      assert.equal(result.data.clarificationType, 'phone.sendFile.file');
      assert.equal(result.data.matchCount, 2);
      assert.equal(result.data.choices.length, 2);
      assert.ok(result.data.choices.some(choice => choice.path === firstFile));
      assert.ok(result.data.choices.some(choice => choice.path === secondFile));
      assert.ok(result.data.choices.every(choice => choice.entities.selectedPath));
    } finally {
      process.env.USERPROFILE = previousUserProfile;
      fs.rmSync(tempProfile, { recursive: true, force: true });
    }
  });

  it('should constrain phone-origin file transfer searches to spoken locations', async function() {
    const previousUserProfile = process.env.USERPROFILE;
    const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-phone-location-'));
    const desktopFile = path.join(tempProfile, 'Desktop', 'resume.docx');
    const downloadsFile = path.join(tempProfile, 'Downloads', 'resume.docx');
    fs.mkdirSync(path.dirname(desktopFile), { recursive: true });
    fs.mkdirSync(path.dirname(downloadsFile), { recursive: true });
    fs.writeFileSync(desktopFile, 'desktop', 'utf8');
    fs.writeFileSync(downloadsFile, 'downloads', 'utf8');

    const sent = [];
    process.env.USERPROFILE = tempProfile;
    try {
      const engine = new AutomationEngine({
        fileTransferManager: {
          async sendFileToDevice(deviceId, sourcePath) {
            sent.push({ deviceId, sourcePath });
            return { record: { deviceId, fileName: path.basename(sourcePath) } };
          }
        }
      });
      const result = await engine.execute('phone.sendFile', {
        path: 'resume in desktop',
        transferKind: 'file'
      }, {
        phoneContext: { deviceId: 'phone001', deviceName: 'My Android Phone' }
      });

      assert.equal(result.success, true);
      assert.deepEqual(sent, [{ deviceId: 'phone001', sourcePath: desktopFile }]);
    } finally {
      process.env.USERPROFILE = previousUserProfile;
      fs.rmSync(tempProfile, { recursive: true, force: true });
    }
  });

  it('should ask before sending a weak single fuzzy phone file match', async function() {
    const previousUserProfile = process.env.USERPROFILE;
    const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-phone-weak-choice-'));
    const targetDir = path.join(tempProfile, 'Documents', 'Reports');
    fs.mkdirSync(targetDir, { recursive: true });
    const weakMatch = path.join(targetDir, 'Quarterly Project Report.docx');
    fs.writeFileSync(weakMatch, 'report', 'utf8');

    process.env.USERPROFILE = tempProfile;
    try {
      const engine = new AutomationEngine({
        fileTransferManager: {
          async sendFileToDevice() {
            throw new Error('should not transfer before user confirms a weak match');
          }
        }
      });
      const result = await engine.execute('phone.sendFile', {
        path: 'quaterly projet reprt',
        transferKind: 'file'
      }, {
        phoneContext: { deviceId: 'phone001', deviceName: 'My Android Phone' }
      });

      assert.equal(result.success, false);
      assert.equal(result.needsClarification, true);
      assert.equal(result.data.clarificationType, 'phone.sendFile.file');
      assert.equal(result.data.matchCount, 1);
      assert.equal(result.data.choices[0].path, weakMatch);
    } finally {
      process.env.USERPROFILE = previousUserProfile;
      fs.rmSync(tempProfile, { recursive: true, force: true });
    }
  });

  it('should return error for unknown action', async function() {
    const engine = new AutomationEngine({});
    const result = await engine.execute('nonexistent.action', {});
    assert.equal(result.success, false);
    assert.equal(result.validation.status, 'unknown');
    assert.equal(result.verification.status, 'unknown');
  });

  it('should start configured app modes', async function() {
    const engine = new AutomationEngine({
      modes: [
        {
          name: 'gaming',
          apps: [
            { name: 'chrome', instructions: ['search for chatgpt'] },
            { name: 'discord', instructions: [] }
          ],
          commands: ['set volume to 45']
        }
      ]
    });
    const opened = [];
    engine.apps.open = async (appName) => {
      opened.push(appName);
      return { success: true, data: { appName } };
    };

    const result = await engine.execute('mode.start', { modeName: 'gaming' });

    assert.equal(result.success, true);
    assert.deepEqual(opened, ['chrome', 'discord']);
    assert.deepEqual(result.data.opened, ['chrome', 'discord']);
    assert.deepEqual(result.data.commands, ['search for chatgpt in chrome', 'set volume to 45']);
  });

  it('should run separate app instructions for a saved mode', async function() {
    const engine = new AutomationEngine({
      modes: [
        {
          name: 'development',
          apps: [
            { name: 'youtube', instructions: ['set volume to 100', 'play liked songs'] },
            { name: 'chrome', instructions: ['open chatgpt'] },
            { name: 'terminal', instructions: [] }
          ]
        }
      ]
    });
    const opened = [];
    engine.apps.open = async (appName) => {
      opened.push(appName);
      return { success: true, data: { appName } };
    };

    const result = await engine.execute('mode.start', { modeName: 'development' });

    assert.equal(result.success, true);
    assert.deepEqual(opened, ['youtube', 'chrome', 'terminal']);
    assert.deepEqual(result.data.commands, [
      'set volume to 100',
      'play liked songs',
      'search for chatgpt in chrome',
      'open first result for chatgpt'
    ]);
  });

  it('should match heavily misspelled development mode names', async function() {
    const engine = new AutomationEngine({
      modes: [
        { name: 'developement', apps: [], commands: ['set volume to 50'] }
      ]
    });

    const result = await engine.execute('mode.start', { modeName: 'deveopemt' });

    assert.equal(result.success, true);
    assert.deepEqual(result.data.commands, ['set volume to 50']);
  });

  it('should allow command-only modes', async function() {
    const engine = new AutomationEngine({
      modes: [
        { name: 'media', apps: [], commands: ['play liked songs'] }
      ]
    });
    const result = await engine.execute('mode.start', { modeName: 'media' });

    assert.equal(result.success, true);
    assert.deepEqual(result.data.opened, []);
    assert.deepEqual(result.data.commands, ['play liked songs']);
  });

  it('should fail clearly when a configured mode is missing', async function() {
    const engine = new AutomationEngine({ modes: [] });
    const result = await engine.execute('mode.start', { modeName: 'gaming' });

    assert.equal(result.success, false);
    assert.match(result.error, /Mode not found/);
  });

  it('should route volume actions correctly', function() {
    const engine = new AutomationEngine({});
    const actions = engine.getActions();
    assert.ok(actions.includes('volume.set'));
    assert.ok(actions.includes('volume.mute'));
    assert.ok(actions.includes('volume.unmute'));
  });

  it('should route system actions correctly', function() {
    const engine = new AutomationEngine({});
    const actions = engine.getActions();
    assert.ok(actions.includes('system.cpu'));
    assert.ok(actions.includes('system.memory'));
    assert.ok(actions.includes('system.battery'));
    assert.ok(actions.includes('system.disk'));
    assert.ok(actions.includes('system.processes'));
    assert.ok(actions.includes('system.bluetooth'));
    assert.ok(actions.includes('system.time'));
    assert.ok(actions.includes('system.date'));
    assert.ok(actions.includes('system.calculate'));
  });

  it('should return a clean offline message for internet-required actions', async function() {
    const engine = new AutomationEngine({});
    engine.browser.checkInternetConnection = async () => false;

    const result = await engine.execute('browser.search', { query: 'latest tech news' });

    assert.equal(result.success, false);
    assert.equal(result.error, 'Please check your connection.');
  });

  it('should execute local calculations', async function() {
    const engine = new AutomationEngine({});
    const result = await engine.execute('system.calculate', { expression: '20*30 + 5' });

    assert.equal(result.success, true);
    assert.equal(result.data.result, 605);
    assert.equal(result.validation.status, 'passed');
  });

  it('should attach validation and verification evidence to file actions', async function() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-verify-'));
    const originalUserProfile = process.env.USERPROFILE;
    process.env.USERPROFILE = tmpDir;
    const engine = new AutomationEngine({});

    try {
      const result = await engine.execute('file.create', {
        filename: 'verified.txt',
        path: tmpDir
      });

      assert.equal(result.success, true);
      assert.equal(result.validation.status, 'passed');
      assert.equal(result.verification.status, 'passed');
      assert.equal(result.verification.check, 'file-exists');
      assert.equal(fs.existsSync(path.join(tmpDir, 'verified.txt')), true);
    } finally {
      process.env.USERPROFILE = originalUserProfile;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should execute smart file discovery by type, recency, and size', async function() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-smart-find-'));
    const originalUserProfile = process.env.USERPROFILE;
    process.env.USERPROFILE = tempDir;
    const oldFile = path.join(tempDir, 'old-notes.txt');
    const pdfFile = path.join(tempDir, 'resume.pdf');
    const largeFile = path.join(tempDir, 'large.bin');
    fs.writeFileSync(oldFile, 'old', 'utf8');
    fs.writeFileSync(pdfFile, 'resume', 'utf8');
    fs.writeFileSync(largeFile, Buffer.alloc(1024 * 16));
    const oldDate = new Date(Date.now() - 220 * 24 * 60 * 60 * 1000);
    fs.utimesSync(oldFile, oldDate, oldDate);

    try {
      const engine = new AutomationEngine({});
      const pdf = await engine.execute('file.smartFind', {
        location: tempDir,
        fileType: 'pdf',
        sortBy: 'modifiedDesc'
      });
      const large = await engine.execute('file.smartFind', {
        location: tempDir,
        sortBy: 'sizeDesc'
      });
      const stale = await engine.execute('file.smartFind', {
        location: tempDir,
        timeFilter: 'olderThan6MonthsAccess',
        sortBy: 'accessedAsc'
      });

      assert.equal(pdf.success, true);
      assert.equal(pdf.data.entries[0].name, 'resume.pdf');
      assert.equal(large.success, true);
      assert.equal(large.data.entries[0].name, 'large.bin');
      assert.equal(stale.success, true);
      assert.equal(stale.data.entries[0].name, 'old-notes.txt');
    } finally {
      process.env.USERPROFILE = originalUserProfile;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should fail a successful action result when postcondition verification fails', async function() {
    const engine = new AutomationEngine({});
    engine.registerAction('file.create', () => ({
      success: true,
      data: {
        path: path.join(os.tmpdir(), `missing-${Date.now()}.txt`),
        filename: 'missing.txt'
      }
    }));

    const result = await engine.execute('file.create', {
      filename: 'missing.txt'
    });

    assert.equal(result.success, false);
    assert.equal(result.verification.status, 'failed');
    assert.match(result.error, /Expected file was not found/);
  });

  it('should verify app close results against visible windows', async function() {
    const engine = new AutomationEngine({});
    engine.apps.waitForAppClosed = appName => appName === 'chrome';

    const result = await engine.verifier.verify('app.close', { appName: 'chrome' }, {
      success: true,
      data: { app: 'chrome', closeMethod: 'window' }
    });

    assert.equal(result.success, true);
    assert.equal(result.verification.status, 'passed');
    assert.equal(result.verification.check, 'app-closed');
  });

  it('should not fail browser close verification for background processes after windows close', async function() {
    const engine = new AutomationEngine({});
    engine.apps.waitForAppClosed = () => true;

    const result = await engine.verifier.verify('app.close', { appName: 'chrome' }, {
      success: true,
      data: { app: 'chrome', closeMethod: 'window' }
    });

    assert.equal(result.success, true);
    assert.equal(result.verification.status, 'passed');
    assert.equal(result.verification.check, 'app-closed');
  });

  it('should fail app close verification while a matching visible app remains', async function() {
    const engine = new AutomationEngine({});
    engine.apps.waitForAppClosed = () => false;

    const result = await engine.verifier.verify('app.close', { appName: 'instagram' }, {
      success: true,
      data: { app: 'instagram', closeMethod: 'window' }
    });

    assert.equal(result.success, false);
    assert.equal(result.verification.status, 'failed');
    assert.match(result.error, /instagram still appears to be open/);
  });

  it('should verify app launch after a matching window appears', async function() {
    const engine = new AutomationEngine({});
    engine.apps.waitForVisibleApp = appName => ({
      ProcessName: appName,
      MainWindowTitle: 'Instagram'
    });

    const result = await engine.verifier.verify('app.open', { appName: 'instagram' }, {
      success: true,
      data: { app: 'instagram', launchMethod: 'start-menu' }
    });

    assert.equal(result.success, true);
    assert.equal(result.verification.status, 'passed');
    assert.equal(result.verification.check, 'app-open');
  });

  it('should validate and verify explicit new app windows by count increase', function() {
    const engine = new AutomationEngine({});
    const verified = engine.verifier.verify('app.open', {
      appName: 'notepad',
      requestedOperation: 'open-new-window',
      forceNewWindow: true
    }, {
      success: true,
      data: {
        app: 'notepad',
        requestedOperation: 'open-new-window',
        forceNewWindow: true,
        launchMethod: 'executable',
        beforeWindowCount: 1,
        afterWindowCount: 2,
        newWindowVerified: true,
        launchArguments: []
      }
    });
    const wrongAction = engine.verifier.verify('app.open', {
      appName: 'notepad',
      requestedOperation: 'open-new-window',
      forceNewWindow: true
    }, {
      success: true,
      data: {
        app: 'notepad',
        launchMethod: 'focus-existing',
        forceNewWindow: false
      }
    });

    assert.equal(verified.success, true);
    assert.equal(verified.verification.check, 'app-new-window');
    assert.equal(verified.verification.beforeWindowCount, 1);
    assert.equal(verified.verification.afterWindowCount, 2);
    assert.equal(wrongAction.validation.status, 'failed');
    assert.equal(wrongAction.success, false);
  });

  it('should keep a dispatched new-window action successful when observation is unavailable', function() {
    const engine = new AutomationEngine({});
    const result = engine.verifier.verify('app.open', {
      appName: 'chrome',
      requestedOperation: 'open-new-window',
      forceNewWindow: true
    }, {
      success: true,
      data: {
        app: 'chrome',
        requestedOperation: 'open-new-window',
        forceNewWindow: true,
        launchMethod: 'executable',
        newWindowVerified: null
      }
    });

    assert.equal(result.success, true);
    assert.equal(result.verification.status, 'unknown');
    assert.equal(result.verification.blocking, false);
  });

  it('should validate and verify a new tab inside the requested application', async function() {
    const engine = new AutomationEngine({});
    engine.apps.openNewTab = appName => ({
      success: true,
      data: {
        app: appName,
        action: 'new-tab',
        matchedWindow: 'Notes - Notepad',
        shortcut: '^n',
        verified: true
      }
    });

    const result = await engine.execute('app.newTab', { appName: 'notepad' });

    assert.equal(result.success, true);
    assert.equal(result.validation.status, 'passed');
    assert.equal(result.verification.status, 'passed');
    assert.equal(result.verification.check, 'app-new-tab');
  });

  it('should execute expanded local calculation forms', async function() {
    const engine = new AutomationEngine({});
    const cases = [
      ['ehat is teh value of 999+959*9', 9630],
      ['2 to the power of 8', 256],
      ['square root of 144', 12],
      ['25% of 200', 50],
      ['30 percent of 20', 6],
      ['1,000 + 2.5', 1002.5],
      ['absolute value of -15', 15]
    ];

    for (const [expression, expected] of cases) {
      const result = await engine.execute('system.calculate', { expression });
      assert.equal(result.success, true, expression);
      assert.equal(result.data.result, expected, expression);
    }
  });

  it('should execute visible app listing separately from process count', async function() {
    const SystemController = require('../../core/automation/system');
    const system = new SystemController({});
    system.getRunningApps = (entities) => ({
      success: true,
      data: {
        target: 'apps',
        count: 2,
        names: ['chrome', 'spotify'],
        queryApp: entities?.queryApp,
        isOpen: entities?.queryApp === 'chrome'
      }
    });

    const engine = new AutomationEngine({});
    engine.system = system;
    engine._actionMap['system.processes'] = (entities) => entities?.target === 'apps'
      ? engine.system.getRunningApps(entities)
      : engine.system.getProcessCount();

    const result = await engine.execute('system.processes', { target: 'apps', queryApp: 'chrome' });

    assert.equal(result.success, true);
    assert.equal(result.data.target, 'apps');
    assert.equal(result.data.count, 2);
    assert.deepEqual(result.data.names, ['chrome', 'spotify']);
    assert.equal(result.data.queryApp, 'chrome');
    assert.equal(result.data.isOpen, true);
  });

  it('should close targeted browser tabs by title query', async function() {
    const engine = new AutomationEngine({});
    engine._listBrowserTabs = async () => ({ success: true, data: { tabs: [] } });
    let captured = null;
    engine.windows.sendKeys = (windowName, keys, options) => {
      captured = { windowName, keys, options };
      return {
        success: true,
        data: { matchedWindow: 'Google Photos - Google Chrome', matchedHandle: 200 }
      };
    };
    engine.windows.findWindow = () => null;

    const result = await engine.execute('browser.closeTab', {
      browserName: 'chrome',
      tabQuery: 'google photos'
    });

    assert.equal(result.success, true);
    assert.equal(captured.windowName, 'google photos');
    assert.equal(captured.keys, '^w');
    assert.deepEqual(captured.options.preferredProcessNames, ['chrome']);
    assert.deepEqual(captured.options.preferredTitleTokens, ['google', 'photos']);
    assert.equal(captured.options.requireTitleTokenMatch, true);
    assert.equal(result.data.action, 'closeTab');
    assert.equal(result.data.browserName, 'chrome');
    assert.equal(result.data.tabQuery, 'google photos');
    assert.equal(result.data.closedCount, 1);
    assert.equal(result.data.verified, true);
  });

  it('should fail targeted browser tab close without closing a fallback tab', async function() {
    const engine = new AutomationEngine({});
    engine._listBrowserTabs = async () => ({ success: true, data: { tabs: [] } });
    engine.windows.sendKeys = () => ({ success: false, error: 'Window not found' });

    const result = await engine.execute('browser.closeTab', {
      browserName: 'chrome',
      tabQuery: 'google photos'
    });

    assert.equal(result.success, false);
    assert.match(result.error, /Could not find a google photos tab in chrome/);
  });

  it('should not report targeted browser tab close success when verification fails', async function() {
    const engine = new AutomationEngine({});
    engine._listBrowserTabs = async () => ({ success: true, data: { tabs: [] } });
    engine._sleep = () => {};
    engine.windows.sendKeys = () => ({
      success: true,
      data: {
        matchedWindow: 'Google Photos - Google Chrome',
        matchedHandle: 200
      }
    });
    engine.windows.findWindow = () => ({
      handle: 200,
      title: 'Google Photos - Google Chrome',
      processName: 'chrome'
    });

    const result = await engine.execute('browser.closeTab', {
      browserName: 'chrome',
      tabQuery: 'google photos'
    });

    assert.equal(result.success, false);
    assert.equal(result.data.verified, false);
    assert.match(result.error, /still appears to be active/);
  });

  it('should list visible browser tabs from browser windows', async function() {
    const engine = new AutomationEngine({});
    engine.windows.listBrowserTabs = () => [];
    engine.windows.listWindows = () => ([
      { handle: 100, title: 'ChatGPT - Google Chrome', processName: 'chrome' },
      { handle: 200, title: 'Google Photos - Google Chrome', processName: 'chrome' },
      { handle: 300, title: 'Inbox - Microsoft Edge', processName: 'msedge' }
    ]);

    const result = await engine.execute('browser.listTabs', { browserName: 'chrome' });

    assert.equal(result.success, true);
    assert.equal(result.data.count, 2);
    assert.deepEqual(result.data.tabs.map(tab => tab.title), ['ChatGPT', 'Google Photos']);
    assert.equal(result.data.verifiedAllTabs, false);
  });

  it('should verify every open Chrome tab through UI Automation', async function() {
    const engine = new AutomationEngine({});
    engine._getCdpTabs = async () => ({ success: false });
    engine.windows.listBrowserTabs = processNames => {
      assert.deepEqual(processNames, ['chrome']);
      return [
        { title: 'ChatGPT', processName: 'chrome', isActiveTab: true },
        { title: 'GitHub', processName: 'chrome', isActiveTab: false },
        { title: 'Documentation', processName: 'chrome', isActiveTab: false }
      ];
    };

    const result = await engine.execute('browser.listTabs', { browserName: 'chrome' });

    assert.equal(result.success, true);
    assert.equal(result.data.count, 3);
    assert.equal(result.data.verifiedAllTabs, true);
    assert.equal(result.data.limitation, 'ui-automation-tabs');
    assert.deepEqual(result.data.tabs.map(tab => tab.title), ['ChatGPT', 'GitHub', 'Documentation']);
  });

  it('should await DevTools tab discovery and include inactive tabs', async function() {
    const engine = new AutomationEngine({});
    engine._httpGet = async () => JSON.stringify([
      { id: '1', type: 'page', title: 'Active', url: 'https://active.test', active: true },
      { id: '2', type: 'page', title: 'Inactive', url: 'https://inactive.test', active: false },
      { id: '3', type: 'page', title: 'New Tab', url: 'chrome://newtab/', active: false }
    ]);
    engine.windows.listBrowserTabs = () => [];

    const result = await engine.execute('browser.listTabs', { browserName: 'chrome' });

    assert.equal(result.success, true);
    assert.equal(result.data.count, 3);
    assert.equal(result.data.verifiedAllTabs, true);
    assert.deepEqual(result.data.tabs.map(tab => tab.title), ['Active', 'Inactive', 'New Tab']);
  });

  it('should select and close an inactive discovered Chrome tab', async function() {
    const engine = new AutomationEngine({});
    let listed = 0;
    let closed = null;
    engine._sleep = () => {};
    engine._listBrowserTabs = async () => {
      listed += 1;
      return {
        success: true,
        data: {
          tabs: listed === 1
            ? [{ title: 'ChatGPT', processName: 'chrome', isActiveTab: false }]
            : []
        }
      };
    };
    engine.windows.closeBrowserTab = (title, processNames) => {
      closed = { title, processNames };
      return { success: true, data: { title, matchedWindow: 'GitHub - Google Chrome' } };
    };

    const result = await engine.execute('browser.closeTab', {
      browserName: 'chrome',
      tabQuery: 'chatgpt'
    });

    assert.equal(result.success, true);
    assert.equal(result.data.verified, true);
    assert.deepEqual(closed, { title: 'ChatGPT', processNames: ['chrome'] });
  });

  it('should focus an existing named Chrome tab', async function() {
    const engine = new AutomationEngine({});
    let focused = null;
    engine._listBrowserTabs = async () => ({
      success: true,
      data: { tabs: [{ title: 'JioHotstar', processName: 'chrome', isActiveTab: false }] }
    });
    engine.windows.focusBrowserTab = (title, processNames) => {
      focused = { title, processNames };
      return { success: true, data: { title, windowTitle: 'ChatGPT - Google Chrome' } };
    };

    const result = await engine.execute('browser.openTab', {
      browserName: 'chrome',
      tabQuery: 'jio hotstar'
    });

    assert.equal(result.success, true);
    assert.equal(result.data.focusedExistingTab, true);
    assert.equal(result.data.tabTitle, 'JioHotstar');
    assert.deepEqual(focused, { title: 'JioHotstar', processNames: ['chrome'] });
  });

  it('should open a missing named tab in the requested browser', async function() {
    const engine = new AutomationEngine({});
    let search = null;
    engine._listBrowserTabs = async () => ({ success: true, data: { tabs: [] } });
    engine.browser.search = async (query, options) => {
      search = { query, options };
      return { success: true, data: { query, url: 'https://www.google.com/search?q=jio%20hotstar' } };
    };

    const result = await engine.execute('browser.openTab', {
      browserName: 'chrome',
      tabQuery: 'jio hotstar'
    });

    assert.equal(result.success, true);
    assert.equal(result.data.openedNewTab, true);
    assert.deepEqual(search, {
      query: 'jio hotstar',
      options: { openInBrowser: true, browserName: 'chrome' }
    });
  });

  it('should parse human reminder day phrases', function() {
    const SchedulerController = require('../../core/automation/scheduler');
    const scheduler = new SchedulerController({});

    const tomorrow = scheduler._parseTimeExpression('tomorrow 10pm');
    const tomorrowDefault = scheduler._parseTimeExpression('tomorrow');
    const nextSunday = scheduler._parseTimeExpression('next sunday');
    const thisMonthDay = scheduler._parseTimeExpression('12 of this month');
    const nextMonthDay = scheduler._parseTimeExpression('12 next month');
    const nextMonthDayLeading = scheduler._parseTimeExpression('next month 7');
    const slashDate = scheduler._parseTimeExpression('01/12/26 at five pm');
    const monthName = scheduler._parseTimeExpression('december 1 of this year');

    assert.ok(tomorrow instanceof Date);
    assert.ok(tomorrowDefault instanceof Date);
    assert.ok(nextSunday instanceof Date);
    assert.ok(thisMonthDay instanceof Date);
    assert.ok(nextMonthDay instanceof Date);
    assert.ok(nextMonthDayLeading instanceof Date);
    assert.ok(slashDate instanceof Date);
    assert.ok(monthName instanceof Date);
    assert.ok(tomorrow.getTime() > Date.now());
    assert.ok(tomorrowDefault.getTime() > Date.now());
    assert.equal(tomorrowDefault.getHours(), 9);
    assert.equal(tomorrowDefault.getMinutes(), 0);
    assert.ok(nextSunday.getTime() > Date.now());
    assert.equal(thisMonthDay.getDate(), 12);
    assert.equal(thisMonthDay.getHours(), 9);
    assert.equal(nextMonthDay.getDate(), 12);
    assert.equal(nextMonthDay.getHours(), 9);
    assert.equal(nextMonthDayLeading.getDate(), 7);
    assert.equal(slashDate.getHours(), 17);
    assert.equal(monthName.getMonth(), 11);
  });

  it('should preserve and reschedule recurring alarms', function() {
    const SchedulerController = require('../../core/automation/scheduler');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-scheduler-'));
    const scheduler = new SchedulerController({ app: { dataDir: tempDir } });

    try {
      const result = scheduler.setAlarm('6:30 am', 'wake up', { recurrence: 'daily' });
      assert.equal(result.success, true);
      assert.equal(result.data.recurrence, 'daily');
      assert.equal(result.data.alarmLabel, 'wake up');

      const completed = scheduler.complete(result.data.id);
      assert.equal(completed.success, true);
      assert.equal(completed.data.status, 'scheduled');
      assert.equal(completed.data.recurrence, 'daily');
      assert.ok(new Date(completed.data.dueAt).getTime() > new Date(result.data.dueAt).getTime());
    } finally {
      scheduler.destroy();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should schedule recurring weekday alarms on the next matching day', function() {
    const SchedulerController = require('../../core/automation/scheduler');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-scheduler-weekday-'));
    const scheduler = new SchedulerController({ app: { dataDir: tempDir } });

    try {
      const result = scheduler.setAlarm('8 pm', 'eat lunch', { recurrence: 'weekly:saturday,monday' });
      assert.equal(result.success, true);
      assert.equal(result.data.recurrence, 'weekly:saturday,monday');
      const due = new Date(result.data.dueAt);
      assert.ok([1, 6].includes(due.getDay()));
      assert.equal(due.getHours(), 20);
      assert.equal(due.getMinutes(), 0);

      const completed = scheduler.complete(result.data.id);
      const next = new Date(completed.data.dueAt);
      assert.equal(completed.success, true);
      assert.equal(completed.data.status, 'scheduled');
      assert.ok([1, 6].includes(next.getDay()));
      assert.ok(next.getTime() > due.getTime());
    } finally {
      scheduler.destroy();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should route media actions correctly', function() {
    const engine = new AutomationEngine({});
    const actions = engine.getActions();
    assert.ok(actions.includes('media.play'));
    assert.ok(actions.includes('media.next'));
    assert.ok(actions.includes('media.previous'));
    assert.ok(actions.includes('media.pause'));
    assert.ok(actions.includes('media.resume'));
  });
});
