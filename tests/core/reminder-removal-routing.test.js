const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Reminder Removal Routing', function() {
  this.timeout(10000);
  let ActionRouter;
  let AutomationEngine;
  let dataDir;
  let engine;
  let router;

  before(function() {
    ActionRouter = require('../../core/assistant/automation/ActionRouter');
    AutomationEngine = require('../../core/automation/index');
  });

  beforeEach(async function() {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-reminder-remove-'));
    const config = {
      app: { dataDir, cleanupLegacySchedules: false },
      permissions: { levels: { low: { requiresConfirmation: false, requiresAuth: false } } }
    };
    engine = new AutomationEngine(config);
    await engine.init();
    router = new ActionRouter(config, engine);
  });

  afterEach(function() {
    try {
      engine?.scheduler?.destroy?.();
    } catch {
      // ignore
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('should route a targeted deletion to reminder.remove with the target captured', async function() {
    await engine.scheduler.setReminder('drink water', { duration: 30 });
    await engine.scheduler.setReminder('call mom', { duration: 45 });

    const result = await router.process('delete the water reminder', 'chat');

    assert.equal(result.intent, 'reminder.remove');
    assert.equal(result.entities.target, 'water');
    assert.equal(result.success, true);
    assert.equal(engine.scheduler.listSchedules('Reminder', 'active').data.count, 1);
  });

  it('should route numbered deletion to reminder.remove', async function() {
    await engine.scheduler.setReminder('first task', { duration: 30 });
    await engine.scheduler.setReminder('second task', { duration: 45 });

    const result = await router.process('delete reminder 2', 'chat');

    assert.equal(result.intent, 'reminder.remove');
    assert.equal(result.entities.target, '2');
    assert.equal(result.success, true);
    assert.equal(engine.scheduler.listSchedules('Reminder', 'active').data.entries[0].message, 'first task');
  });

  it('should ask for clarification when several reminders match a target', async function() {
    await engine.scheduler.setReminder('water the plants', { duration: 30 });
    await engine.scheduler.setReminder('drink water', { duration: 45 });

    const result = await router.process('delete the water reminder', 'chat');

    assert.equal(result.intent, 'reminder.remove');
    assert.equal(result.needsClarification, true);
    assert.equal(result.data.clarificationType, 'schedule.remove');
    assert.equal(result.data.choices.length, 2);

    const choice = result.data.choices[0];
    const confirmed = await router.confirmAndExecute(
      result.commandId,
      result.intent,
      { target: 'water', ...choice.entities },
      { source: 'chat', originalInput: 'delete the water reminder' }
    );

    assert.equal(confirmed.success, true);
    assert.equal(engine.scheduler.listSchedules('Reminder', 'active').data.count, 1);
  });

  it('should keep latest-only and clear-all reminder commands intact', async function() {
    await engine.scheduler.setReminder('drink water', { duration: 30 });
    await engine.scheduler.setReminder('call mom', { duration: 45 });

    const latest = await router.process('delete this reminder', 'chat');
    assert.equal(latest.intent, 'reminder.cancel');
    assert.equal(engine.scheduler.listSchedules('Reminder', 'active').data.count, 1);

    const cleared = await router.process('delete all reminders', 'chat');
    assert.equal(cleared.intent, 'reminder.clear');
    assert.equal(engine.scheduler.listSchedules('Reminder', 'active').data.count, 0);
  });

  it('should report a helpful error when the target does not exist', async function() {
    await engine.scheduler.setReminder('drink water', { duration: 30 });

    const result = await router.process('delete the groceries reminder', 'chat');

    assert.equal(result.intent, 'reminder.remove');
    assert.equal(result.success, false);
    assert.match(result.error, /groceries|no active reminder/i);
    assert.equal(engine.scheduler.listSchedules('Reminder', 'active').data.count, 1);
  });
});
