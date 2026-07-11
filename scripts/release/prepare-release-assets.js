const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const dist = path.join(root, 'dist');
const allowedExtensions = new Set(['.exe', '.msi', '.zip']);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function writeOutput(name, value) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) return;
  fs.appendFileSync(output, `${name}=${String(value).replace(/\r?\n/g, ' ')}\n`);
}

function walk(directory, results = []) {
  if (!fs.existsSync(directory)) return results;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!/unpacked/i.test(entry.name)) walk(fullPath, results);
      continue;
    }
    results.push(fullPath);
  }
  return results;
}

function isInstaller(filePath) {
  const name = path.basename(filePath).toLowerCase();
  const extension = path.extname(name);
  if (!allowedExtensions.has(extension)) return false;
  if (name.includes('blockmap')) return false;
  if (name.includes('uninstaller')) return false;
  if (name === 'elevate.exe') return false;
  return true;
}

function installerType(filePath) {
  const name = path.basename(filePath).toLowerCase();
  const extension = path.extname(name);
  if (extension === '.msi') return 'msi';
  if (extension === '.zip') return name.includes('portable') ? 'portable' : 'zip';
  if (extension === '.exe' && name.includes('setup')) return 'nsis';
  return extension.replace('.', '') || 'exe';
}

function architecture(filePath) {
  const name = path.basename(filePath).toLowerCase();
  if (name.includes('arm64')) return 'arm64';
  if (name.includes('ia32') || name.includes('x86')) return 'ia32';
  return 'x64';
}

function humanSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function main() {
  const candidates = walk(dist)
    .filter(isInstaller)
    .map(filePath => ({ filePath, stat: fs.statSync(filePath) }))
    .sort((a, b) => b.stat.size - a.stat.size);

  if (!candidates.length) fail('No installer asset was found in dist/.');

  const selected = candidates[0];
  const installerPath = selected.filePath;
  const installerName = path.basename(installerPath);
  const digest = sha256(installerPath);
  const checksumPath = path.join(dist, `${installerName}.sha256`);
  fs.writeFileSync(checksumPath, `${digest}  ${installerName}\n`, 'utf8');

  const metadata = {
    installer_path: installerPath,
    installer_name: installerName,
    installer_type: installerType(installerPath),
    architecture: architecture(installerPath),
    size: selected.stat.size,
    size_human: humanSize(selected.stat.size),
    sha256: digest,
    checksum_path: checksumPath
  };

  for (const [key, value] of Object.entries(metadata)) writeOutput(key, value);
  console.log(JSON.stringify(metadata, null, 2));
}

main();
