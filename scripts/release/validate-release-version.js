const fs = require('fs');
const https = require('https');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = String(packageJson.version || '').trim().replace(/^v/, '');
const tagName = `v${version}`;
const releaseName = `OpenX ${tagName}`;
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function writeOutput(name, value) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) return;
  fs.appendFileSync(output, `${name}=${String(value).replace(/\r?\n/g, ' ')}\n`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function requestGitHub(pathname) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const apiUrl = process.env.GITHUB_API_URL || 'https://api.github.com';
  const parsed = new URL(pathname, apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`);
  return new Promise((resolve, reject) => {
    const request = https.get(parsed, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: token ? `Bearer ${token}` : undefined,
        'User-Agent': 'OpenX-Release-Pipeline',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }, response => {
      let body = '';
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => {
        resolve({ statusCode: response.statusCode, body });
      });
    });
    request.on('error', reject);
  });
}

async function existsOnGitHub(pathname) {
  const response = await requestGitHub(pathname);
  if (response.statusCode === 404) return false;
  if (response.statusCode >= 200 && response.statusCode < 300) return true;
  fail(`GitHub API check failed for ${pathname}: HTTP ${response.statusCode} ${response.body.slice(0, 300)}`);
}

async function main() {
  if (!semverPattern.test(version)) fail(`package.json version is not valid semantic version: ${packageJson.version}`);

  const refType = process.env.GITHUB_REF_TYPE || '';
  const refName = process.env.GITHUB_REF_NAME || '';
  if (refType === 'tag' && refName !== tagName) {
    fail(`Release tag ${refName} does not match package.json version ${tagName}.`);
  }

  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (repository && token) {
    const releaseExists = await existsOnGitHub(`/repos/${repository}/releases/tags/${encodeURIComponent(tagName)}`);
    if (releaseExists) fail(`Release ${tagName} already exists. Bump package.json version before publishing.`);

    const tagExists = await existsOnGitHub(`/repos/${repository}/git/ref/tags/${encodeURIComponent(tagName)}`);
    if (refType !== 'tag' && tagExists) fail(`Tag ${tagName} already exists. Bump package.json version before publishing.`);
  } else {
    console.warn('GITHUB_REPOSITORY or GITHUB_TOKEN is not available; duplicate release checks were skipped.');
  }

  writeOutput('version', version);
  writeOutput('tag_name', tagName);
  writeOutput('release_name', releaseName);
  console.log(`Release version validation passed: ${tagName}`);
}

main().catch(error => fail(error.message));
