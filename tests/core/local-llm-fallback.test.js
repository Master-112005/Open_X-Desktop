const assert = require('assert');

describe('Assistant Local LLM Fallback', function() {
  this.timeout(15000);

  let Assistant;
  let stripLeadingPrivateContext;
  let buildSystemPrompt;
  let buildTurnPrompt;
  let buildCommandPlanPrompt;
  let ActionRouter;

  before(function() {
    Assistant = require('../../core/assistant/index');
    ActionRouter = require('../../core/assistant/automation/ActionRouter');
    ({ stripLeadingPrivateContext } = require('../../core/assistant/llm/LeakGuard'));
    ({ buildSystemPrompt, buildTurnPrompt, buildCommandPlanPrompt } = require('../../core/assistant/llm/prompt'));
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

  it('does not use the local LLM as a fallback when routing cannot determine an intent', async function() {
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

    const result = await assistant._processCommandDirect('play recursion', 'chat');

    assert.equal(result.success, false);
    assert.equal(result.intent, undefined);
    assert.match(result.response, /could not understand/i);
    assert.equal(calls.length, 0);
    assert.equal(result.data?.routedFallback, undefined);
  });

  it('asks the local LLM for ordered command clauses without allowing it to execute actions', function() {
    const prompt = buildCommandPlanPrompt('open YouTube, play 295, take a screenshot, save it in Space');
    assert.match(prompt, /ordered JSON array/);
    assert.match(prompt, /Return only JSON/);
    assert.match(prompt, /Do not add steps/);
    assert.match(prompt, /open YouTube, play 295, take a screenshot, save it in Space/);
  });

  it('passes a validated local LLM plan into the normal command router', async function() {
    let routeOptions;
    let plannedInput;
    const assistant = createAssistant({
      process: async (_input, _source, options) => {
        routeOptions = options;
        return { success: true, intent: 'multi.command', response: 'Done.', steps: [] };
      }
    }, {
      getStatus: () => ({ enabled: true, modelReady: true, status: 'ready' }),
      reply: async (input, options) => {
        if (options.turn === 'commandPlan') plannedInput = input;
        return {
          success: true,
          response: JSON.stringify({ steps: [
            'open YouTube', 'play 295 song on YouTube', 'take a screenshot',
            'create folder called Space', 'move the screenshot just taken into the Space folder'
          ] })
        };
      }
    });

    await assistant._processCommandDirect(
      'open youtube and play 295 song then take screenshot and create folder space and save screenshot there',
      'chat',
      { originalInput: 'Open YouTube and play 295 song, take a screenshot, create folder Space, then save it there' }
    );

    assert.equal(plannedInput, 'Open YouTube and play 295 song, take a screenshot, create folder Space, then save it there');
    assert.equal(routeOptions.planRequestText, plannedInput);
    assert.deepEqual(routeOptions.plannedClauses, [
      'open YouTube', 'play 295 song on YouTube', 'take a screenshot',
      'create folder called Space', 'move the screenshot just taken into the Space folder'
    ]);
  });

  it('executes the full YouTube and screenshot workflow through the assistant pipeline', async function() {
    const request = 'open youtube play 295 song and take a screenshot and create a new folder name it space and save the screenshot in the folder';
    const actionCalls = [];
    const router = new ActionRouter({
      permissions: { levels: { low: { requiresConfirmation: false, requiresAuth: false } } }
    }, {
      async execute(actionId, entities) {
        actionCalls.push({ actionId, entities });
        if (actionId === 'system.screenshot') return { success: true, data: { filePath: 'C:/Users/test/Pictures/OpenX-shot.png' } };
        if (actionId === 'folder.create') return { success: true, data: { path: 'C:/Users/test/Space' } };
        return { success: true, data: entities };
      }
    });
    const llmSteps = [
      'open YouTube', 'play 295 song on YouTube', 'take a screenshot',
      'create folder called Space', 'move the screenshot just taken into the Space folder'
    ];
    assert.deepEqual(router._buildMultiCommandPlan(request, 'chat', {
      plannedClauses: llmSteps,
      planRequestText: request
    }), llmSteps);
    const assistant = createAssistant(router, {
      getStatus: () => ({ enabled: true, modelReady: true, status: 'ready' }),
      async reply(input, options) {
        if (options.turn === 'commandPlan') {
          return {
            success: true,
            response: JSON.stringify({ steps: llmSteps })
          };
        }
        return { success: true, response: input };
      }
    });

    const result = await assistant.processCommand(request, 'chat');

    assert.equal(result.success, true);
    assert.deepEqual(actionCalls.map(call => call.actionId), [
      'app.open', 'media.play', 'system.screenshot', 'folder.create', 'file.move'
    ]);
    assert.deepEqual(actionCalls[4].entities, {
      source: 'C:/Users/test/Pictures/OpenX-shot.png',
      destination: 'C:/Users/test/Space'
    });
    assert.ok(result.steps.every(step => step.success));
  });

  it('keeps verified automation replies grounded instead of rephrasing them with the local LLM', async function() {
    let llmCalled = false;
    const assistant = createAssistant({
      process: async () => ({
        commandId: 'cmd-open',
        success: true,
        intent: 'app.open',
        response: 'Opened Chrome.',
        entities: { appName: 'Chrome' },
        data: {
          verification: { status: 'passed', check: 'app-open' }
        },
        verification: { status: 'passed', check: 'app-open' }
      })
    }, {
      isEnabled: () => true,
      validate: () => ({ success: true, modelName: 'test.gguf' }),
      reply: async () => {
        llmCalled = true;
        return {
          success: true,
          response: 'Chrome is open and ready for you.',
          data: { localLlm: { modelName: 'test.gguf' } }
        };
      }
    });

    const result = await assistant._processCommandDirect('open chrome', 'chat');

    assert.equal(result.success, true);
    assert.equal(result.intent, 'app.open');
    assert.equal(result.response, 'Opened Chrome.');
    assert.equal(llmCalled, false);
  });

  it('does not let the local LLM rewrite automation replies with missing verification', async function() {
    let llmCalled = false;
    const assistant = createAssistant({
      process: async () => ({
        commandId: 'cmd-open-unverified',
        success: true,
        intent: 'app.open',
        response: 'Open Chrome request was sent, but I could not verify the final state.',
        entities: { appName: 'Chrome' }
      })
    }, {
      isEnabled: () => true,
      validate: () => ({ success: true, modelName: 'test.gguf' }),
      reply: async () => {
        llmCalled = true;
        return {
          success: true,
          response: 'Chrome is open and ready.',
          data: { localLlm: { modelName: 'test.gguf' } }
        };
      }
    });

    const result = await assistant._processCommandDirect('open chrome', 'chat');

    assert.equal(result.success, true);
    assert.equal(result.intent, 'app.open');
    assert.equal(llmCalled, false);
    assert.match(result.response, /request was sent/i);
    assert.doesNotMatch(result.response, /open and ready/i);
  });

  it('does not let the local LLM rewrite unverified automation dispatches as completed', async function() {
    let llmCalled = false;
    const assistant = createAssistant({
      process: async () => ({
        commandId: 'cmd-close',
        success: true,
        intent: 'app.close',
        response: 'Close Chrome request was sent, but I could not verify the final state.',
        entities: { appName: 'Chrome' },
        data: {
          controllerVerified: false,
          verification: {
            status: 'unknown',
            check: 'app-close'
          }
        },
        verification: {
          status: 'unknown',
          check: 'app-close'
        }
      })
    }, {
      isEnabled: () => true,
      validate: () => ({ success: true, modelName: 'test.gguf' }),
      reply: async () => {
        llmCalled = true;
        return {
          success: true,
          response: 'Chrome is closed now.',
          data: { localLlm: { modelName: 'test.gguf' } }
        };
      }
    });

    const result = await assistant._processCommandDirect('close chrome', 'chat');

    assert.equal(result.success, true);
    assert.equal(result.intent, 'app.close');
    assert.equal(llmCalled, false);
    assert.match(result.response, /request was sent/i);
    assert.match(result.response, /could not verify/i);
    assert.doesNotMatch(result.response, /closed now/i);
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
    assert.equal(result.intent, 'assistant.chat');
    assert.match(result.response, /Doing well/);
    assert.equal(llmInput, 'hi how is your day going');
    assert.equal(result.data.conversational, true);
    assert.equal(result.data.localLlmReply.mode, 'conversation-first');
  });

  it('keeps failed automation replies grounded instead of rephrasing them with the local LLM', async function() {
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
        return {
          success: true,
          response: 'I could not close Chrome. It may already be stopped.',
          data: { localLlm: { modelName: 'test.gguf' } }
        };
      }
    });

    const result = await assistant._processCommandDirect('close chrome', 'chat');

    assert.equal(result.success, false);
    assert.equal(result.intent, 'app.close');
    assert.match(result.response, /^I could not close Chrome/);
    assert.equal(llmCalled, false);
  });

  it('does not use the local LLM as a substitute for unimplemented capability actions', async function() {
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

    const result = await assistant._processCommandDirect('play a story', 'chat');

    assert.equal(result.success, true);
    assert.equal(result.intent, 'assistant.capability');
    assert.equal(llmCalled, false);
    assert.match(result.response, /not connected to an automation controller yet/i);
    assert.doesNotMatch(result.response, /short story/i);
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

  it('grounds the turn prompt on executed task outcomes', function() {
    const prompt = buildTurnPrompt('open chrome', {
      taskOutcome: {
        kind: 'task',
        intent: 'app.open',
        success: true,
        error: null,
        draftReply: 'Opened Chrome.',
        details: 'appName=Chrome, launchMethod=start-menu'
      }
    });
    assert.match(prompt, /Executed-task report/);
    assert.match(prompt, /Intent: app\.open \| Outcome: success/);
    assert.match(prompt, /appName=Chrome/);
    assert.match(prompt, /Confirm this exact completed outcome naturally/);
  });

  it('marks grounded answers as verified facts', function() {
    const prompt = buildTurnPrompt('what was my last command', {
      taskOutcome: {
        kind: 'answer',
        intent: 'assistant.context',
        success: true,
        draftReply: 'Your last command was: open chrome.'
      }
    });
    assert.match(prompt, /verified answer computed by OpenX/);
    assert.match(prompt, /keep every fact exactly as given/);
  });
});
