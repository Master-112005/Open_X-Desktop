# Blockchain Permission Management

Phase 5 adds a blockchain-backed permission policy layer without replacing CloudE2EE, relay packets, assistant routing, or mobile pairing.

## Architecture

```text
Assistant / Cloud / Mobile
  -> PermissionManager
  -> PermissionCache
  -> PermissionRegistryClient
  -> PermissionRegistry.sol
  -> Avalanche Fuji
```

Blockchain stores policy. Devices enforce policy. OpenX combines OS permission, local OpenX policy, and blockchain policy into one decision.

## Files

- `core/blockchain/PermissionRecord.js`: normalized permission model.
- `core/blockchain/PermissionCache.js`: local JSON cache; never stores secrets.
- `core/blockchain/PermissionManager.js`: grant, remove, update, check, refresh, synchronize, recover, expire, and shutdown.
- `core/blockchain/contracts/PermissionRegistry.sol`: Avalanche permission policy registry.
- `core/blockchain/contracts/PermissionRegistryClient.js`: internal adapter; contracts are not exposed outside `BlockchainService`.
- `apps/desktop/permissions.js`: existing local validator now calls the blockchain permission provider after local level/auth checks.
- `core/cloud/CloudCommandManager.js`: authorizes remote commands and schedule sync before execution.
- `core/cloud/CloudFileTransferManager.js`: authorizes file-transfer send/control operations.
- `mobile/src/services/permissions.js`: mobile permission cache and cache-first checks.

## Lifecycle

```text
Startup
  -> load PermissionCache
  -> synchronize expired cached entries
  -> start background refresh
  -> continue startup even if Avalanche is unavailable

Request
  -> OS permission
  -> local OpenX policy
  -> cached blockchain policy
  -> ALLOW / DENY / REQUEST / BLOCK

Shutdown
  -> flush cache
  -> stop timers
  -> dispose listeners
```

## States

`GRANTED`, `DENIED`, `PENDING`, `REVOKED`, `EXPIRED`, `UNKNOWN`.

`DENIED` returns `DENY`. `REVOKED` returns `BLOCK`. `EXPIRED` returns `REQUEST` unless offline policy explicitly allows expired granted cache.

## PowerShell

Enable Fuji with permission registry:

```powershell
$env:OPENX_BLOCKCHAIN_ENABLED="true"
$env:OPENX_BLOCKCHAIN_NETWORK="fuji"
$env:OPENX_PERMISSION_REGISTRY_ADDRESS="0xYourPermissionRegistry"
npm start
```

Expected output: OpenX starts; blockchain logs show initialization when RPC is reachable. If the registry is empty, cache-first compatibility remains active unless strict mode is enabled.

Strict permission mode:

```powershell
$env:OPENX_BLOCKCHAIN_PERMISSION_STRICT="true"
$env:OPENX_BLOCKCHAIN_PERMISSION_ALLOW_UNKNOWN_NO_REGISTRY="false"
npm start
```

Expected output: unknown cached permissions return `REQUEST` instead of `ALLOW`.

Verify:

```powershell
npx mocha "tests/blockchain/**/*.test.js"
npm run lint
```

Expected output: blockchain permission tests pass and ESLint exits with code `0`.

Troubleshooting:

- `BLOCKCHAIN_PERMISSION_REGISTRY_ADDRESS_INVALID`: registry address is not a 20-byte EVM address.
- Permission unexpectedly allowed: no registry is configured and compatibility mode is enabled.
- Permission unexpectedly denied: local OpenX policy denied first, or cached state is `DENIED`, `REVOKED`, or `EXPIRED`.
- Startup warning: Avalanche RPC failed; OpenX continues with cache and local policy.

## Extension Points

Future phases can add richer OS permission providers, registry indexing for `ListPermissions`, audit records for each decision, and per-plugin permission scopes without changing the public `BlockchainService` permission API.
