# Blockchain Module

The blockchain module is an optional service layer for Avalanche Fuji Testnet and future Avalanche networks. It is initialized by the Electron main process after core runtime services are ready, and failures are logged as warnings only.

Phase 2 extends this module with device identity. Identity is still isolated inside `BlockchainService`; callers use `registerIdentity()`, `verifyIdentity()`, `loadIdentity()`, `identityExists()`, `getIdentity()`, and `refreshIdentity()`.

## Architecture

`BlockchainService` is the only public entry point. Future OpenX phases must use service methods instead of importing `ethers`, `AvalancheClient`, or provider classes directly.

Flow:

```text
OpenX startup
  -> BlockchainService
    -> ConfigManager
    -> AvalancheClient
    -> NetworkManager
    -> WalletManager
    -> IdentityManager
    -> Avalanche Fuji RPC
```

The service is dependency-injection friendly: tests can replace the config manager, client, network manager, wallet manager, logger, clock, and provider factory.

## Startup And Shutdown

Startup is non-blocking for the rest of OpenX behavior. `initializeBlockchainRuntime()` logs one of:

- initialized on the configured network
- disabled by configuration
- unavailable, continuing without blockchain

Shutdown calls `BlockchainService.shutdown()`, which stops health timers, disposes network monitoring, clears wallet state, disconnects the provider, and removes listeners.

Identity startup is also non-fatal:

```text
OpenX startup
  -> BlockchainService
  -> IdentityManager.loadIdentity()
  -> WalletManager.ensureWallet()
  -> IdentityRegistry.verifyDevice() when configured
  -> continue even if verification fails
```

## Device Lifecycle

First launch creates a random device ID like `OPENX-DESKTOP-8D2P9Q6KJ4V1M7TX`. The value is immutable and persisted locally. It is not based on user, network, or hardware identifiers.

## Wallet Lifecycle

`WalletManager.ensureWallet()` loads the wallet private key from secure storage or generates a new local wallet. Desktop uses Electron `safeStorage` through the main process adapter. Mobile uses Expo SecureStore. Private keys never enter identity JSON, logs, config, cache, or cloud payloads.

Future import, backup, rotation, and recovery stay behind explicit wallet manager methods and custom errors.

## Registration Lifecycle

Registration uses `IdentityRegistry.registerDevice()` and signs locally with the device wallet. If no registry address is configured, the local identity remains `PENDING`. Registration stores only public metadata: device ID, wallet address, timestamp, device type, status, blockchain version, identity version, transaction hash, and block number.

## Verification Lifecycle

Verification calls `IdentityRegistry.verifyDevice()` as a read-only operation. Failure does not block OpenX startup; it updates status and logs a warning.

## Extension Points

- Identity: add a separate identity module in a later phase and call `BlockchainService` APIs.
- Contracts: add adapters under `core/blockchain/contracts` and expose them through `getContractAccess()`.
- Private L1/local networks: add config under `blockchain.networks.local` or environment overrides.
- Secure wallet storage: extend `WalletManager`; do not store keys in logs or general settings.

## Troubleshooting

Use `getDiagnostics()` when debugging. It redacts secrets and exposes network ID, chain ID, RPC host, timeout settings, retry settings, current health, and last custom error.

Do not log private keys, mnemonics, wallet contents, tokens, or credentials.
