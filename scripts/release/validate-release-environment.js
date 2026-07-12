const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const errors = [];

function fail(message) {
  errors.push(message);
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function requirePath(relativePath, description = relativePath) {
  if (!exists(relativePath)) fail(`Missing required ${description}: ${relativePath}`);
}

function requireScript(packageJson, name) {
  if (!packageJson.scripts || !packageJson.scripts[name]) fail(`package.json is missing required script: ${name}`);
}

function isSemver(value) {
  return /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(String(value || '').trim());
}

function validateNodeVersion(packageJson) {
  const major = Number(process.versions.node.split('.')[0]);
  if (!Number.isInteger(major) || major < 18 || major >= 23) {
    fail(`Node ${process.version} is outside the supported release build range: ${packageJson.engines?.node || '>=18.18.0 <23'}`);
  }
}

function validatePackage(packageJson) {
  if (packageJson.name !== 'openx') fail('package.json name must be "openx".');
  if (!packageJson.productName) fail('package.json productName is required.');
  if (!isSemver(packageJson.version)) fail(`package.json version is not valid semver: ${packageJson.version}`);
  for (const script of ['lint', 'test', 'validate', 'build', 'package']) requireScript(packageJson, script);
  validateNodeVersion(packageJson);
}

function validateElectronBuilder(packageJson) {
  const build = packageJson.build;
  if (!build || typeof build !== 'object') fail('package.json build configuration is required.');
  if (!build?.appId) fail('electron-builder appId is required.');
  if (!build?.productName) fail('electron-builder productName is required.');
  if (build?.asar !== true) fail('electron-builder asar must be enabled for production release.');
  if (build?.directories?.output !== 'dist') fail('electron-builder output directory must be dist.');
  if (!Array.isArray(build?.files) || !build.files.some(item => String(item).startsWith('apps'))) fail('electron-builder files must include apps/**/*.');
  if (!Array.isArray(build?.files) || !build.files.some(item => String(item).startsWith('core'))) fail('electron-builder files must include core/**/*.');
  if (!Array.isArray(build?.files) || !build.files.some(item => String(item).startsWith('plugins'))) fail('electron-builder files must include plugins/**/*.');
  if (!build?.win?.icon) fail('Windows icon is required.');
  if (!build?.win?.artifactName) fail('Windows artifactName is required.');
  const targets = Array.isArray(build?.win?.target) ? build.win.target : [];
  if (!targets.length) fail('At least one Windows build target is required.');
  if (!build?.nsis?.include) fail('NSIS installer include script is required.');
}

function validateRequiredFiles() {
  for (const requiredPath of [
    'package.json',
    'package-lock.json',
    'config.js',
    'apps/desktop/electron/main.js',
    'apps/desktop/preload.js',
    'apps/desktop/settings.js',
    'core',
    'plugins',
    'build/icon.ico',
    'build/icon.png',
    'build/installer.nsh',
    'build/openx-chrome-host.exe',
    'models/parakeet/encoder.int8.onnx',
    'models/parakeet/decoder.int8.onnx',
    'models/parakeet/joiner.int8.onnx',
    'models/parakeet/tokens.txt'
  ]) {
    requirePath(requiredPath);
  }
}

function main() {
  const packageJson = readJson('package.json');
  validatePackage(packageJson);
  validateElectronBuilder(packageJson);
  validateRequiredFiles();

  if (errors.length) {
    console.error('Release environment validation failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`Release environment validation passed for OpenX ${packageJson.version}.`);
}

main();
