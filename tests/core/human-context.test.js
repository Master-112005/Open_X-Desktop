'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const Assistant = require('../../core/assistant');
const ActiveLearningStore = require('../../core/assistant/learning/ActiveLearningStore');
const ContextManager = require('../../core/assistant/context/ContextManager');
const InputParser = require('../../core/assistant/linguistic/InputParser');
const NlpProcessor = require('../../core/assistant/linguistic/NlpProcessor');
const NaturalLanguageRouter = require('../../core/assistant/semantic/NaturalLanguageRouter');
const NaturalLanguageExecution = require('../../core/assistant/automation/NaturalLanguageExecution');
const IntentRegistry = require('../../core/assistant/reasoning/IntentRegistry').IntentRegistry;

describe('Human-style context and profile memory', function() {
  it('resolves short elliptical follow-ups from the last successful action', function() {
    const context = new ContextManager({});
    context.record('open chrome', {}, {
      success: true,
      intent: 'app.open',
      entities: { appName: 'chrome' }
    });
    assert.equal(context.resolveEllipticalFollowUp('and firefox'), 'open firefox');
    assert.equal(context.resolveEllipticalFollowUp('and open edge'), 'open edge');

    context.record('search for OpenX architecture', {}, {
      success: true,
      intent: 'browser.search',
      entities: { query: 'OpenX architecture' }
    });
    assert.equal(
      context.resolveEllipticalFollowUp('do the same with edge'),
      'search for OpenX architecture in edge'
    );
    assert.equal(
      context.resolveEllipticalFollowUp('same with firefox'),
      'search for OpenX architecture in firefox'
    );
  });

  it('resolves corrective volume follow-ups against the recent action', function() {
    const context = new ContextManager({});
    context.record('vol 100', {}, {
      success: true,
      intent: 'volume.set',
      entities: { value: 100 }
    });

    assert.equal(context.resolveEllipticalFollowUp('no no set it to 40'), 'set volume to 40');
    assert.equal(context.resolveEllipticalFollowUp('no set it to 60'), 'set volume to 60');
    assert.equal(context.resolveEllipticalFollowUp('please set the vol to 70'), 'set volume to 70');
  });

  it('carries discourse metadata through parser, NLP, and NLU', function() {
    const registry = new IntentRegistry();
    const nlp = new NlpProcessor(registry);
    const input = 'and open that one';
    const parsed = new InputParser({}).parse(input);
    const prepared = nlp.prepare(input);
    const semantic = new NaturalLanguageRouter({ intentRegistry: registry, nlp }).parse(input, prepared);

    assert.equal(parsed.discourse.isFollowUp, true);
    assert.deepEqual(parsed.discourse.references, ['that', 'one']);
    assert.equal(
      parsed.wordRelations.some(relation =>
        relation.type === 'context-reference' &&
        relation.from === 'that' &&
        relation.to === 'previous-context'
      ),
      true
    );
    assert.equal(prepared.discourse.requiresContext, true);
    assert.equal(semantic.discourse.isFollowUp, true);
    assert.equal(
      semantic.relations.some(relation =>
        relation.type === 'context-reference' &&
        relation.from === 'one' &&
        relation.to === 'previous-context'
      ),
      true
    );
  });

  it('passes context metadata through NLE without changing action behavior', async function() {
    let receivedContext = null;
    const nle = new NaturalLanguageExecution({
      execute(action, entities, context) {
        receivedContext = context;
        return { success: true, data: { action, entities } };
      }
    });
    await nle.execute('app.open', { appName: 'firefox' }, {
      languageUnderstanding: { discourse: { isFollowUp: true } },
      contextualRewrite: { input: 'and firefox', correction: 'open firefox' }
    });

    assert.equal(receivedContext.discourse.isFollowUp, true);
    assert.equal(receivedContext.contextualRewrite.correction, 'open firefox');
  });

  it('rewrites natural follow-ups before routing while preserving normal execution', async function() {
    const routed = [];
    const assistant = new Assistant({ activeLearning: { enabled: false } }, {
      router: {
        process: async (input, source, options) => {
          routed.push({ input, source, options });
          return {
            success: true,
            intent: 'app.open',
            entities: { appName: input.replace(/^open\s+/, '') },
            response: `Opened ${input}`
          };
        }
      },
      automation: {},
      eventBus: { publish() {} }
    });

    await assistant.processCommand('open chrome');
    await assistant.processCommand('what about firefox');

    assert.equal(routed[1].input, 'open firefox');
    assert.equal(routed[1].options.contextualRewrite.correction, 'open firefox');
  });

  it('rewrites corrective volume commands before routing', async function() {
    const routed = [];
    const assistant = new Assistant({ activeLearning: { enabled: false } }, {
      router: {
        process: async (input, source, options) => {
          routed.push({ input, source, options });
          const value = Number(input.match(/\b(\d{1,3})\b/)?.[1] || 0);
          return {
            success: true,
            intent: 'volume.set',
            entities: { value },
            response: `Volume set to ${value}.`
          };
        }
      },
      automation: {},
      eventBus: { publish() {} }
    });

    await assistant.processCommand('set volume to 100');
    await assistant.processCommand('no no set it to 40');
    await assistant.processCommand('please set the vol to 70');

    assert.equal(routed[1].input, 'set volume to 40');
    assert.equal(routed[1].options.contextualRewrite.correction, 'set volume to 40');
    assert.equal(routed[2].input, 'set volume to 70');
  });

  it('warns when a new reminder matches an active existing reminder', async function() {
    const dueAt = new Date('2030-01-01T14:30:00.000Z').toISOString();
    const assistant = new Assistant({ activeLearning: { enabled: false } }, {
      router: {
        process: async () => ({
          success: true,
          intent: 'reminder.set',
          entities: { reminderText: 'call mummy' },
          data: { id: 'new-reminder', dueAt, message: 'call mummy' },
          response: 'Okay, I will remind you to call mummy.'
        })
      },
      automation: {
        scheduler: {
          scheduledItems: [{
            id: 'existing-reminder',
            kind: 'Reminder',
            status: 'scheduled',
            dueAt,
            message: 'call mummy'
          }]
        }
      },
      eventBus: { publish() {} }
    });

    const result = await assistant.processCommand('remind me at 8 pm to call mummy');

    assert.equal(result.success, true);
    assert.match(result.response, /already have an active matching reminder/i);
  });

  it('stores phone numbers and arbitrary profile details but rejects secrets', function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-profile-memory-'));
    const storePath = path.join(dataDir, 'learning.json');
    const store = new ActiveLearningStore({
      activeLearning: { enabled: true, storePath }
    });

    assert.equal(store.learnFromText('remember my phone number is 9876543210').type, 'user-fact');
    assert.equal(store.learnFromText('remember my emergency contact is Ravi').type, 'user-fact');
    assert.equal(store.answerPersonalQuestion('what is my phone number').known, true);
    assert.equal(store.answerPersonalQuestion('what is my emergency contact').response.includes('Ravi'), true);

    const blocked = store.learnFromText('remember my API key is sk-proj-abcdefghijklmnopqrstuv');
    assert.equal(blocked.type, 'rejected-sensitive');
    assert.equal(store.getUserFact('api_key'), null);
  });
});
