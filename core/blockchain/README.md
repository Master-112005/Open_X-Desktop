# OpenX Blockchain Foundation

Phase 1 adds an optional Avalanche C-Chain foundation for OpenX. The module is isolated under `core/blockchain`; no assistant, communication, pairing, CloudE2EE, mobile, automation, or renderer code should import Avalanche dependencies directly.

Phase 2 adds the blockchain identity layer. Every installation can create a non-PII device ID, generate a local EVM wallet, persist non-secret identity metadata, and optionally register/verify through an Avalanche `IdentityRegistry` contract.

Phase 3 adds blockchain-backed trusted pairing. The existing CloudPairingManager, relay, CloudE2EE, and communication flow remain in place; blockchain records who paired, when, with which devices, and the pair status.

Phase 4 adds the Device Trust Engine. Trust is checked from local cache before relay packets are sent or emitted to command/file/profile handlers. Avalanche remains the source of truth, but packet authorization does not query blockchain on every packet.

Phase 5 adds blockchain-backed permission management. Avalanche stores permission policy, OpenX caches it locally, and the existing desktop/mobile authorization checks combine OS permission, local policy, and blockchain policy before protected operations run.

## Files

- `index.js`: module export surface used by OpenX startup and future phases.
- `BlockchainService.js`: single entry point for initialization, shutdown, health, diagnostics, provider access, wallet access, and future contract access.
- `AvalancheClient.js`: owns the `ethers` JSON-RPC provider, timeout handling, retry handling, reconnect, block reads, fee reads, and raw RPC calls.
- `NetworkManager.js`: detects chain ID, validates RPC, measures latency, and runs health monitoring.
- `WalletManager.js`: provides wallet infrastructure only. It can load an explicit wallet for future tests/integration, but creation, import, secure storage, and key rotation intentionally throw custom errors until later phases.
- `IdentityManager.js`: generates, loads, persists, registers, verifies, refreshes, and caches the device identity.
- `DeviceIdentity.js`: normalized JSON-safe identity model.
- `IdentityConstants.js`: device types, identity statuses, identity version, and device ID format constants.
- `LocalIdentityStore.js`: stores non-secret identity metadata locally.
- `SecureWalletStore.js`: secure-store abstraction for wallet private keys. Production desktop wiring uses Electron `safeStorage`.
- `ConfigManager.js`: builds environment-based Fuji, future mainnet, and future local configuration.
- `BlockchainEvents.js`: stable event names for lifecycle, health, network, and error changes.
- `BlockchainErrors.js`: custom error hierarchy; generic errors are wrapped before leaving the module.
- `BlockchainLogger.js`: structured, redacted logging with timestamp, level, context, and optional correlation ID.
- `BlockchainHealth.js`: tracks connection, health, latency, last block, last sync, retries, and uptime.
- `BlockchainConstants.js`: network metadata, defaults, and service states.
- `BlockchainTypes.js`: lightweight CommonJS runtime shape helpers.
- `utils/async.js`: timeout and retry primitives.
- `contracts/`: reserved for future contract adapters.
- `contracts/IdentityRegistry.sol`: Phase 2 Solidity registry contract for device identity only.
- `contracts/IdentityRegistryClient.js`: internal contract adapter used by `IdentityManager`; contracts are never exposed directly outside `BlockchainService`.
- `BlockchainPairManager.js`: Phase 3 pairing trust lifecycle.
- `PairRecord.js`: normalized local pair proof model.
- `LocalPairStore.js`: local non-secret pair proof persistence.
- `PairConstants.js`: pair status and version constants.
- `contracts/PairRegistry.sol`: Solidity pairing registry contract.
- `contracts/PairRegistryClient.js`: internal pair registry adapter.
- `DeviceTrustEngine.js`: cache-first communication authorization gate.
- `TrustManager.js`: trust load, cache, refresh, verify, synchronize, update, and shutdown lifecycle.
- `TrustCache.js`: local non-secret trust cache.
- `DeviceTrust.js`: normalized trust record model.
- `TrustConstants.js`: trust statuses, decisions, versions, and sources.
- `contracts/DeviceTrustRegistry.sol`: Solidity trust registry contract.
- `contracts/DeviceTrustRegistryClient.js`: internal trust registry adapter.
- `PermissionManager.js`: cache-first permission authorization, grant/update/remove, synchronization, recovery, and shutdown lifecycle.
- `PermissionCache.js`: local non-secret permission cache.
- `PermissionRecord.js`: normalized permission policy record.
- `PermissionConstants.js`: permission states, decisions, supported names, versions, and sources.
- `contracts/PermissionRegistry.sol`: Solidity permission policy registry contract.
- `contracts/PermissionRegistryClient.js`: internal permission registry adapter.
- `providers/`: reserved for future provider adapters.

## Dependency

`ethers` is the only added runtime dependency. Avalanche C-Chain, Fuji, and local EVM chains expose Ethereum-compatible JSON-RPC, so `ethers` provides the required provider, network, block, fee, wallet, and future contract primitives without pulling in unused Avalanche P-Chain/X-Chain functionality.

## Configuration

Blockchain is disabled by default so OpenX remains local-first.

Set:

```powershell
$env:OPENX_BLOCKCHAIN_ENABLED="true"
$env:OPENX_BLOCKCHAIN_NETWORK="fuji"
$env:OPENX_BLOCKCHAIN_FUJI_RPC_URL="https://api.avax-test.network/ext/bc/C/rpc"
```

Optional:

```powershell
$env:OPENX_BLOCKCHAIN_REQUEST_TIMEOUT_MS="8000"
$env:OPENX_BLOCKCHAIN_CONNECTION_TIMEOUT_MS="8000"
$env:OPENX_BLOCKCHAIN_RETRY_ATTEMPTS="3"
$env:OPENX_BLOCKCHAIN_RETRY_BASE_DELAY_MS="500"
$env:OPENX_BLOCKCHAIN_RETRY_MAX_DELAY_MS="5000"
$env:OPENX_IDENTITY_REGISTRY_ADDRESS="0x..."
$env:OPENX_PAIR_REGISTRY_ADDRESS="0x..."
$env:OPENX_TRUST_REGISTRY_ADDRESS="0x..."
$env:OPENX_PERMISSION_REGISTRY_ADDRESS="0x..."
```

If `OPENX_IDENTITY_REGISTRY_ADDRESS` is empty, identity registration remains `PENDING`. This is expected for local-first installs and development before a registry deployment is configured.

## Device ID Format

Device IDs are random, immutable, non-PII values:

```text
OPENX-<DEVICE-TYPE>-<16 CROCKFORD BASE32 CHARS>
```

Examples:

```text
OPENX-DESKTOP-8D2P9Q6KJ4V1M7TX
OPENX-PHONE-1A9FQ7MD4H2VX6RC
```

The ID is not derived from username, email, MAC address, IP address, motherboard serial, or other personal identifiers.

## Identity Lifecycle

1. Load local identity metadata from the identity store.
2. Load or generate a wallet private key from secure storage.
3. If no identity exists, create `DeviceIdentity` with `PENDING` status.
4. If blockchain and registry are configured, register once with `IdentityRegistry`.
5. Verify using read-only contract calls during startup.
6. If any blockchain operation fails, OpenX continues and logs a warning.

Local metadata contains only `deviceId`, `walletAddress`, `deviceType`, `registeredAt`, `status`, `network`, `version`, `transactionHash`, `blockNumber`, and `lastVerified`.

Private keys are never written to JSON, logs, cache, config, or database files.

## Pairing Trust Lifecycle

1. Desktop requests a normal relay pair token.
2. Desktop creates a random nonce and SHA-256 pair hash from pair token, desktop device ID, desktop wallet, timestamp, and nonce.
3. Desktop registers the pair hash with `PairRegistry` when configured.
4. QR contains the existing relay token plus public blockchain trust metadata.
5. Phone recomputes the pair hash locally and checks the registry when configured.
6. Phone approves the pair on-chain when configured.
7. Phone sends the existing relay pairing request with the pair proof.
8. Desktop verifies the pair status and then continues the existing CloudE2EE pairing flow.

The raw pair token is never stored on-chain.

## Trust Lifecycle

Trust states:

- `TRUSTED`: communication is allowed until cache expiry.
- `PENDING`: verification is required before strict communication can continue.
- `BLOCKED`: communication is denied immediately.
- `REVOKED`: communication is denied immediately.
- `UNKNOWN`: no local trust record exists.
- `EXPIRED`: a trust record exists but must be refreshed.

Trust decisions:

- `ALLOW`: communication proceeds.
- `DENY`: communication stops.
- `PENDING`: caller can request verification or retry later.
- `BLOCKED`: communication stops immediately.

OpenX checks trust before encrypted relay packets are sent and before inbound relay packets are emitted to higher-level cloud handlers. `BLOCKED` and `REVOKED` always deny. Unknown devices are backward-compatible when no trust registry is configured, unless strict trust is enabled.

## Permission Lifecycle

Permission states are `GRANTED`, `DENIED`, `PENDING`, `REVOKED`, `EXPIRED`, and `UNKNOWN`.

Permission decisions are `ALLOW`, `DENY`, `REQUEST`, and `BLOCK`.

OpenX checks permissions before assistant automation, cloud remote commands, schedule sync, notifications, and cloud file-transfer operations. The decision combines:

1. OS permission result.
2. Existing local OpenX permission policy.
3. Cached blockchain permission policy.

Avalanche remains authoritative when `PermissionRegistry.sol` is configured, but normal authorization uses the local `PermissionCache` so lookups stay under the packet/command latency budget. Unknown permissions remain backward-compatible when no permission registry is configured, unless strict permission mode is enabled.

## Verification

Install dependencies:

```powershell
npm install
```

Run blockchain tests:

```powershell
npx mocha "tests/blockchain/**/*.test.js"
```

Expected success: all `Blockchain Foundation` tests pass without requiring network access. These cover foundation, wallet generation, identity generation, pending registration, mocked registration, verification, recovery, and service API behavior.

Run the full validation:

```powershell
npm run lint
npm test
```

Expected success: lint exits with code `0`; Mocha exits with code `0`.

Optional Fuji smoke check:

```powershell
$env:OPENX_BLOCKCHAIN_ENABLED="true"
node -e "const { BlockchainService } = require('./core/blockchain'); const config = require('./config'); (async () => { const svc = new BlockchainService({ config }); const status = await svc.initialize(); console.log(JSON.stringify({ initialized: status.initialized, state: status.state, health: status.health, network: status.network }, null, 2)); await svc.shutdown('smoke'); })().catch(err => { console.error(err); process.exit(1); });"
```

Success criteria: `initialized` is `true`, `network.chainId` is `43113`, and `health.connected` is `true`. Failure cases usually indicate RPC URL, firewall, DNS, proxy, or Fuji service availability issues. OpenX startup still continues when this check fails.

## Debugging

- `BLOCKCHAIN_NETWORK_UNSUPPORTED`: check `OPENX_BLOCKCHAIN_NETWORK`; supported values are `fuji`, `mainnet`, and `local`.
- `BLOCKCHAIN_CHAIN_MISMATCH`: the RPC URL points at a different chain than configured.
- `BLOCKCHAIN_TIMEOUT`: increase timeout variables or check connectivity.
- `BLOCKCHAIN_RETRY_LIMIT`: RPC stayed unavailable after configured retries.
- Wallet creation/import errors are expected in Phase 1; those paths are intentionally reserved for Phase 2+.
- `BLOCKCHAIN_IDENTITY_REGISTRY_NOT_CONFIGURED`: local identity exists but no registry address is configured; status remains `PENDING`.
- `BLOCKCHAIN_IDENTITY_REGISTRATION_FAILED`: transaction failed or the registry rejected the device.
- `BLOCKCHAIN_IDENTITY_VERIFICATION_FAILED`: read-only verification failed; startup continues.
