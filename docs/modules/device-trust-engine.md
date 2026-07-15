# Device Trust Engine

Phase 4 adds a cache-first zero trust authorization layer for device-to-device communication. It does not redesign CloudE2EE, Cloud Relay, CloudPairingManager, CloudCommandManager, CloudFileTransferManager, or the assistant pipeline.

## Files

- `core/blockchain/DeviceTrustEngine.js`: synchronous trust decision engine used at communication boundaries.
- `core/blockchain/TrustManager.js`: asynchronous synchronization with cache and Avalanche.
- `core/blockchain/TrustCache.js`: local non-secret trust cache.
- `core/blockchain/DeviceTrust.js`: trust data model.
- `core/blockchain/contracts/DeviceTrustRegistry.sol`: Avalanche trust registry.
- `core/blockchain/contracts/DeviceTrustRegistryClient.js`: internal registry client.
- `core/cloud/CloudConnectionManager.js`: outbound and inbound relay packet trust gate.
- `OpenX_Mobile/mobile/src/services/blockchainIdentity.js`: mobile trust cache and decision API.
- `OpenX_Mobile/mobile/src/services/relayClient.js`: mobile outbound and inbound relay packet trust gate.

## Model

```json
{
  "deviceId": "OPENX-PHONE-...",
  "walletAddress": "0x...",
  "trustStatus": "TRUSTED",
  "lastVerified": "2026-07-15T00:00:00.000Z",
  "expiresAt": "2026-07-16T00:00:00.000Z",
  "version": "openx-trust-v1",
  "network": "fuji",
  "transactionHash": "0x...",
  "blockNumber": 123,
  "source": "blockchain"
}
```

The cache never stores private keys, seed phrases, passwords, tokens, CloudE2EE keys, messages, files, or command contents.

## Authorization Flow

```text
Cloud relay packet
  -> DeviceTrustEngine.checkTrust()
  -> ALLOW: packet continues to CloudE2EE/relay or higher-level handler
  -> PENDING: packet is rejected or caller may refresh trust
  -> BLOCKED/REVOKED: packet is denied immediately
```

The hot path is local cache only and should complete under 10 ms. Blockchain refresh is asynchronous and handled by `TrustManager`.

## Cache Policy

- Valid `TRUSTED` cache allows communication.
- `BLOCKED` and `REVOKED` always deny.
- Expired cache returns `PENDING` by default.
- If Avalanche is unavailable, valid cache can continue.
- Unknown devices are allowed when no trust registry is configured, unless strict mode is enabled.

Strict mode:

```powershell
$env:OPENX_BLOCKCHAIN_TRUST_STRICT="true"
```

## PowerShell

Run focused trust tests:

```powershell
cd C:\Users\rakes\Documents\PROJECTS\Project-Intigerity\OpenX
npx mocha "tests/blockchain/**/*.test.js"
```

Run lint:

```powershell
npm run lint
```

Enable trust registry:

```powershell
$env:OPENX_BLOCKCHAIN_ENABLED="true"
$env:OPENX_TRUST_REGISTRY_ADDRESS="0xYourTrustRegistry"
$env:OPENX_BLOCKCHAIN_TRUST_CACHE_TTL_MS="86400000"
npm start
```

Mobile checks:

```powershell
cd C:\Users\rakes\Documents\PROJECTS\Project-Intigerity\OpenX_Mobile\mobile
npm ls ethers --depth=0
npm run doctor
```

## Troubleshooting

- `trust-denied`: peer device is `BLOCKED`, `REVOKED`, expired, or strict mode has no trust record.
- Unknown devices still work: no trust registry is configured and backward-compatible unknown policy is active.
- Avalanche outage: valid trust cache continues; expired records return `PENDING`.
- Missing trust cache: pair the device again or refresh trust after registry deployment.
- Mobile relay packet denied: check mobile trust cache under `@openx/blockchain/trustCache`.
