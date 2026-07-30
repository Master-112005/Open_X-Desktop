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
