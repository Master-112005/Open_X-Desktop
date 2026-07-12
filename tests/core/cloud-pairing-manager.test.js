const { expect } = require('chai');
const EventEmitter = require('events');
const { CloudE2EE, CloudPairingManager } = require('../../core/cloud');

function createConnection() {
  const connection = new EventEmitter();
  connection.isConnected = () => true;
  connection.getStatus = () => ({ relayUrl: 'wss://relay.example.com/ws' });
  connection.approvals = [];
  connection.e2eeKeys = [];
  connection.approvePairingRequest = (pairRequestId, security) => {
    connection.approvals.push({ pairRequestId, security });
    return true;
  };
  connection.rejectPairingRequest = () => true;
  connection.setE2EEMasterKey = key => {
    connection.e2eeKeys.push(key);
    return true;
  };
  return connection;
}

function createManager(connection, secureStore) {
  const manager = new CloudPairingManager({
    connectionManager: connection,
    logger: { info() {}, warn() {}, error() {} },
    secureKeyStore: secureStore,
    now: () => 1000
  });
  manager.currentPairing = {
    tokenId: 'token-1',
    pairingSecret: CloudE2EE.generateSecret(),
    masterKey: CloudE2EE.generateSecret()
  };
  manager.pendingRequests.set('pair-1', {
    pairRequestId: 'pair-1',
    tokenId: 'token-1'
  });
  return manager;
}

describe('CloudPairingManager secure pairing', () => {
  it('enables E2EE only after the relay confirms security delivery', () => {
    const connection = createConnection();
    const secureStore = {
      saved: [],
      saveMasterKey(key) { this.saved.push(key); },
      deleteMasterKey() { this.deleted = true; }
    };
    const manager = createManager(connection, secureStore);
    const masterKey = manager.currentPairing.masterKey;

    const approved = manager.approvePairing('pair-1');
    expect(approved.success).to.equal(true);
    expect(connection.approvals).to.have.length(1);
    expect(connection.e2eeKeys).to.deep.equal([]);
    expect(secureStore.saved).to.deep.equal([]);

    manager.handlePairingResult({
      type: 'cloud-pair:paired',
      pairRequestId: 'pair-1',
      security: connection.approvals[0].security
    });

    expect(connection.e2eeKeys).to.deep.equal([masterKey]);
    expect(secureStore.saved).to.have.length(1);
    expect(secureStore.deleted).to.not.equal(true);
  });

  it('clears pending E2EE when the relay does not echo security', () => {
    const connection = createConnection();
    const secureStore = {
      saved: [],
      deleted: false,
      saveMasterKey(key) { this.saved.push(key); },
      deleteMasterKey() { this.deleted = true; }
    };
    const manager = createManager(connection, secureStore);

    const masterKey = manager.currentPairing.masterKey;
    manager.approvePairing('pair-1');
    manager.handlePairingResult({
      type: 'cloud-pair:paired',
      pairRequestId: 'pair-1'
    });

    expect(masterKey).to.be.a('string').and.not.equal('');
    expect(connection.e2eeKeys).to.deep.equal(['']);
    expect(secureStore.saved).to.deep.equal([]);
    expect(secureStore.deleted).to.equal(true);
  });
});
