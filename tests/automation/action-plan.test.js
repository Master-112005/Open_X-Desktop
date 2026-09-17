'use strict';

const assert = require('assert');
const {
  ComputerActionPlanner,
  ComputerActionEngine,
  describeStep
} = require('../../core/automation/action-plan');

function testResolver(clause) {
  const text = String(clause || '').trim();
  const open = text.toLowerCase().match(/^(?:open|launch|start)\s+([a-z0-9_.-]+(?:\s+[a-z0-9_.-]+)?)$/i);
  if (open?.[1]) return { intent: { id: 'app.open' }, entities: { appName: open[1] } };
  if (/^(?:write|type)\s+/i.test(text)) {
    return { intent: { id: 'text.write' }, entities: { text: text.replace(/^(?:write|type)\s+/i, '') } };
  }
  if (/^calculate\s+/i.test(text)) {
    return { intent: { id: 'system.calculate' }, entities: { expression: text.replace(/^calculate\s+/i, '').trim() } };
  }
  if (/^create\s+(?:a|an)?\s*file/i.test(text)) {
    return { intent: { id: 'file.create' }, entities: { filename: 'test.js' } };
  }
  if (/^(?:search|google)\s+/i.test(text)) {
    return { intent: { id: 'browser.search' }, entities: { query: text.replace(/^(?:search|google)\s+/i, '') } };
  }
  if (/^set\s+volume/i.test(text)) {
    return { intent: { id: 'volume.set' }, entities: { value: 50 } };
  }
  if (/^close\s+/i.test(text)) {
    return { intent: { id: 'app.close' }, entities: { appName: text.replace(/^close\s+/i, '') } };
  }
  return null;
}

function testWriteResolver(value) {
  const text = String(value || '').trim();
  const named = text.match(/^(?:my\s+name\s+is|my\s+name|name\s+is|i\s+am|i'?m)\s+(.+)$/i);
  if (named?.[1]) return named[1];
  if (/^(?:my\s+name|name|user\s+name|username)$/i.test(text)) return 'Rakesh';
  return text;
}

function buildPlanner(overrides = {}) {
  return new ComputerActionPlanner({
    resolveIntent: testResolver,
    resolveWritableText: testWriteResolver,
    resolveSystemDate: async () => '27 June 2026',
    userDisplayName: 'Rakesh',
    settleMs: 700,
    logger: null,
    ...overrides
  });
}

describe('ComputerActionPlanner', function() {
  it('should plan open + write compounds and carry the opened app into the write step', async function() {
    const plan = await buildPlanner({ resolveWritableText: testWriteResolver }).buildPlan(
      ['open notepad', 'write my name rakesh'],
      { source: 'chat' }
    );
    assert.ok(plan, 'expected a plan for an open + write compound');
    assert.equal(plan.steps.length, 2);
    assert.equal(plan.steps[0].type, 'open_application');
    assert.equal(plan.steps[0].params.appName, 'notepad');
    assert.equal(plan.steps[1].type, 'type_text');
    assert.equal(plan.steps[1].params.text, 'rakesh');
    assert.equal(plan.steps[1].params.appName, 'notepad');
    assert.equal(plan.steps[1].params.settleDelayMs, 700);
  });

  it('should refuse pure app-open lists so existing list routing keeps working', async function() {
    const plan = await buildPlanner().buildPlan(['open chrome', 'open whatsapp'], { source: 'chat' });
    assert.equal(plan, null);
  });

  it('should refuse compounds containing non-planned intents such as browser search and volume', async function() {
    const searchPlan = await buildPlanner().buildPlan(['open chrome', 'search for latest news'], { source: 'chat' });
    assert.equal(searchPlan, null);
    const volumePlan = await buildPlanner().buildPlan(['close whatsapp', 'set volume to 50'], { source: 'chat' });
    assert.equal(volumePlan, null);
  });

  it('should refuse touch-first compounds without an explicit target', async function() {
    const plan = await buildPlanner().buildPlan(['write hello world', 'close notepad'], { source: 'chat' });
    assert.equal(plan, null);
  });

  it('should resolve "today\'s date" through the system date provider', async function() {
    const plan = await buildPlanner().buildPlan(['open notepad', "write today's date"], { source: 'chat' });
    assert.ok(plan, 'expected a plan for the date write compound');
    assert.equal(plan.steps[1].params.text, '27 June 2026');
  });

  it('should chain a trailing save clause onto previously typed content', async function() {
    const plan = await buildPlanner().buildPlan(
      ['open notepad', "write today's date", 'save it as notes.txt'],
      { source: 'chat' }
    );
    assert.ok(plan, 'expected a plan for the write + save compound');
    assert.equal(plan.steps.length, 3);
    assert.equal(plan.steps[2].type, 'save_file');
    assert.equal(plan.steps[2].params.filename, 'notes.txt');
    assert.equal(plan.steps[2].params.text, '27 June 2026');
  });

  it('should degrade a save clause without prior content into a file creation step', async function() {
    const plan = await buildPlanner().buildPlan(['open notepad', 'save it as notes.txt'], { source: 'chat' });
    assert.ok(plan, 'expected a plan even without prior typed content');
    assert.equal(plan.steps[1].type, 'create_file');
    assert.equal(plan.steps[1].params.filename, 'notes.txt');
  });

  it('should accept a direct "save as <file>" clause with an extension', async function() {
    const plan = await buildPlanner().buildPlan(['open notepad', 'save as notes.txt'], { source: 'chat' });
    assert.ok(plan, 'expected a plan for save as <file>');
    assert.equal(plan.steps[1].type, 'create_file');
    assert.equal(plan.steps[1].params.filename, 'notes.txt');
  });

  it('should plan calculate compounds with the carried app', async function() {
    const plan = await buildPlanner().buildPlan(['open calculator', 'calculate 125 x 48'], { source: 'chat' });
    assert.ok(plan, 'expected a plan for the calculator compound');
    assert.equal(plan.steps[1].type, 'calculate');
    assert.equal(plan.steps[1].params.expression, '125 x 48');
  });

  it('should refuse empty or single-clause input', async function() {
    const empty = await buildPlanner().buildPlan([], { source: 'chat' });
    assert.equal(empty, null);
    const single = await buildPlanner().buildPlan(['open notepad'], { source: 'chat' });
    assert.equal(single, null);
  });

  it('should serialize a plan into a machine-readable action list', async function() {
    const plan = await buildPlanner().buildPlan(['open notepad', 'write my name rakesh'], { source: 'chat' });
    const serialized = ComputerActionPlanner.serialize(plan);
    assert.equal(serialized.steps[0].action, 'open_application');
    assert.equal(serialized.steps[1].params.text, 'rakesh');
    assert.ok(ComputerActionPlanner.toJSON(plan).includes('open_application'));
  });

  it('should describe step types for LLM-facing plans', function() {
    assert.match(describeStep({ type: 'open_application', entities: { appName: 'notepad' } }), /open the app notepad/i);
    assert.match(describeStep({ type: 'wait', entities: { ms: 1000 } }), /wait 1000ms/i);
  });
});

describe('ComputerActionEngine', function() {
  function captureEngine(executed, failActionId = null) {
    return {
      execute(actionId, entities) {
        executed.push({ actionId, entities });
        if (failActionId && actionId === failActionId) {
          return { success: false, error: 'simulated failure' };
        }
        return { success: true, data: { actionId, ...entities } };
      }
    };
  }

  it('should execute plan steps sequentially through the automation engine', async function() {
    const executed = [];
    const engine = new ComputerActionEngine({ automationEngine: captureEngine(executed) });
    const result = await engine.executePlan({
      steps: [
        { type: 'open_application', intent: 'app.open', entities: { appName: 'notepad' }, params: { appName: 'notepad' } }
      ]
    });
    assert.equal(result.success, true);
    assert.deepEqual(executed.map(call => call.actionId), ['app.open']);
  });

  it('should map type_text steps to the text.write action with resolved params', async function() {
    const executed = [];
    const engine = new ComputerActionEngine({ automationEngine: captureEngine(executed) });
    const result = await engine.executePlan({
      steps: [
        { type: 'open_application', intent: 'app.open', entities: { appName: 'notepad' }, params: { appName: 'notepad' } },
        { type: 'type_text', intent: 'text.write', entities: { text: 'Rakesh' }, params: { text: 'Rakesh', appName: 'notepad', settleDelayMs: 700 } }
      ]
    });
    assert.equal(result.success, true);
    assert.deepEqual(executed.map(call => call.actionId), ['app.open', 'text.write']);
    assert.equal(executed[1].entities.text, 'Rakesh');
    assert.equal(executed[1].entities.appName, 'notepad');
  });

  it('should abort the plan on a failed step and not execute the rest', async function() {
    const executed = [];
    const engine = new ComputerActionEngine({ automationEngine: captureEngine(executed, 'app.open') });
    const result = await engine.executePlan({
      steps: [
        { type: 'open_application', intent: 'app.open', entities: { appName: 'notepad' }, params: { appName: 'notepad' } },
        { type: 'type_text', intent: 'text.write', entities: { text: 'Rakesh' }, params: { text: 'Rakesh', appName: 'notepad' } }
      ]
    });
    assert.equal(result.success, false);
    assert.equal(result.failureStepIndex, 0);
    assert.equal(executed.length, 1);
    assert.equal(result.failedStep.intent, 'app.open');
  });

  it('should map calculate steps to the system.calculate action', async function() {
    const executed = [];
    const engine = new ComputerActionEngine({ automationEngine: captureEngine(executed) });
    const result = await engine.executePlan({
      steps: [
        { type: 'calculate', intent: 'system.calculate', entities: { expression: '125 x 48' }, params: { expression: '125 x 48' } }
      ]
    });
    assert.equal(result.success, true);
    assert.deepEqual(executed.map(call => call.actionId), ['system.calculate']);
    assert.equal(executed[0].entities.expression, '125 x 48');
  });

  it('should map window_control to minimize and maximize actions', async function() {
    const executed = [];
    const engine = new ComputerActionEngine({ automationEngine: captureEngine(executed) });
    await engine.executePlan({
      steps: [
        { type: 'window_control', intent: 'window.minimize', entities: {}, params: { operation: 'minimize', windowName: 'notepad' } }
      ]
    });
    assert.deepEqual(executed.map(call => call.actionId), ['window.minimize']);
  });

  it('should handle internal wait steps without delegating to the engine', async function() {
    const executed = [];
    const engine = new ComputerActionEngine({ automationEngine: captureEngine(executed) });
    const result = await engine.executePlan({
      steps: [
        { type: 'wait', intent: 'wait', entities: { ms: 0 }, params: { ms: 0 } }
      ]
    });
    assert.equal(result.success, true);
    assert.equal(executed.length, 0);
  });

  it('should fail cleanly for unsupported step types', async function() {
    const executed = [];
    const engine = new ComputerActionEngine({ automationEngine: captureEngine(executed) });
    const result = await engine.executePlan({
      steps: [{ type: 'teleport', intent: 'bogus', entities: {}, params: {} }]
    });
    assert.equal(result.success, false);
    assert.match(result.failedStep.error, /Unsupported computer action step: teleport/);
  });
});