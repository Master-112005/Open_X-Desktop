const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const dist = path.join(root, 'dist');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function fail(message) {
  console.error(message);
  process.exit(1);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) fail(`${name} is required to generate manifest.json.`);
  return value;
}

function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function releaseAssetUrl(tagName, installerName) {
  const server = (process.env.GITHUB_SERVER_URL || 'https://github.com').replace(/\/$/, '');
  const repository = requireEnv('GITHUB_REPOSITORY');
  return `${server}/${repository}/releases/download/${encodeURIComponent(tagName)}/${encodeURIComponent(installerName)}`;
}

function normalizeReleaseStatus(value) {
  const status = String(value || 'published').trim().toLowerCase();
  if (status === 'prerelease') return 'prerelease';
  return 'published';
}

function main() {
  const installerPath = requireEnv('INSTALLER_PATH');
  const installerName = requireEnv('INSTALLER_NAME');
  const tagName = process.env.TAG_NAME || `v${packageJson.version}`;
  const releaseNotesPath = process.env.RELEASE_NOTES_FILE || path.join(dist, 'release-notes.md');
  const notes = fs.existsSync(releaseNotesPath) ? fs.readFileSync(releaseNotesPath, 'utf8') : '';
  const stat = fs.statSync(installerPath);
  const digest = sha256(installerPath);
  const now = new Date().toISOString();

  const manifest = {
    releaseId: `${packageJson.name}-${tagName}`,
    version: packageJson.version,
    minimumVersion: process.env.RELEASE_MINIMUM_VERSION || packageJson.version,
    releaseDate: now,
    notes,
    downloadUrl: releaseAssetUrl(tagName, installerName),
    sha256: digest,
    size: stat.size,
    channel: String(process.env.RELEASE_CHANNEL || 'stable').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'stable',
    mandatory: process.env.RELEASE_MANDATORY === 'true',
    publishedBy: 'github-actions',
    createdAt: now,
    updatedAt: now,
    architecture: process.env.INSTALLER_ARCHITECTURE || 'x64',
    platform: 'win32',
    checksumAlgorithm: 'sha256',
    installerName,
    installerType: process.env.INSTALLER_TYPE || 'nsis',
    minimumOS: 'Windows 10',
    maximumOS: null,
    supportedArchitectures: [process.env.INSTALLER_ARCHITECTURE || 'x64'],
    releaseNotesUrl: `${(process.env.GITHUB_SERVER_URL || 'https://github.com').replace(/\/$/, '')}/${requireEnv('GITHUB_REPOSITORY')}/releases/tag/${encodeURIComponent(tagName)}`,
    signature: null,
    releaseStatus: normalizeReleaseStatus(process.env.RELEASE_STATUS),
    metadata: {
      releaseNotes: notes,
      buildNumber: process.env.GITHUB_RUN_NUMBER || null,
      runId: process.env.GITHUB_RUN_ID || null,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
      commit: process.env.GITHUB_SHA || null,
      workflow: process.env.GITHUB_WORKFLOW || null,
      repository: process.env.GITHUB_REPOSITORY || null,
      installerSizeHuman: process.env.INSTALLER_SIZE_HUMAN || null
    }
  };

  fs.mkdirSync(dist, { recursive: true });
  const outputPath = path.join(dist, 'manifest.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Manifest generated: ${outputPath}`);
  console.log(JSON.stringify({
    version: manifest.version,
    installerName: manifest.installerName,
    sha256: manifest.sha256,
    size: manifest.size,
    downloadUrl: manifest.downloadUrl
  }, null, 2));
}

main();
