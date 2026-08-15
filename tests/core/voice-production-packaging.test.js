const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Voice production packaging', function() {
  const repoRoot = path.join(__dirname, '..', '..');
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const modelLoaderSource = fs.readFileSync(
    path.join(repoRoot, 'apps', 'desktop', 'voice', 'stt', 'ModelLoader.js'),
    'utf8'
  );
  const parakeetEngineSource = fs.readFileSync(
    path.join(repoRoot, 'apps', 'desktop', 'voice', 'stt', 'ParakeetEngine.js'),
    'utf8'
  );
  const mainSource = fs.readFileSync(path.join(repoRoot, 'apps', 'desktop', 'electron', 'main.js'), 'utf8');

  it('ships voice and LLM models as external Electron resources', function() {
    const build = packageJson.build || {};
    const files = build.files || [];
    const unpacked = build.asarUnpack || [];
    const resources = build.extraResources || [];

    assert.strictEqual(build.npmRebuild, false, 'packaging must use installed N-API native artifacts');
    assert.ok(
      resources.some(entry => entry.from === 'models/parakeet' && entry.to === 'models/parakeet'),
      'Parakeet voice models must be copied beside resourcesPath'
    );
    assert.ok(
      resources.some(entry => entry.from === 'models/Llama-3.2-1B' && entry.to === 'models/Llama-3.2-1B'),
      'Local LLM models must be copied beside resourcesPath'
    );
    assert.strictEqual(files.includes('models/**/*'), false);
    assert.strictEqual(unpacked.some(pattern => String(pattern).startsWith('models/')), false);
  });

  it('unpacks native ONNX runtime and configures its DLL path before loading it', function() {
    const unpacked = packageJson.build?.asarUnpack || [];
    assert.ok(unpacked.includes('node_modules/onnxruntime-node/**/*'));

    const configureIndex = parakeetEngineSource.indexOf('configureOnnxRuntimeNativePath();');
    const requireIndex = parakeetEngineSource.indexOf("require('onnxruntime-node')");
    assert.ok(configureIndex >= 0, 'ParakeetEngine must configure ONNX native path');
    assert.ok(requireIndex > configureIndex, 'ONNX native path must be configured before require');
    assert.match(parakeetEngineSource, /process\.resourcesPath[\s\S]*app\.asar\.unpacked[\s\S]*onnxruntime_binding\.node/);
  });

  it('prefers packaged model resources and reports actionable voice failures', function() {
    const resourcesIndex = modelLoaderSource.indexOf("path.join(process.resourcesPath, 'models', 'parakeet')");
    const sourceIndex = modelLoaderSource.indexOf('candidates.push(sourceCandidate)');
    assert.ok(resourcesIndex >= 0, 'ModelLoader must check process.resourcesPath model resources');
    assert.ok(sourceIndex > resourcesIndex, 'Packaged resources must be checked before source-tree models');
    assert.match(modelLoaderSource, /error\.code = 'voice_model_missing'/);
    assert.match(parakeetEngineSource, /error\.code = error\.code \|\| 'voice_onnx_session_failed'/);
    assert.match(mainSource, /function formatVoiceTranscriptionFailure\(error\)/);
    assert.match(mainSource, /Voice model runtime failed to start/);
  });
});
