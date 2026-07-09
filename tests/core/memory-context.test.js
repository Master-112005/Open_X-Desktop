const assert = require('assert');

function structured(rawInput, entities = {}) {
  const { StructuredEntities } = require('../../core/assistant/entities/index.js');
  return new StructuredEntities({
    ...entities,
    metadata: { rawInput }
  });
}

describe('Assistant Memory and Context Layer', function() {
  it('produces immutable ResolvedContext without intent, planning, or automation', async function() {
    const { createDefaultMemoryManager, ResolvedContext } = require('../../core/assistant/memory/index.js');
    const manager = createDefaultMemoryManager({
      configuration: {
        contextProviders: {
          'context.time': { enabled: false }
        }
      }
    });
    const resolved = await manager.resolve(structured('Open Chrome.', {
      applications: [{ type: 'application', value: 'chrome', canonical: 'Google Chrome', confidence: 0.9 }]
    }));

    assert.ok(resolved instanceof ResolvedContext);
    assert.ok(Object.isFrozen(resolved));
    assert.equal(resolved.workingMemory.currentApplication, 'Google Chrome');
    assert.equal(resolved.intent, undefined);
    assert.equal(resolved.plan, undefined);
    assert.equal(resolved.automation, undefined);
  });

  it('resolves conversation pronouns repeatably', async function() {
    const { createDefaultMemoryManager } = require('../../core/assistant/memory/index.js');
    const manager = createDefaultMemoryManager({
      configuration: {
        contextProviders: {
          'context.time': { enabled: false }
        }
      }
    });

    await manager.resolve(structured('Open Chrome.', {
      applications: [{ type: 'application', value: 'chrome', canonical: 'Google Chrome', confidence: 0.9 }]
    }));
    const first = await manager.resolve(structured('Close it.'));
    const second = await manager.resolve(structured('Close it.'));

    assert.equal(first.resolvedPronouns[0].target, 'Google Chrome');
    assert.deepEqual(first.resolvedPronouns[0], second.resolvedPronouns[0]);
  });

  it('expires working memory without deleting conversation memory', async function() {
    const { createDefaultMemoryManager } = require('../../core/assistant/memory/index.js');
    const manager = createDefaultMemoryManager({
      configuration: {
        workingMemoryTtlMs: 1,
        contextProviders: {
          'context.time': { enabled: false }
        }
      }
    });

    await manager.resolve(structured('Open Chrome.', {
      applications: [{ type: 'application', value: 'chrome', canonical: 'Google Chrome', confidence: 0.9 }]
    }));
    manager.state.workingMemory.updatedAt = 0;
    const resolved = await manager.resolve(structured('Hello.'));

    assert.equal(resolved.workingMemory.currentApplication, undefined);
    assert.ok(resolved.conversationMemory.references.some(reference => reference.value === 'Google Chrome'));
  });

  it('captures current app, browser, and selection from read-only snapshots', async function() {
    const { createDefaultMemoryManager } = require('../../core/assistant/memory/index.js');
    const manager = createDefaultMemoryManager({
      configuration: {
        contextProviders: {
          'context.time': { enabled: false }
        }
      }
    });
    const resolved = await manager.resolve(structured('What is selected?'), {
      snapshots: {
        activeWindow: { app: 'Code.exe', title: 'OpenX - Visual Studio Code' },
        runningApplications: ['Code.exe', 'chrome.exe'],
        browser: {
          currentBrowser: 'Google Chrome',
          currentTab: 'Docs',
          currentUrl: 'https://example.test',
          currentWebsite: 'Example',
          tabTitle: 'Example Docs'
        },
        selection: {
          selectedText: 'hello',
          selectedFiles: ['C:\\tmp\\a.txt']
        }
      }
    });

    assert.equal(resolved.application.focusedApplication, 'Code.exe');
    assert.equal(resolved.browserState.currentBrowser, 'Google Chrome');
    assert.equal(resolved.selections.selectedText, 'hello');
  });

  it('runs inside the assistant pipeline without changing routed plain text', async function() {
    const Assistant = require('../../core/assistant');
    const routed = [];
    const assistant = new Assistant({}, {
      automation: {},
      eventBus: { publish() {} },
      router: {
        process: async (input, source, options) => {
          routed.push({ input, source, options });
          return { success: true, intent: 'app.open', entities: { appName: 'chrome' }, response: input };
        }
      }
    });

    const result = await assistant.processCommand('launch chrome', 'chat');

    assert.equal(result.success, true);
    assert.equal(routed[0].input, 'launch chrome');
    assert.equal(routed[0].source, 'chat');
  });
});
