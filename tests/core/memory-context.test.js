const assert = require('assert');

function structured(rawInput, entities = {}) {
  const { StructuredEntities } = require('../../core/assistant/entities/index.js');
  return new StructuredEntities({
    ...entities,
    metadata: { rawInput }
  });
}

describe('Assistant Memory and Context Layer', function() {
  it('exports a versioned memory layer', function() {
    const { MEMORY_LAYER_VERSION } = require('../../core/assistant/memory/index.js');
    assert.match(MEMORY_LAYER_VERSION, /^\d+\.\d+\.\d+$/);
  });

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
    assert.equal(resolved.hasContext(), true);
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

  it('uses action context when resolving pronoun targets', async function() {
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
    await manager.resolve(structured('Find Resume.docx.', {
      files: [{ type: 'file', value: 'Resume.docx', canonical: 'C:\\Users\\rakes\\Documents\\Resume.docx', confidence: 0.92 }]
    }));
    const fileTarget = await manager.resolve(structured('Send it to my phone.'));
    const appTarget = await manager.resolve(structured('Close it.'));

    assert.equal(fileTarget.resolvedPronouns[0].targetType, 'file');
    assert.equal(fileTarget.resolvedPronouns[0].target, 'C:\\Users\\rakes\\Documents\\Resume.docx');
    assert.equal(appTarget.resolvedPronouns[0].targetType, 'application');
    assert.equal(appTarget.resolvedPronouns[0].target, 'Google Chrome');
  });

  it('recognizes broader follow-up references without treating durations as references', async function() {
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
    const there = await manager.resolve(structured('Go there again.'));
    const duration = await manager.resolve(structured('Set timer for one minute.'));

    assert.equal(there.resolvedReferences[0].reference, 'there');
    assert.equal(duration.resolvedReferences.length, 0);
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

  it('keeps conversation, dialogue, and entity snapshots bounded and newest-first for recall', async function() {
    const { createDefaultMemoryManager } = require('../../core/assistant/memory/index.js');
    const manager = createDefaultMemoryManager({
      configuration: {
        memoryLimit: 3,
        maxEntitySnapshots: 2,
        contextProviders: {
          'context.time': { enabled: false }
        }
      }
    });

    await manager.resolve(structured('Open Chrome.', {
      applications: [{ type: 'application', value: 'chrome', canonical: 'Google Chrome', confidence: 0.9 }]
    }));
    await manager.resolve(structured('Open Edge.', {
      applications: [{ type: 'application', value: 'edge', canonical: 'Microsoft Edge', confidence: 0.9 }]
    }));
    const resolved = await manager.resolve(structured('Find report.', {
      files: [
        { type: 'file', value: 'old.txt', canonical: 'C:\\Temp\\old.txt', confidence: 0.6 },
        ...Array.from({ length: 12 }, (_, index) => ({
          type: 'file',
          value: `extra-${index}.txt`,
          canonical: `C:\\Temp\\extra-${index}.txt`,
          confidence: 0.5
        })),
        { type: 'file', value: 'report.pdf', canonical: 'C:\\Temp\\report.pdf', confidence: 0.95 }
      ]
    }));

    assert.equal(resolved.workingMemory.currentFile, 'C:\\Temp\\report.pdf');
    assert.equal(resolved.conversationMemory.turns.length, 3);
    assert.ok(resolved.conversationMemory.turns.every(turn => turn.entities.length <= 10));
    assert.equal(resolved.dialogueHistory.length, 3);
    assert.equal(resolved.getRecentReference('file').value, 'C:\\Temp\\report.pdf');
  });

  it('records provider timeout failures without crashing when strict mode is off', async function() {
    const {
      BaseMemoryProvider,
      createDefaultMemoryManager
    } = require('../../core/assistant/memory/index.js');
    const { sleep } = require('../../core/assistant/utils/AsyncHelpers');

    class SlowMemoryProvider extends BaseMemoryProvider {
      async apply(context) {
        await sleep(50);
        return context;
      }
    }

    const manager = createDefaultMemoryManager({
      defaultProviders: false,
      configuration: { providerTimeoutMs: 5 }
    });
    manager.registerMemoryProvider(new SlowMemoryProvider({ id: 'memory.slow' }), { id: 'memory.slow' });

    const resolved = await manager.resolve(structured('Open Chrome.'));

    assert.equal(resolved.diagnostics.errors.length, 1);
    assert.match(resolved.diagnostics.errors[0].message, /timed out/i);
    assert.equal(manager.getStatus().memoryProviders[0].stats.failures, 1);
  });

  it('protects memory registry integrity and exposes counts', function() {
    const {
      BaseMemoryProvider,
      ConfigurationError,
      createDefaultMemoryManager
    } = require('../../core/assistant/memory/index.js');

    class TestProvider extends BaseMemoryProvider {}
    const manager = createDefaultMemoryManager({ defaultProviders: false });

    manager.registerMemoryProvider(new TestProvider({ id: 'memory.test' }), { id: 'memory.test' });

    assert.throws(
      () => manager.registerMemoryProvider(new TestProvider({ id: 'memory.test' }), { id: 'memory.test' }),
      ConfigurationError
    );
    assert.equal(manager.getStatus().counts.memoryProviders, 1);
  });

  it('adds memory confidence and topic into the assistant pipeline context', async function() {
    const { MemoryContextStage } = require('../../core/assistant/memory/index.js');
    const { PipelineContext } = require('../../core/assistant/pipeline');

    const stage = new MemoryContextStage({
      configuration: {
        contextProviders: {
          'context.time': { enabled: false }
        }
      }
    });
    const context = new PipelineContext({ rawInput: 'Open Chrome.', source: 'chat' });
    context.structuredEntities = structured('Open Chrome.', {
      applications: [{ type: 'application', value: 'chrome', canonical: 'Google Chrome', confidence: 0.9 }]
    });

    const result = await stage.execute(context);

    assert.equal(result.success, true);
    assert.equal(result.output.hasContext, true);
    assert.equal(context.get('assistant.memoryTopic').label, 'Google Chrome');
    assert.ok(context.get('assistant.memoryConfidence') > 0);
    await stage.destroy();
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
