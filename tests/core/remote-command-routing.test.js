const assert = require('assert');

const ActionRouter = require('../../core/assistant/automation/ActionRouter');

function createRouter() {
  const executed = [];
  const router = new ActionRouter({
    permissions: {
      levels: {
        low: { requiresConfirmation: false, requiresAuth: false },
        medium: { requiresConfirmation: false, requiresAuth: false }
      }
    }
  }, {
    execute(actionId, entities) {
      executed.push({ actionId, entities });
      return {
        success: true,
        data: {
          actionId,
          ...(entities || {})
        }
      };
    }
  });
  return { router, executed };
}

describe('Remote command routing', function() {
  it('routes remote direction commands to remote control automation', async function() {
    const { router, executed } = createRouter();

    const result = await router.process('remote right', 'chat');

    assert.equal(result.success, true);
    assert.equal(result.intent, 'remote.control');
    assert.equal(executed[0].actionId, 'remote.control');
    assert.equal(executed[0].entities.targetId, 'active');
    assert.equal(executed[0].entities.action, 'right');
  });

  it('routes named remote app commands with action aliases', async function() {
    const { router, executed } = createRouter();

    const result = await router.process('press ok on youtube remote', 'phone');

    assert.equal(result.success, true);
    assert.equal(result.intent, 'remote.control');
    assert.equal(executed[0].actionId, 'remote.control');
    assert.equal(executed[0].entities.targetId, 'youtube');
    assert.equal(executed[0].entities.action, 'center');
  });

  it('routes remote media next commands separately from directional right commands', async function() {
    const { router, executed } = createRouter();

    const result = await router.process('remote next on youtube', 'phone');

    assert.equal(result.success, true);
    assert.equal(result.intent, 'remote.control');
    assert.equal(executed[0].actionId, 'remote.control');
    assert.equal(executed[0].entities.targetId, 'youtube');
    assert.equal(executed[0].entities.action, 'next');
  });

  it('routes remote next-song wording to the active media target when no app is named', async function() {
    const { router, executed } = createRouter();

    const result = await router.process('remote next song', 'phone');

    assert.equal(result.success, true);
    assert.equal(result.intent, 'remote.control');
    assert.equal(executed[0].entities.targetId, 'active');
    assert.equal(executed[0].entities.action, 'next');
  });

  it('routes remote slideshow commands to presentation controls', async function() {
    const { router, executed } = createRouter();

    const result = await router.process('start slideshow on powerpoint remote', 'phone');

    assert.equal(result.success, true);
    assert.equal(result.intent, 'remote.control');
    assert.equal(executed[0].actionId, 'remote.control');
    assert.equal(executed[0].entities.targetId, 'powerpoint');
    assert.equal(executed[0].entities.action, 'slideshow');
  });

  it('routes remote target discovery commands without invoking generic search', async function() {
    const { router, executed } = createRouter();

    const result = await router.process('show remote apps', 'chat');

    assert.equal(result.success, true);
    assert.equal(result.intent, 'remote.listTargets');
    assert.equal(executed[0].actionId, 'remote.listTargets');
  });

  it('uses cached remote targets when resolving active presentation context', function() {
    const calls = [];
    const router = new ActionRouter({
      permissions: {
        levels: {
          low: { requiresConfirmation: false, requiresAuth: false },
          medium: { requiresConfirmation: false, requiresAuth: false }
        }
      }
    }, {
      execute() {
        return { success: true };
      },
      remote: {
        listTargets(options) {
          calls.push(options);
          return {
            success: true,
            data: {
              targets: [
                {
                  id: 'powerpoint',
                  kind: 'presentation',
                  processName: 'POWERPNT.EXE',
                  windowTitle: 'PowerPoint Slide Show - Quarterly Review'
                }
              ]
            }
          };
        }
      }
    });

    const context = router._getActivePresentationRuntimeContext();

    assert.equal(context.routeSource, 'presentation-active-window');
    assert.equal(context.strong, true);
    assert.deepEqual(calls, [undefined]);
  });
});
