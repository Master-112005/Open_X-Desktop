const assert = require('assert');

describe('Assistant Local LLM Fallback', function() {
  this.timeout(15000);

  let Assistant;
  let stripLeadingPrivateContext;
  let buildSystemPrompt;

  before(function() {
    Assistant = require('../../core/assistant/index');
    ({ stripLeadingPrivateContext } = require('../../core/assistant/llm/LeakGuard'));
    ({ buildSystemPrompt } = require('../../core/assistant/llm/prompt'));
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

  it('uses the local LLM when routing cannot determine an intent', async function() {
    const calls = [];
    const assistant = createAssistant({
      process: async () => ({
        commandId: 'cmd-unknown',
        success: false,
        error: 'Could not determine intent',
        response: 'I could not understand that command.',
        normalizedInput: 'explain recursion'
      })
    }, {
      isEnabled: () => true,
      validate: () => ({ success: true, modelName: 'test.gguf' }),
      reply: async (input, options) => {
        calls.push({ input, options });
        return {
          success: true,
          response: 'Recursion is when a function solves a problem by calling itself with a smaller case.',
          data: { localLlm: { modelName: 'test.gguf' } }
        };
      }
    });

    const result = await assistant._processCommandDirect('explain recursion', 'chat');

    assert.equal(result.success, true);
    assert.equal(result.intent, 'assistant.llm');
    assert.match(result.response, /Recursion is when/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.assistantName, 'OpenX');
    assert.equal(result.data.routedFallback.error, 'Could not determine intent');
  });

  it('does not replace successful deterministic routing with the LLM', async function() {
    let llmCalled = false;
    const assistant = createAssistant({
      process: async () => ({
        commandId: 'cmd-open',
        success: true,
        intent: 'app.open',
        response: 'Opened Chrome.',
        entities: { appName: 'Chrome' }
      })
    }, {
      isEnabled: () => true,
      validate: () => ({ success: true, modelName: 'test.gguf' }),
      reply: async () => {
        llmCalled = true;
        return { success: true, response: 'wrong path' };
      }
    });

    const result = await assistant._processCommandDirect('open chrome', 'chat');

    assert.equal(result.success, true);
    assert.equal(result.intent, 'app.open');
    assert.equal(llmCalled, false);
    assert.match(result.response, /^Opened Chrome\./);
  });

  it('uses the local LLM for conversational greeting replies', async function() {
    let llmInput = '';
    const assistant = createAssistant({
      process: async () => ({
        commandId: 'cmd-greeting',
        success: true,
        intent: 'greeting',
        response: 'Hello. How can I help?',
        entities: { greetingType: 'wellbeing' }
      })
    }, {
      isEnabled: () => true,
      validate: () => ({ success: true, modelName: 'test.gguf' }),
      reply: async input => {
        llmInput = input;
        return {
          success: true,
          response: 'Doing well, thanks for asking. How is your day going?'
        };
      }
    });

    const result = await assistant._processCommandDirect('hi how is your day going', 'chat');

    assert.equal(result.success, true);
    assert.equal(result.intent, 'assistant.llm');
    assert.match(result.response, /Doing well/);
    assert.equal(llmInput, 'hi how is your day going');
    assert.equal(result.data.routedFallback.reason, 'conversation');
  });

  it('keeps failed real intents out of the LLM fallback', async function() {
    let llmCalled = false;
    const assistant = createAssistant({
      process: async () => ({
        commandId: 'cmd-close',
        success: false,
        intent: 'app.close',
        error: 'Could not close Chrome',
        response: 'I could not close Chrome.',
        entities: { appName: 'Chrome' }
      })
    }, {
      isEnabled: () => true,
      validate: () => ({ success: true, modelName: 'test.gguf' }),
      reply: async () => {
        llmCalled = true;
        return { success: true, response: 'wrong path' };
      }
    });

    const result = await assistant._processCommandDirect('close chrome', 'chat');

    assert.equal(result.success, false);
    assert.equal(result.intent, 'app.close');
    assert.equal(llmCalled, false);
  });

  it('uses the local LLM for unimplemented assistant capability marker replies', async function() {
    let llmCalled = false;
    const assistant = createAssistant({
      process: async () => ({
        commandId: 'cmd-capability',
        success: true,
        intent: 'assistant.capability',
        response: 'I understood this as a workflow-step request, but this capability is not connected to an automation controller yet.',
        entities: { capability: 'workflow-step', target: 'story' },
        data: { action: 'capability.recognized', capability: 'workflow-step', target: 'story' }
      })
    }, {
      isEnabled: () => true,
      validate: () => ({ success: true, modelName: 'test.gguf' }),
      reply: async () => {
        llmCalled = true;
        return { success: true, response: 'Here is a short story from the local model.' };
      }
    });

    const result = await assistant._processCommandDirect('tell me a story', 'chat');

    assert.equal(result.success, true);
    assert.equal(result.intent, 'assistant.llm');
    assert.equal(llmCalled, true);
    assert.match(result.response, /short story/);
  });

  it('strips echoed private context from model replies', function() {
    const text = stripLeadingPrivateContext('[Private background context. Current time: today.] The useful answer.');
    assert.equal(text, 'The useful answer.');
  });

  it('prompts the model not to claim desktop actions', function() {
    const prompt = buildSystemPrompt('name: Rakesh', 'OpenX', 'concise', 'system');
    assert.match(prompt, /deterministic command router/);
    assert.match(prompt, /Do not claim you opened, closed, deleted, sent, scheduled, clicked, changed, or verified anything/);
    assert.match(prompt, /Voice transcripts may contain mistakes/);
  });
});
