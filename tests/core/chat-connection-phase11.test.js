'use strict';

const assert = require('assert');
const EventEmitter = require('events');

const {
  ConnectionConfiguration,
  ConnectionEngine
} = require('../../core/chat/connection');

describe('OpenX Chat Desktop Connection Engine', function() {
  function createConnectionManager(sent) {
    return {
      state: 'offline',
      lastPongAt: null,
      async connect() {
        this.state = 'connected';
        return this.getStatus();
      },
      disconnect() {
        this.state = 'disconnected';
      },
      sendInfrastructureEvent(type, data = {}) {
        sent.push({ type, data });
        return true;
      },
      startHeartbeat() {},
      stopHeartbeat() {},
      getStatus() {
        return { state: this.state, lastPongAt: this.lastPongAt, serverUrl: 'ws://localhost:8090/ws' };
      }
    };
  }

  it('identifies a persistent desktop socket and synchronizes on connect and wake recovery', async function() {
    const sent = [];
    const syncCalls = [];
    const events = [];
    const eventBus = new EventEmitter();
    eventBus.on('desktop.chat.phase11.connected', event => events.push(['connected', event]));
    eventBus.on('desktop.chat.phase11.sync.required', event => events.push(['sync-required', event]));
    eventBus.on('desktop.chat.phase11.sync.completed', event => events.push(['sync-completed', event]));
    eventBus.on('desktop.chat.phase11.recovery.completed', event => events.push(['recovery-completed', event]));

    const engine = new ConnectionEngine({
      config: new ConnectionConfiguration({ syncOnConnect: true, platform: 'windows' }),
      connectionManager: createConnectionManager(sent),
      synchronizationManager: {
        async synchronize(input) {
          syncCalls.push(input);
          return { highestContiguousSequence: Number(input.afterSequence || 0) + 1, envelopes: [] };
        }
      },
      eventBus,
      networkProvider: () => ({ online: true, type: 'wifi' })
    });

    await engine.connect({ accountId: 'acc_1', deviceId: 'dev_1', afterSequence: 4 });
    engine.acceptSession({ sessionId: 'sess_1', sessionExpiresAt: '2030-01-01T00:00:00.000Z' });
    const wake = await engine.wake({ deviceId: 'dev_1', afterSequence: 5 });
    const status = engine.getStatus();

    assert.deepEqual(sent, [
      { type: 'connection:identify', data: { accountId: 'acc_1', deviceId: 'dev_1', platform: 'windows' } }
    ]);
    assert.deepEqual(syncCalls.map(call => call.afterSequence), [4, 5]);
    assert.equal(wake.recovered, true);
    assert.equal(status.presence.state, 'Online');
    assert.equal(status.session.status, 'Active');
    assert(events.some(event => event[0] === 'recovery-completed'));
  });
});
