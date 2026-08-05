const assert = require('assert');

describe('Home Automation assistant routing', function() {
  this.timeout(10000);

  let ActionRouter;

  before(function() {
    ActionRouter = require('../../core/assistant/automation/ActionRouter');
  });

  it('routes home device commands to home.device_control', async function() {
    const executed = [];
    const router = new ActionRouter({
      permissions: { levels: { low: { requiresConfirmation: false, requiresAuth: false } } }
    }, {
      execute(actionId, entities) {
        executed.push({ actionId, entities });
        return {
          success: true,
          data: {
            action: actionId,
            target: entities.target,
            displayTarget: entities.displayTarget,
            homeAction: entities.action,
            requestId: 'home_test',
            verified: true,
            verification: { status: 'passed', check: 'home-packet-created' }
          }
        };
      }
    });

    const result = await router.process('turn on bedroom light', 'chat');

    assert.equal(result.intent, 'home.device_control');
    assert.equal(result.entities.target, 'bedroom_light');
    assert.equal(result.entities.action, 'turn_on');
    assert.equal(executed[0].actionId, 'home.device_control');
  });

  it('answers home device inventory locally instead of searching the web', async function() {
    const executed = [];
    const router = new ActionRouter({
      permissions: { levels: { low: { requiresConfirmation: false, requiresAuth: false } } }
    }, {
      execute(actionId, entities) {
        executed.push({ actionId, entities });
        return {
          success: true,
          data: {
            action: actionId,
            count: 1,
            pairedCount: 1,
            onlineCount: 1,
            devices: [{ deviceName: 'Bed Light', pairingStatus: 'paired', connectionStatus: 'online' }],
            verified: true,
            verification: { status: 'passed', check: 'home-devices-list' }
          }
        };
      }
    });

    const result = await router.process('what are the home device i have', 'chat');

    assert.equal(result.intent, 'home.devices.list');
    assert.notEqual(result.intent, 'browser.search');
    assert.equal(executed[0].actionId, 'home.devices.list');
  });

  it('answers local schedule questions instead of searching the web', async function() {
    const executed = [];
    const router = new ActionRouter({
      permissions: { levels: { low: { requiresConfirmation: false, requiresAuth: false } } }
    }, {
      execute(actionId, entities) {
        executed.push({ actionId, entities });
        return {
          success: true,
          data: {
            action: actionId,
            scope: entities.scope,
            count: 0,
            entries: [],
            verified: true,
            verification: { status: 'passed', check: 'schedule-summary-list' }
          }
        };
      }
    });

    const result = await router.process('what is my today schedule', 'chat');

    assert.equal(result.intent, 'schedule.list');
    assert.notEqual(result.intent, 'browser.search');
    assert.equal(result.entities.scope, 'today');
    assert.equal(executed[0].actionId, 'schedule.list');
  });

  it('routes date questions to system.date rather than time or web search', async function() {
    const executed = [];
    const router = new ActionRouter({
      permissions: { levels: { low: { requiresConfirmation: false, requiresAuth: false } } }
    }, {
      execute(actionId, entities) {
        executed.push({ actionId, entities });
        return {
          success: true,
          data: { action: actionId, date: 'Sunday, August 2, 2026' }
        };
      }
    });

    const result = await router.process('what is the date today', 'chat');

    assert.equal(result.intent, 'system.date');
    assert.notEqual(result.intent, 'system.time');
    assert.notEqual(result.intent, 'browser.search');
    assert.equal(executed[0].actionId, 'system.date');
  });

  it('keeps non-home app opening outside home automation', async function() {
    const router = new ActionRouter({
      permissions: { levels: { low: { requiresConfirmation: false, requiresAuth: false } } }
    }, {
      execute() {
        return { success: true, data: {} };
      }
    });

    const result = await router.process('open chrome', 'chat');

    assert.equal(result.intent, 'app.open');
    assert.notEqual(result.intent, 'home.device_control');
  });
});
