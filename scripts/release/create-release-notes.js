const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const dist = path.join(root, 'dist');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function git(args, fallback = '') {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch (_) {
    return fallback;
  }
}

function writeOutput(name, value) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) return;
  fs.appendFileSync(output, `${name}=${String(value).replace(/\r?\n/g, ' ')}\n`);
}

function main() {
  fs.mkdirSync(dist, { recursive: true });
  const tagName = process.env.TAG_NAME || `v${packageJson.version}`;
  const previousTag = git(['describe', '--tags', '--abbrev=0', '--match', 'v*', 'HEAD^'], '');
  const range = previousTag ? `${previousTag}..HEAD` : 'HEAD';
  const commits = git(['log', range, '--pretty=format:- %h %s'], '- Initial automated release.');
  const shortSha = git(['rev-parse', '--short', 'HEAD'], process.env.GITHUB_SHA?.slice(0, 7) || 'unknown');
  const releaseDate = new Date().toISOString();
  const notes = [
    `# OpenX ${tagName}`,
    '',
    `Release date: ${releaseDate}`,
    `Build: ${process.env.GITHUB_RUN_NUMBER || 'local'}`,
    `Commit: ${shortSha}`,
    previousTag ? `Previous release: ${previousTag}` : 'Previous release: none detected',
    '',
    '## Changes',
    '',
    commits || '- No commit summary available.',
    '',
    '## Build Metadata',
    '',
    `- Repository: ${process.env.GITHUB_REPOSITORY || 'local'}`,
    `- Workflow: ${process.env.GITHUB_WORKFLOW || 'local'}`,
    `- Run ID: ${process.env.GITHUB_RUN_ID || 'local'}`
  ].join('\n');
  const outputPath = path.join(dist, 'release-notes.md');
  fs.writeFileSync(outputPath, notes, 'utf8');
  writeOutput('release_notes_path', outputPath);
  console.log(`Release notes generated: ${outputPath}`);
}

main();
