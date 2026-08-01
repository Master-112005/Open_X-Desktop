const assert = require('assert');
const { HomeCommandClient } = require('../../core/home-automation');

describe('Home command client', function() {
  it('uses a short default timeout for direct relay commands', function() {
    const client = new HomeCommandClient();
    assert.equal(client.timeoutMs, 4500);
    client.dispose();
  });

  it('matches command results by originalRequestId when the device uses its own result request id', async function() {
    let handler = null;
    let sentPacket = null;
    const client = new HomeCommandClient({
      subscribe: callback => {
        handler = callback;
        return () => {};
      },
      sendPacket: packet => {
        sentPacket = packet;
        return true;
      },
      now: () => 1000,
      timeoutMs: 1000
    });

    const pending = client.sendCommand({
      deviceId: 'home_device_1',
      ownerId: 'owner_1',
      action: 'turn_off'
    });

    handler({
      type: 'home:command-result',
      requestId: 'device_result_1',
      originalRequestId: sentPacket.requestId,
      status: 'success',
      result: {
        message: 'relay already off',
        relayState: 'off',
        changed: false
      }
    });

    const result = await pending;
    assert.equal(result.success, true);
    assert.equal(result.message, 'relay already off');
    assert.deepEqual(result.result, {
      message: 'relay already off',
      relayState: 'off',
      changed: false
    });
    client.dispose();
  });
});
