# Blockchain Pairing Trust

Phase 3 upgrades device pairing trust without replacing OpenX communication. Cloud relay, CloudE2EE, CloudPairingManager, CloudConnectionManager, CloudCommandManager, and the assistant pipeline continue to work as before.

## Files

- `core/blockchain/BlockchainPairManager.js`: creates, verifies, approves, rejects, revokes, refreshes, expires, and synchronizes pair records.
- `core/blockchain/PairRecord.js`: local pair proof data model.
- `core/blockchain/LocalPairStore.js`: stores non-secret pair records locally.
- `core/blockchain/contracts/PairRegistry.sol`: Avalanche pair proof contract.
- `core/blockchain/contracts/PairRegistryClient.js`: internal contract adapter.
- `core/cloud/CloudPairingManager.js`: extended to ask `BlockchainService` for pair trust metadata and verify approved pair proofs before active-QR auto-approval.
- `OpenX_Mobile/mobile/src/services/qrPairing.js`: parses blockchain trust metadata from QR.
- `OpenX_Mobile/mobile/src/services/blockchainIdentity.js`: verifies pair hash and approves the pair.
- `OpenX_Server/src/websocket/RelayWebSocketServer.js`: forwards the phone's blockchain pair proof to desktop.

## Trust Model

Blockchain proves:

- desktop device ID
- phone device ID after approval
- desktop wallet
- phone wallet after approval
- pair hash
- creation time
- approval time
- expiry
- status

Blockchain never carries messages, files, voice, images, sessions, private keys, seed phrases, CloudE2EE material, or raw pair tokens.

## State Machine

```text
PENDING
  -> WAITING_APPROVAL
  -> APPROVED
  -> REJECTED
  -> EXPIRED
  -> REVOKED
  -> FAILED
```

## Sequence

```text
Desktop CloudPairingManager
  -> relay pair token
  -> BlockchainService.createPair()
  -> BlockchainPairManager.createPair()
  -> PairRegistry.createPair()
  -> QR with token + public trust metadata

Phone QR scanner
  -> parse QR
  -> recompute SHA-256 pair hash
  -> verify registry request
  -> PairRegistry.approvePair()
  -> existing relay cloud-pair:request

Desktop
  -> receives relay request
  -> checks pair status APPROVED
  -> existing CloudE2EE approval continues
```

## PowerShell

Run focused tests:

```powershell
cd C:\Users\rakes\Documents\PROJECTS\Project-Intigerity\OpenX
npx mocha "tests/blockchain/**/*.test.js"
```

Run lint:

```powershell
npm run lint
```

Enable registry-backed pairing:

```powershell
$env:OPENX_BLOCKCHAIN_ENABLED="true"
$env:OPENX_BLOCKCHAIN_NETWORK="fuji"
$env:OPENX_IDENTITY_REGISTRY_ADDRESS="0xYourIdentityRegistry"
$env:OPENX_PAIR_REGISTRY_ADDRESS="0xYourPairRegistry"
npm start
```

Mobile dependency/syntax checks:

```powershell
cd C:\Users\rakes\Documents\PROJECTS\Project-Intigerity\OpenX_Mobile\mobile
npm ls ethers --depth=0
npm run doctor
```

## Troubleshooting

- Pair remains relay-only: `OPENX_PAIR_REGISTRY_ADDRESS` is empty.
- Pair verification failed: QR metadata changed, token mismatch, wrong desktop wallet, wrong network, or pair expired.
- Desktop does not auto-approve: pair was not approved on-chain or the relay did not forward the `blockchain` proof.
- Mobile approval failed: phone wallet lacks Fuji AVAX, registry address is wrong, or identity is not initialized.
- Startup warnings: pending/expired pair sync is non-fatal and OpenX continues.
