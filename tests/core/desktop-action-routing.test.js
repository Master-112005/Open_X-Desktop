const assert = require('assert');

describe('Desktop action routing and anti-hallucination guards', function() {
  this.timeout(15000);

  let Assistant;
  let ActionRouter;

  before(function() {
    Assistant = require('../../core/assistant/index');
    ActionRouter = require('../../core/assistant/automation/ActionRouter');
  });

  function createAssistant(router, localLlm) {
    return new Assistant({
      assistant: { displayName: 'OpenX', honorific: '' },
      localLlm: { enabled: true }
    }, {
      router,
      localLlm,
      automation: {},
      eventBus: { publish() {} }
    });
  }

  function createRouter(executed) {
    const config = {
      permissions: { levels: { low: { requiresConfirmation: false, requiresAuth: false } } }
    };
    return new ActionRouter(config, {
      execute(actionId, entities) {
        executed.push({ actionId, entities });
        return { success: true, data: { actionId, ...entities } };
      }
    });
  }

  it('keeps window/desktop commands out of the conversation-first LLM path', function() {
    const assistant = createAssistant({ process: async () => ({ success: true }) }, null);

    assert.equal(assistant._isConversationFirstCandidate('minimize all apps'), false);
    assert.equal(assistant._isConversationFirstCandidate('maximize the window'), false);
    assert.equal(assistant._isConversationFirstCandidate('take me to the desktop'), false);
    assert.equal(assistant._isConversationFirstCandidate('show the desktop'), false);
    assert.equal(assistant._isConversationFirstCandidate('hide all apps'), false);
    assert.equal(assistant._isConversationFirstCandidate('how are you doing today'), true);
  });

  it('routes "minimize all apps" to window.minimize with an every-window target', async function() {
    const executed = [];
    const router = createRouter(executed);

    const result = await router.process('minimize all apps', 'chat');

    assert.equal(result.intent, 'window.minimize');
    assert.equal(result.success, true);
    assert.equal(executed[0].actionId, 'window.minimize');
    assert.equal(executed[0].entities.windowName, 'all windows');
  });

  it('routes "take me to the desktop" to window.showDesktop', async function() {
    const executed = [];
    const router = createRouter(executed);

    const result = await router.process('take me to the desktop', 'chat');

    assert.equal(result.intent, 'window.showDesktop');
    assert.equal(result.success, true);
    assert.equal(executed[0].actionId, 'window.showDesktop');
  });

  it('does not treat "open my desktop folder" as a show-desktop command', async function() {
    const executed = [];
    const router = createRouter(executed);

    const result = await router.process('open my desktop folder', 'chat');

    assert.notEqual(result.intent, 'window.showDesktop');
  });

  it('keeps restore/switch and desktop-utility commands out of the conversation-first LLM path', function() {
    const assistant = createAssistant({ process: async () => ({ success: true }) }, null);

    const commands = [
      'restore the window',
      'unminimize chrome',
      'bring back the window',
      'restore all windows',
      'switch windows',
      'switch between windows',
      'next window',
      'alt tab',
      'snap the window left',
      'snap the window right',
      'move the window to the right',
      'empty the recycle bin',
      'clear the trash',
      'open task manager',
      'launch the task manager'
    ];

    for (const command of commands) {
      assert.equal(assistant._isConversationFirstCandidate(command), false, command);
    }

    assert.equal(assistant._isConversationFirstCandidate('tell me a joke'), true);
  });

  it('routes restore and switch window commands to their intents', async function() {
    const executed = [];
    const router = createRouter(executed);

    const restore = await router.process('restore the window', 'chat');
    assert.equal(restore.intent, 'window.restore');
    assert.equal(restore.success, true);
    assert.equal(executed[0].actionId, 'window.restore');

    const restoreAll = await router.process('restore all windows', 'chat');
    assert.equal(restoreAll.intent, 'window.restore');
    assert.equal(executed[1].actionId, 'window.restore');
    assert.equal(executed[1].entities.windowName, 'all windows');

    const switchWindows = await router.process('switch windows', 'chat');
    assert.equal(switchWindows.intent, 'window.switch');
    assert.equal(executed[2].actionId, 'window.switch');
  });

  it('routes recycle bin and task manager commands to system intents', async function() {
    const executed = [];
    const router = createRouter(executed);

    const empty = await router.process('empty the recycle bin', 'chat');
    assert.equal(empty.intent, 'system.emptyRecycleBin');
    assert.equal(empty.success, true);
    assert.equal(executed[0].actionId, 'system.emptyRecycleBin');

    const taskManager = await router.process('open task manager', 'chat');
    assert.equal(taskManager.intent, 'system.openTaskManager');
    assert.equal(executed[1].actionId, 'system.openTaskManager');
  });

  it('does not treat "restore the backup file" as a window restore', async function() {
    const executed = [];
    const router = createRouter(executed);

    const result = await router.process('restore the backup file', 'chat');

    assert.notEqual(result.intent, 'window.restore');
  });

  it('routes a wide range of natural window-control phrasings', async function() {
    const executed = [];
    const router = createRouter(executed);

    const cases = [
      { intent: 'window.minimize', phrases: ['minimize everything', 'minimize all windows', 'hide every window', 'shrink all apps'] },
      { intent: 'window.maximize', phrases: ['maximize all windows', 'maximize everything', 'enlarge the browser'] },
      { intent: 'window.showDesktop', phrases: ['show desktop', 'go to the desktop', 'take me to my desktop', 'desktop view', 'show my desktop', 'bring me to the desktop'] },
      { intent: 'window.restore', phrases: ['restore the window', 'unminimize chrome', 'bring back the window', 'restore all windows', 'bring all windows back'] },
      { intent: 'window.switch', phrases: ['switch windows', 'switch between windows', 'next window', 'cycle windows', 'alt tab', 'switch apps'] },
      { intent: 'window.snap', phrases: ['snap the window left', 'snap the window right', 'move the window to the right', 'dock the window left'] },
      { intent: 'system.emptyRecycleBin', phrases: ['empty recycle bin', 'empty the recycle bin', 'clear trash', 'empty the trash'] },
      { intent: 'system.openTaskManager', phrases: ['open task manager', 'open the task manager', 'show task manager', 'launch task manager'] }
    ];

    for (const testCase of cases) {
      for (const phrase of testCase.phrases) {
        const result = await router.process(phrase, 'chat');
        assert.equal(result.intent, testCase.intent, `"${phrase}" should route to ${testCase.intent}`);
        assert.equal(result.success, true, `"${phrase}" should succeed`);
      }
    }

    assert.equal(executed.length, cases.reduce((total, item) => total + item.phrases.length, 0));
  });

  it('rejects a conversational LLM reply that claims a desktop action happened', async function() {
    let routerCalled = false;
    const assistant = createAssistant({
      process: async input => {
        routerCalled = true;
        return {
          commandId: 'cmd-min',
          success: true,
          intent: 'window.minimize',
          response: 'Minimized all windows.',
          entities: { windowName: 'all windows' },
          data: {
            controllerVerified: true,
            verification: { status: 'passed', check: 'window-minimize-request' }
          },
          verification: { status: 'passed', check: 'window-minimize-request' }
        };
      }
    }, {
      isEnabled: () => true,
      validate: () => ({ success: true, modelName: 'test.gguf' }),
      reply: async () => ({
        success: true,
        response: "I've minimized all apps for you.",
        data: { localLlm: { modelName: 'test.gguf' } }
      })
    });

    const result = await assistant._processCommandDirect('minimize all apps', 'chat');

    assert.equal(routerCalled, true);
    assert.equal(result.intent, 'window.minimize');
    assert.notEqual(result.intent, 'assistant.chat');
  });

  it('detects LLM completion claims so they can be rejected', function() {
    const assistant = createAssistant({ process: async () => ({ success: true }) }, null);

    assert.equal(assistant._claimsPerformedAction("I've minimized all apps."), true);
    assert.equal(assistant._claimsPerformedAction('All windows have been closed.'), true);
    assert.equal(assistant._claimsPerformedAction('The task is done.'), true);
    assert.equal(assistant._claimsPerformedAction('I could not open the file.'), false);
    assert.equal(assistant._claimsPerformedAction('How are you doing today?'), false);
  });

  it('never lets the LLM flip a failed task into a success claim', async function() {
    const assistant = createAssistant({
      process: async () => ({
        commandId: 'cmd-min-fail',
        success: false,
        intent: 'window.minimize',
        error: 'Unable to minimize all windows',
        response: 'I could not minimize all windows.',
        entities: { windowName: 'all windows' }
      })
    }, {
      isEnabled: () => true,
      validate: () => ({ success: true, modelName: 'test.gguf' }),
      reply: async () => ({
        success: true,
        response: 'I have minimized all windows for you.',
        data: { localLlm: { modelName: 'test.gguf' } }
      })
    });

    const result = await assistant._processCommandDirect('minimize all windows', 'chat');

    assert.equal(result.success, false);
    assert.equal(result.intent, 'window.minimize');
    assert.match(result.response, /could not minimize/i);
    assert.doesNotMatch(result.response, /have minimized/i);
  });

  it('routes document and note creation to document.create', async function() {
    const executed = [];
    const router = createRouter(executed);

    for (const command of ['Create a document', 'Make a new document.', 'create a note', 'make a note']) {
      const result = await router.process(command, 'chat');
      assert.equal(result.intent, 'document.create', command);
      assert.equal(result.success, true, command);
    }

    assert.equal(executed[0].actionId, 'document.create');
    assert.equal(executed[0].entities.documentType, 'document');
    assert.equal(executed[2].entities.documentType, 'note');
  });

  it('does not let document.create hijack file or folder creation', async function() {
    const executed = [];
    const router = createRouter(executed);

    const folder = await router.process('Create a document folder and organize files automatically.', 'chat');
    assert.notEqual(folder.intent, 'document.create');

    const file = await router.process('Create a notes file', 'chat');
    assert.notEqual(file.intent, 'document.create');
  });

  it('resolves the create-note step inside a multi command', async function() {
    const executed = [];
    const router = createRouter(executed);

    const result = await router.process('Open Notepad, create a note, and save it.', 'chat');

    assert.equal(result.intent, 'multi.command');
    assert.equal(result.success, true);
    assert.ok(executed.some(step => step.actionId === 'document.create'));
  });
});
