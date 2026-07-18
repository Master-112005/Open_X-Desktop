const assert = require('assert');
const { State, ChatStatusManager } = require('../../core/chat');

describe('Desktop Chat Runtime State', function() {
  const { ChatRuntimeStateMachine } = State;

  it('should derive readiness from account, device, identity, and session gates', function() {
    assert.equal(ChatRuntimeStateMachine.derive({}).runtimeState, 'UNINITIALIZED');
    assert.equal(ChatRuntimeStateMachine.derive({ apiBaseUrl: 'http://localhost:8090' }).runtimeState, 'SERVER_CONNECTED');
    assert.equal(ChatRuntimeStateMachine.derive({
      apiBaseUrl: 'http://localhost:8090',
      accountVerified: true
    }).runtimeState, 'ACCOUNT_VERIFIED');
    assert.deepEqual(ChatRuntimeStateMachine.derive({
      apiBaseUrl: 'http://localhost:8090',
      accountVerified: true,
      deviceRegistered: true,
      device: { deviceStatus: 'Pending', approvalStatus: 'Pending' }
    }), {
      runtimeState: 'DEVICE_APPROVAL_REQUIRED',
      chatReady: false,
      blockingReason: 'device_approval_required',
      serverConnected: true,
      accountVerified: true,
      deviceRegistered: true,
      deviceApproved: false,
      identityReady: false,
      sessionReady: false
    });
    assert.equal(ChatRuntimeStateMachine.derive({
      apiBaseUrl: 'http://localhost:8090',
      accountVerified: true,
      deviceRegistered: true,
      device: { deviceStatus: 'Active', approvalStatus: 'Approved' },
      identityReady: true,
      sessionReady: true
    }).runtimeState, 'CHAT_READY');
  });

  it('should expose runtime status through the ChatStatusManager', function() {
    const manager = new ChatStatusManager();
    manager.setState('started');
    assert.equal(manager.getStatus().runtimeState, 'UNINITIALIZED');

    manager.setState('connecting');
    assert.equal(manager.getStatus().runtimeState, 'SERVER_CONNECTED');

    manager.setContext({
      apiBaseUrl: 'http://localhost:8090',
      accountVerified: true,
      deviceRegistered: true,
      device: { deviceStatus: 'Active', approvalStatus: 'Approved' },
      identityReady: true,
      sessionReady: true
    });
    const status = manager.getStatus();
    assert.equal(status.runtimeState, 'CHAT_READY');
    assert.equal(status.chatReady, true);
    assert.equal(status.blocked, false);
  });
});
