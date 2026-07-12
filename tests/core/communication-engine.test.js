const assert = require('assert');
const EventEmitter = require('events');
const {
  CommunicationEngine,
  CommunicationEvents,
  OperationScheduler
} = require('../../core/communication');
const CommunicationsController = require('../../core/automation/communications');

describe('Communication Engine', function() {
  class FakeProvider extends EventEmitter {
    constructor() {
      super();
      this.id = 'fake';
      this.name = 'Fake';
    }

    async ensureReady(options) {
      this.readyOptions = options;
      return { page: true };
    }

    async composeMessage(recipient, message, options) {
      this.composeOptions = options;
      return { success: true, data: { provider: this.id, recipient, message, delivery: 'draft' } };
    }

    async send(draftId) {
      return { success: true, data: { draftId, delivery: 'sent' } };
    }

    async cancel(draftId) {
      return { success: true, data: { draftId, cancelled: true } };
    }

    async health() {
      return { provider: this.id, connected: true, state: 'ready' };
    }

    async disconnect() {
      this.disconnected = true;
    }
  }

  it('starts without registering a default chat provider', async function() {
    const engine = new CommunicationEngine({
      config: { communication: { defaultProvider: '' } }
    });

    const health = await engine.start();

    assert.equal(health.started, true);
    assert.equal(health.defaultProvider, '');
    assert.deepEqual(health.providers, {});
    assert.deepEqual(engine.listProviders(), []);
  });

  it('returns provider-not-found when no communication provider is registered', async function() {
    const engine = new CommunicationEngine({
      config: { communication: { defaultProvider: '' } }
    });

    const result = await engine.prepareMessage({
      provider: 'missing-provider',
      recipient: 'Mohit',
      message: 'Hi',
      timeoutMs: 1000
    });

    assert.equal(result.success, false);
    assert.equal(result.code, 'PROVIDER_NOT_FOUND');
  });

  it('delegates message preparation through explicitly registered providers', async function() {
    const provider = new FakeProvider();
    const engine = new CommunicationEngine({
      config: { communication: { defaultProvider: 'fake', autoStart: false } }
    });
    engine.registerProvider(provider);

    const result = await engine.prepareMessage({
      provider: 'fake',
      recipient: 'Mohit',
      message: 'Hi',
      background: true,
      timeoutMs: 7000
    });

    assert.equal(result.success, true);
    assert.equal(result.data.delivery, 'draft');
    assert.equal(result.data.recipient, 'Mohit');
    assert.equal(provider.readyOptions.background, true);
    assert.ok(provider.readyOptions.timeoutMs <= 7000);
    assert.ok(provider.readyOptions.signal);
    assert.ok(provider.readyOptions.operationContext);
    assert.equal(provider.composeOptions.readyOptions, provider.readyOptions);
    assert.equal(provider.composeOptions.operationContext, provider.readyOptions.operationContext);
    assert.equal(provider.composeOptions.signal, provider.readyOptions.signal);
  });

  it('forwards cancellation signals through message preparation', async function() {
    const controller = new AbortController();
    const provider = new FakeProvider();
    const engine = new CommunicationEngine({
      config: { communication: { defaultProvider: 'fake', autoStart: false } }
    });
    engine.registerProvider(provider);

    const result = await engine.prepareMessage({
      provider: 'fake',
      recipient: 'Mohit',
      message: 'Hi',
      timeoutMs: 5000,
      signal: controller.signal
    });

    assert.equal(result.success, true);
    assert.ok(provider.readyOptions.signal);
    assert.notEqual(provider.readyOptions.signal, controller.signal);
    assert.equal(provider.composeOptions.signal, provider.readyOptions.signal);
    assert.equal(provider.composeOptions.readyOptions.signal, provider.readyOptions.signal);
    assert.equal(provider.composeOptions.operationContext.signal, provider.readyOptions.signal);
  });

  it('publishes registered provider events through the engine', function(done) {
    const provider = new FakeProvider();
    const engine = new CommunicationEngine({
      config: { communication: { defaultProvider: 'fake', autoStart: false } }
    });
    engine.registerProvider(provider);

    engine.once(CommunicationEvents.ERROR, event => {
      assert.equal(event.provider, 'fake');
      assert.equal(event.code, 'TEST_ERROR');
      assert.ok(event.timestamp);
      done();
    });
    provider.emit(CommunicationEvents.ERROR, { provider: 'fake', code: 'TEST_ERROR' });
  });

  it('keeps chat-provider message composition unsupported', async function() {
    const controller = new CommunicationsController({});

    const result = await controller.composeMessage('Mohit', 'Hi', 'signal');

    assert.equal(result.success, false);
    assert.equal(result.error, 'Messaging platform not supported: signal');
  });

  it('still supports standard phone calls by direct number', async function() {
    const controller = new CommunicationsController({});
    let launched = null;
    controller._launchUri = uri => {
      launched = uri;
    };
    const result = await controller.startCall('+91 98765 43210', 'phone');

    assert.equal(result.success, true);
    assert.equal(result.data.platform, 'phone');
    assert.equal(result.data.phone, '+919876543210');
    assert.equal(launched, 'tel:+919876543210');
  });

  it('refuses non-phone call platforms', async function() {
    const controller = new CommunicationsController({});
    const result = await controller.startCall('Mohit', 'signal');

    assert.equal(result.success, false);
    assert.equal(result.error, 'Calling platform not supported: signal');
  });

  it('refuses to start a scheduler stage when remaining time is below the minimum duration', async function() {
    let executed = false;
    const controller = new AbortController();
    const scheduler = new OperationScheduler({
      context: {
        operationId: 'op-insufficient-time',
        deadlineAt: Date.now() + 50,
        controller,
        signal: controller.signal
      },
      logger: { info() {}, warn() {} },
      stageMetadata: {
        expensiveStage: {
          minimumMs: 200,
          typicalMs: 500,
          maximumMs: 1000
        }
      }
    });

    await assert.rejects(
      () => scheduler.execute('expensiveStage', async () => {
        executed = true;
      }, { timeoutMs: 1000 }),
      error => error.code === 'INSUFFICIENT_REMAINING_TIME' &&
        error.context.stage === 'expensiveStage'
    );
    assert.equal(executed, false);
    assert.equal(controller.signal.aborted, true);
  });

  it('reuses a cacheable scheduler stage instead of executing duplicate validation', async function() {
    let executions = 0;
    const scheduler = new OperationScheduler({
      context: {
        operationId: 'op-stage-cache',
        deadlineAt: Date.now() + 5000
      },
      logger: { info() {}, warn() {} },
      stageMetadata: {
        detectState: {
          minimumMs: 100,
          maximumMs: 1000,
          cacheable: true,
          cacheTtlMs: 5000,
          produces: ['sessionState']
        }
      }
    });

    const first = await scheduler.execute('detectState', async () => {
      executions += 1;
      return { state: 'CONNECTED' };
    }, { timeoutMs: 1000 });
    const second = await scheduler.execute('detectState', async () => {
      executions += 1;
      return { state: 'UNKNOWN' };
    }, { timeoutMs: 1000 });

    assert.equal(executions, 1);
    assert.deepEqual(first, { state: 'CONNECTED' });
    assert.deepEqual(second, { state: 'CONNECTED' });
    assert.deepEqual(scheduler.getOutput('sessionState'), { state: 'CONNECTED' });
  });
});
