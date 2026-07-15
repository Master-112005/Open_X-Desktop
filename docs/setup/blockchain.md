# Avalanche Fuji Setup

Blockchain support is optional and disabled by default.

## Enable Fuji

```powershell
$env:OPENX_BLOCKCHAIN_ENABLED="true"
$env:OPENX_BLOCKCHAIN_NETWORK="fuji"
$env:OPENX_BLOCKCHAIN_FUJI_RPC_URL="https://api.avax-test.network/ext/bc/C/rpc"
$env:OPENX_IDENTITY_REGISTRY_ADDRESS=""
$env:OPENX_PAIR_REGISTRY_ADDRESS=""
$env:OPENX_TRUST_REGISTRY_ADDRESS=""
$env:OPENX_PERMISSION_REGISTRY_ADDRESS=""
npm start
```

If Fuji is unavailable, OpenX still starts and all non-blockchain features remain functional.

Leaving `OPENX_IDENTITY_REGISTRY_ADDRESS` empty creates a local identity and wallet but keeps registration `PENDING`. Set it to a deployed `IdentityRegistry.sol` address to enable registration and verification.

Leaving `OPENX_PAIR_REGISTRY_ADDRESS` empty keeps pairing backward compatible and relay-only. Set it to a deployed `PairRegistry.sol` address to require blockchain pair approval before desktop auto-approval.

Leaving `OPENX_TRUST_REGISTRY_ADDRESS` empty keeps the trust engine cache-first and backward compatible for unknown devices. Set it to a deployed `DeviceTrustRegistry.sol` address and optionally enable strict mode to deny unknown devices.

Leaving `OPENX_PERMISSION_REGISTRY_ADDRESS` empty keeps the permission manager cache-first and backward compatible for unknown permissions. Set it to a deployed `PermissionRegistry.sol` address and optionally set `$env:OPENX_BLOCKCHAIN_PERMISSION_STRICT="true"` to request/deny unknown permissions instead of allowing them.

## Validate Locally

```powershell
npm install
npx mocha "tests/blockchain/**/*.test.js"
npm run lint
npm test
```

Optional live RPC check:

```powershell
$env:OPENX_BLOCKCHAIN_ENABLED="true"
node -e "const { BlockchainService } = require('./core/blockchain'); const config = require('./config'); (async () => { const svc = new BlockchainService({ config }); const status = await svc.initialize(); console.log(JSON.stringify(status.health, null, 2)); await svc.shutdown('setup-check'); })();"
```

Expected live result: `connected: true`, `healthy: true`, a numeric `lastBlock`, and a non-null `latencyMs`.

## Common Failures

- Timeout: RPC endpoint is slow or blocked.
- Chain mismatch: RPC URL is not Fuji C-Chain.
- Retry limit reached: endpoint failed after configured retries.
- Disabled: `OPENX_BLOCKCHAIN_ENABLED` is not `true`.
- Pending identity: registry address is not configured.
- Registration failed: wallet has no test AVAX, registry address is wrong, or the device/wallet is already registered.
- Permission denied: local OpenX policy, OS policy, or cached blockchain policy denied the protected operation.
