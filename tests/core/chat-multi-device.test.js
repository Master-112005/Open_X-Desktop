'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  MultiDeviceConfiguration,
  MultiDeviceManager
} = require('../../core/chat/multidevice');

describe('OpenX Chat Multi-Device Desktop Manager', function() {
  function createFetch(calls) {
    return async (url, options = {}) => {
      const parsed = new URL(url);
      const body = options.body ? JSON.parse(options.body) : null;
      calls.push({ url, pathname: parsed.pathname, search: parsed.search, method: options.method, body });
      if (parsed.pathname.endsWith('/devices')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              ok: true,
              data: {
                multiDeviceAccount: { accountId: 'acc_1', deviceCount: 2 },
                trustedDevices: [{ deviceId: 'dev_desktop' }, { deviceId: 'dev_mobile' }]
              }
            };
          }
        };
      }
      if (parsed.pathname === '/device/synchronize') {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              ok: true,
              data: {
                deviceId: body.deviceId,
                envelopes: [{ envelopeId: 'env_2', mailboxSequence: 2 }],
                highestContiguousSequence: 2
              }
            };
          }
        };
      }
      if (parsed.pathname === '/device/consistency') {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              ok: true,
              data: {
                consistencyId: 'consistency_1',
                accountId: body.accountId,
                consistent: true,
                deviceReports: []
              }
            };
          }
        };
      }
      if (parsed.pathname === '/device/status') {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              ok: true,
              data: {
                deviceId: parsed.searchParams.get('deviceId'),
                currentSequence: 2,
                cursorSequence: 2,
                lastAck: 1,
                queue: { deviceId: parsed.searchParams.get('deviceId'), currentSequence: 2, pendingCount: 1 }
              }
            };
          }
        };
      }
      return {
        ok: false,
        status: 404,
        async json() {
          return { ok: false, error: { code: 'not_found', message: 'not found' } };
        }
      };
    };
  }

  it('calls Phase 10 endpoints, emits sync events, and stores local consistency/queue metadata', async function() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-chat-multidevice-'));
    const storagePath = path.join(tempDir, 'OpenX_Data', 'chat-multi-device.json');
    const calls = [];
    const events = [];
    const eventBus = new EventEmitter();
    eventBus.on('device.sync.started', event => events.push(['started', event]));
    eventBus.on('device.sync.completed', event => events.push(['completed', event]));
    eventBus.on('device.consistency.updated', event => events.push(['consistency', event]));
    eventBus.on('device.queue.updated', event => events.push(['queue', event]));

    const manager = new MultiDeviceManager({
      config: new MultiDeviceConfiguration({
        apiBaseUrl: 'http://127.0.0.1:18090',
        requestTimeoutMs: 5000,
        storagePath
      }),
      fetchImpl: createFetch(calls),
      eventBus
    });

    const devices = await manager.listDevices('acc_1');
    const sync = await manager.synchronizeDevice({ deviceId: 'dev_desktop', afterSequence: 1 });
    const consistency = await manager.validateConsistency({ accountId: 'acc_1' });
    const status = await manager.status('dev_desktop');
    const stored = JSON.parse(fs.readFileSync(storagePath, 'utf8'));

    assert.equal(devices.multiDeviceAccount.deviceCount, 2);
    assert.equal(sync.highestContiguousSequence, 2);
    assert.equal(consistency.consistent, true);
    assert.equal(status.lastAck, 1);
    assert.deepEqual(calls.map(call => call.pathname), [
      '/account/acc_1/devices',
      '/device/synchronize',
      '/device/consistency',
      '/device/status'
    ]);
    assert.deepEqual(events.map(event => event[0]), [
      'started',
      'completed',
      'consistency',
      'consistency',
      'queue'
    ]);
    assert.equal(stored.deviceConsistency.length, 1);
    assert.equal(stored.deviceQueues[0].deviceId, 'dev_desktop');
  });
});
