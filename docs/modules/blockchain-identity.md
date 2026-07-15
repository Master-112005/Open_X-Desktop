# Blockchain Identity Layer

Phase 2 creates reusable OpenX device identities without implementing pairing, permissions, audit, file verification, eERC, or communication verification.

## Files

- `core/blockchain/IdentityManager.js`: identity lifecycle orchestration.
- `core/blockchain/DeviceIdentity.js`: normalized device identity model.
- `core/blockchain/LocalIdentityStore.js`: non-secret identity metadata persistence.
- `core/blockchain/SecureWalletStore.js`: secure private-key persistence abstraction.
- `core/blockchain/contracts/IdentityRegistry.sol`: Solidity registry contract.
- `core/blockchain/contracts/IdentityRegistryClient.js`: internal registry adapter.
- `OpenX_Mobile/mobile/src/services/blockchainIdentity.js`: Android/mobile identity service with matching lifecycle methods.

## Data Model

```json
{
  "deviceId": "OPENX-DESKTOP-8D2P9Q6KJ4V1M7TX",
  "walletAddress": "0x...",
  "deviceType": "desktop",
  "registeredAt": "2026-07-15T00:00:00.000Z",
  "status": "PENDING",
  "network": "fuji",
  "version": "openx-identity-v1",
  "transactionHash": "0x...",
  "blockNumber": 123,
  "lastVerified": "2026-07-15T00:00:00.000Z"
}
```

No private key, seed phrase, password, token, or personal information belongs in this model.

## PowerShell

Run desktop identity tests:

```powershell
cd C:\Users\rakes\Documents\PROJECTS\Project-Intigerity\OpenX
npx mocha "tests/blockchain/**/*.test.js"
```

Run lint:

```powershell
npm run lint
```

Enable Fuji identity locally:

```powershell
$env:OPENX_BLOCKCHAIN_ENABLED="true"
$env:OPENX_BLOCKCHAIN_NETWORK="fuji"
$env:OPENX_IDENTITY_REGISTRY_ADDRESS="0xYourRegistryAddress"
npm start
```

Run mobile dependency check:

```powershell
cd C:\Users\rakes\Documents\PROJECTS\Project-Intigerity\OpenX_Mobile\mobile
npm ls ethers --depth=0
npm run doctor
```

Expected output: `ethers@6.17.0` is listed, and Expo Doctor reports no dependency mismatch introduced by identity work.

## Troubleshooting

- `PENDING`: registry address is not configured or blockchain is disabled.
- `FAILED`: registration or verification failed. Check RPC URL, registry address, duplicate device registration, and Fuji test AVAX.
- Secure storage failure: Electron `safeStorage` or Expo SecureStore is unavailable; OpenX continues without blocking startup.
- Chain mismatch: RPC URL does not match configured chain ID.
