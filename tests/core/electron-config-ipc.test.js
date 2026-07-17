const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Electron Config IPC', function() {
  const mainScript = fs.readFileSync(
    path.join(__dirname, '..', '..', 'apps', 'desktop', 'electron', 'main.js'),
    'utf8'
  );

  it('should return a clone-safe public runtime config over IPC', function() {
    assert.match(mainScript, /function toIpcSafeValue\(value, seen = new WeakMap\(\)\)/);
    assert.match(mainScript, /if \(type === 'undefined' \|\| type === 'function' \|\| type === 'symbol'\) return undefined;/);
    assert.match(mainScript, /function buildPublicRuntimeConfig\(\) \{/);
    assert.match(mainScript, /delete publicConfig\.desktopActions;/);
    assert.match(mainScript, /delete publicConfig\.visualMemoryApi;/);
    assert.match(mainScript, /return toIpcSafeValue\(publicConfig\);/);
    assert.match(mainScript, /registerIpcHandler\('config:get', async \(\) => \{\s*return buildPublicRuntimeConfig\(\);\s*\}\);/);
    assert.doesNotMatch(mainScript, /registerIpcHandler\('config:get', async \(\) => \{\s*return runtimeConfig;\s*\}\);/);
    assert.doesNotMatch(mainScript, /registerIpcHandler\('config:get', async \(\) => \{\s*return \{[\s\S]*desktopActions: _desktopActions,[\s\S]*\};\s*\}\);/);
  });
});
