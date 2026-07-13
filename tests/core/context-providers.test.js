const assert = require('assert');

const {
  CONTEXT_LAYER_VERSION,
  ApplicationContext,
  BrowserContext,
  CalendarContext,
  ClipboardContext,
  ContextManager,
  DesktopContext,
  MediaContext,
  ScreenContext,
  SelectionContext,
  SystemContext,
  TimeContext,
  UserContext,
  WindowContext
} = require('../../core/assistant/context');

function contextFixture() {
  return {
    snapshots: {
      activeWindow: { app: 'Code.exe', title: 'OpenX - Visual Studio Code', handle: 101 },
      runningApplications: ['Code.exe', 'chrome.exe', 'chrome.exe'],
      openFolders: ['C:\\Users\\rakes\\Downloads'],
      openWindows: [
        { app: 'Code.exe', title: 'OpenX', handle: 101 },
        { app: 'chrome.exe', title: 'Docs', handle: 102 }
      ],
      browser: {
        currentBrowser: 'Chrome',
        currentUrl: 'https://example.test/docs',
        currentTab: 'Docs',
        currentWebsite: 'Example',
        tabTitle: 'Example Docs',
        lastQuery: 'OpenX context'
      },
      desktop: {
        desktopPath: 'C:\\Users\\rakes\\Desktop',
        recentFiles: ['C:\\Users\\rakes\\Desktop\\Resume.docx']
      },
      screen: {
        width: 1920,
        height: 1080,
        displays: [{ id: 1, width: 1920, height: 1080, primary: true }]
      },
      clipboard: {
        text: 'Copied text '.repeat(60),
        files: ['C:\\Temp\\note.txt']
      },
      system: {
        batteryPercent: 77,
        cpuPercent: 12,
        memoryPercent: 44,
        networkState: 'online'
      },
      calendar: {
        upcoming: [{ id: 'm1', title: 'Meeting', startsAt: '2030-01-01T09:00:00.000Z' }],
        reminders: [{ id: 'r1', message: 'Drink water', dueAt: '2030-01-01T10:00:00.000Z' }]
      },
      media: {
        title: 'Stars and Stripes Forever',
        artist: 'Sousa',
        source: 'Spotify',
        state: 'playing'
      },
      user: {
        name: 'Rakesh',
        email: 'private@example.test',
        preferences: { mediaPlatform: 'spotify' },
        securityProfile: { lockConfigured: true, encryptionEnabled: true }
      },
      selection: {
        selectedText: 'Selected text '.repeat(40),
        selectedFiles: ['C:\\Users\\rakes\\Documents\\Resume.docx'],
        sourceApplication: 'Code.exe'
      }
    },
    workingMemory: {
      currentApplication: 'Code.exe',
      currentBrowser: 'Chrome'
    },
    sessionMemory: {
      recentApplications: ['Code.exe', 'Chrome'],
      recentFiles: ['C:\\Users\\rakes\\Documents\\Report.pdf']
    },
    topic: { type: 'media', label: 'Stars and Stripes Forever' },
    context: {}
  };
}

describe('Assistant Context Providers', function() {
  it('exports a versioned context layer', function() {
    assert.match(CONTEXT_LAYER_VERSION, /^\d+\.\d+\.\d+$/);
  });

  it('normalizes every context provider into bounded command-ready state', async function() {
    const context = contextFixture();
    const providers = [
      new ApplicationContext(),
      new DesktopContext(),
      new BrowserContext(),
      new ScreenContext(),
      new ClipboardContext(),
      new SystemContext(),
      new CalendarContext(),
      new MediaContext(),
      new TimeContext({ now: () => new Date(2030, 0, 1, 20, 30, 0) }),
      new UserContext(),
      new SelectionContext(),
      new WindowContext()
    ];

    for (const provider of providers) {
      await provider.initialize();
      await provider.collect(context);
    }

    assert.equal(context.context.application.focusedApplication, 'Code.exe');
    assert.deepEqual(context.context.runningApplications, ['Code.exe', 'chrome.exe']);
    assert.equal(context.context.browserState.currentUrl, 'https://example.test/docs');
    assert.equal(context.context.desktopState.recentFiles[0], 'C:\\Users\\rakes\\Desktop\\Resume.docx');
    assert.equal(context.context.screen.displayCount, 1);
    assert.equal(context.context.clipboard.hasText, true);
    assert.equal(context.context.system.batteryPercent, 77);
    assert.equal(context.context.calendar.nextEvent.title, 'Meeting');
    assert.equal(context.context.media.title, 'Stars and Stripes Forever');
    assert.equal(context.context.time.partOfDay, 'evening');
    assert.equal(context.context.user.email, undefined);
    assert.equal(context.context.user.securityProfile.encryptionEnabled, true);
    assert.equal(context.context.selections.selectedFile.name, 'Resume.docx');
    assert.equal(context.context.windows.openWindowCount, 2);
  });

  it('keeps context history compact, target-aware, and secret-safe', function() {
    const manager = new ContextManager({ logging: { console: false, file: false } });
    manager.record('find secret report', {}, {
      success: true,
      intent: 'file.search',
      entities: {
        query: 'report',
        apiKey: 'sk-should-not-be-stored',
        nested: { password: 'hidden', visible: 'ok' }
      },
      data: {
        query: 'report',
        results: Array.from({ length: 20 }, (_, index) => ({
          name: `Report ${index}`,
          path: `C:\\Temp\\Report-${index}.pdf`,
          contents: 'x'.repeat(2000)
        })),
        token: 'secret-token'
      },
      response: 'Found reports.'
    });
    manager.setSessionData('large', { payload: 'x'.repeat(8000), password: 'hidden' });

    const history = manager.getHistory(1)[0];
    assert.equal(history.domain, 'file');
    assert.equal(history.target, 'report');
    assert.equal(history.entities.apiKey, undefined);
    assert.equal(history.entities.nested.password, undefined);
    assert.equal(history.data.results.length, 3);
    assert.equal(history.data.token, undefined);
    assert.equal(manager.getRecentActionTargets(1)[0].target, 'report');
    assert.equal(manager.getSessionData('large').password, undefined);
    assert.ok(manager.getSessionData('large').payload.length <= 300);
  });
});
