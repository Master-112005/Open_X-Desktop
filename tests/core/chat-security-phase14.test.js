const assert = require('assert');
const crypto = require('crypto');
const { ChatManager, Security } = require('../../core/chat');

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(32).toString('hex')}`;
}

function ok(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return { ok: true, data };
    }
  };
}

describe('OpenX Chat Desktop Security Phase 14', () => {
  it('routes PIN, recovery, trust, and history calls through the security API', async () => {
    const calls = [];
    const accountId = id('acc');
    const deviceId = id('dev');
    const fetchImpl = async (url, options = {}) => {
      const route = new URL(url).pathname;
      const body = options.body ? JSON.parse(options.body) : null;
      calls.push({ route, body });
      if (route === '/security/pin/create') return ok({ accountId, status: 'Active' }, 201);
      if (route === '/security/pin/verify') return ok({ accountId, verified: true });
      if (route === '/security/pin/update') return ok({ accountId, status: 'Active', version: 2 });
      if (route === '/security/recovery/start') return ok({ accountId, recoveryId: 'rec_'.padEnd(52, 'a'), status: 'Started' }, 201);
      if (route === '/security/recovery/complete') return ok({ accountId, recoveryId: body.recoveryId, status: 'Completed' });
      if (route === '/security/device/approve') return ok({ trust: { accountId, deviceId, trustState: 'Trusted' } });
      if (route === '/security/device/revoke') return ok({ accountId, revoked: [{ deviceId }] });
      if (route === '/security/trusted/devices') return ok({ accountId, items: [{ deviceId, trustState: 'Trusted' }] });
      if (route === '/security/login/history') return ok({ accountId, items: [{ sessionId: 'sec_sess_'.padEnd(57, 'b') }] });
      throw new Error(`Unexpected route ${route}`);
    };
    const manager = new Security.SecurityManager({
      config: { apiBaseUrl: 'http://chat.test' },
      fetchImpl
    });

    await manager.createPin({ accountId, pin: '1234' });
    await manager.verifyPin({ accountId, pin: '1234' });
    await manager.updatePin({ accountId, currentPin: '1234', newPin: '5678' });
    const recovery = await manager.startRecovery({ accountId, pin: '5678' });
    await manager.completeRecovery({ accountId, recoveryId: recovery.recoveryId, pin: '5678' });
    await manager.approveDevice({ accountId, deviceId });
    await manager.revokeDevice({ accountId, deviceId, reason: 'lost' });
    const trusted = await manager.trustedDevices(accountId);
    const history = await manager.loginHistory(accountId);

    assert.equal(trusted.items[0].trustState, 'Trusted');
    assert.equal(history.items.length, 1);
    assert.deepEqual(calls.map(call => call.route), [
      '/security/pin/create',
      '/security/pin/verify',
      '/security/pin/update',
      '/security/recovery/start',
      '/security/recovery/complete',
      '/security/device/approve',
      '/security/device/revoke',
      '/security/trusted/devices',
      '/security/login/history'
    ]);
  });

  it('is exposed from the top-level ChatManager with local session support', () => {
    const chat = new ChatManager({
      fetchImpl: async () => ok({}),
      cryptoConfig: { storageBackend: {} }
    });
    const security = chat.getSecurityManager();
    const session = security.sessions.createLocalSession({ accountId: id('acc'), deviceId: id('dev') });

    assert.equal(chat.config.featureFlags.securityPlatform, true);
    assert.equal(security.sessions.validateLocalSession(session.sessionId).valid, true);
    assert.equal(security.sessions.revokeLocalSession(session.sessionId).status, 'Revoked');
  });
});
