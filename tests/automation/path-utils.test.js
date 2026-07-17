const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  getDefaultSearchRoots,
  getSpecialFolderPaths,
  getSpecialFolders,
  getWorkingDirectorySearchRoot,
  isSafeUserPath,
  pathSafety,
  requireSafeUserPath,
  resolveDirectory,
  sanitizeWindowsName,
  validateWindowsName,
  validateWindowsPathLength
} = require('../../core/automation/common/path-utils');

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

describe('Automation Path Utilities', function() {
  const originalUserProfile = process.env.USERPROFILE;
  const originalOneDrive = process.env.OneDrive;
  const originalOneDriveCommercial = process.env.OneDriveCommercial;
  const originalOneDriveConsumer = process.env.OneDriveConsumer;
  const originalIncludeCwdSearch = process.env.OPENX_INCLUDE_CWD_SEARCH;
  let tempProfile;

  beforeEach(function() {
    tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-path-utils-'));
    process.env.USERPROFILE = tempProfile;
    ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos'].forEach(folder => {
      fs.mkdirSync(path.join(tempProfile, folder), { recursive: true });
    });
  });

  afterEach(function() {
    restoreEnv('USERPROFILE', originalUserProfile);
    restoreEnv('OneDrive', originalOneDrive);
    restoreEnv('OneDriveCommercial', originalOneDriveCommercial);
    restoreEnv('OneDriveConsumer', originalOneDriveConsumer);
    restoreEnv('OPENX_INCLUDE_CWD_SEARCH', originalIncludeCwdSearch);
    fs.rmSync(tempProfile, { recursive: true, force: true });
  });

  it('should validate Windows file and folder component names consistently', function() {
    assert.deepEqual(validateWindowsName('report.txt', { label: 'filename' }), {
      valid: true,
      name: 'report.txt'
    });
    assert.match(validateWindowsName('CON.txt', { label: 'filename' }).error, /reserved Windows device name/i);
    assert.match(validateWindowsName('bad?name.txt', { label: 'filename' }).error, /cannot contain/i);
    assert.match(validateWindowsName('folder.', { label: 'folder name' }).error, /cannot end with a space or dot/i);
    assert.match(validateWindowsName('x'.repeat(256), { label: 'filename' }).error, /255/);
  });

  it('should sanitize names only for search/display while validation rejects unsafe originals', function() {
    assert.equal(sanitizeWindowsName('  "bad?name.txt"  '), 'badname.txt');
    assert.equal(validateWindowsName('bad?name.txt').valid, false);
  });

  it('should enforce safe user roots and protected directory segments', function() {
    const desktopFile = path.join(tempProfile, 'Desktop', 'safe.txt');
    const protectedFile = path.join(tempProfile, 'AppData', 'Local', 'secret.txt');
    const outsideFile = path.join(os.tmpdir(), 'openx-outside-path-utils.txt');

    assert.equal(isSafeUserPath(desktopFile), true);
    assert.equal(pathSafety(protectedFile).safe, false);
    assert.match(pathSafety(protectedFile).reason, /protected system paths/i);
    assert.equal(pathSafety(outsideFile).safe, false);
    assert.match(pathSafety(outsideFile).reason, /outside allowed user folders/i);
  });

  it('should resolve fuzzy special directories without leaving safe roots', function() {
    const specialFolders = getSpecialFolders();
    const resolved = resolveDirectory('documnts', { mustExist: true });

    assert.equal(resolved, specialFolders.documents);
    assert.equal(requireSafeUserPath(resolved, { allowRoot: true }), specialFolders.documents);
  });

  it('should ignore stale OneDrive folders when a temporary profile is active', function() {
    const oneDriveRoot = path.join(tempProfile, 'OneDrive');
    const oneDriveDocuments = path.join(oneDriveRoot, 'Documents');
    fs.mkdirSync(oneDriveDocuments, { recursive: true });
    process.env.OneDrive = oneDriveRoot;
    process.env.OneDriveCommercial = '';
    process.env.OneDriveConsumer = '';

    const documentPaths = getSpecialFolderPaths('documents');
    const searchRoots = getDefaultSearchRoots();

    assert.ok(documentPaths.includes(path.join(tempProfile, 'Documents')));
    assert.equal(documentPaths.includes(oneDriveDocuments), false);
    assert.equal(searchRoots.includes(oneDriveDocuments), false);
    assert.equal(isSafeUserPath(path.join(oneDriveDocuments, 'safe.txt')), true);
  });

  it('should keep the current working directory out of production file search by default', function() {
    const originalCwd = process.cwd();
    const projectDir = path.join(tempProfile, 'Documents', 'Project');
    fs.mkdirSync(projectDir, { recursive: true });

    try {
      process.chdir(projectDir);
      delete process.env.OPENX_INCLUDE_CWD_SEARCH;

      assert.equal(getWorkingDirectorySearchRoot(), null);
      assert.equal(getDefaultSearchRoots().includes(projectDir), false);

      process.env.OPENX_INCLUDE_CWD_SEARCH = '1';
      assert.equal(getWorkingDirectorySearchRoot(), projectDir);
      assert.equal(getDefaultSearchRoots().includes(projectDir), true);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should search user content libraries without recursively scanning the whole profile root', function() {
    const roots = getDefaultSearchRoots();

    assert.equal(roots.includes(tempProfile), false);
    assert.ok(roots.includes(path.join(tempProfile, 'Desktop')));
    assert.ok(roots.includes(path.join(tempProfile, 'Documents')));
    assert.ok(roots.includes(path.join(tempProfile, 'Downloads')));
    assert.ok(roots.includes(path.join(tempProfile, 'Pictures')));
  });

  it('should validate Windows path lengths with configurable limits', function() {
    const target = path.join(tempProfile, 'Desktop', `${'x'.repeat(40)}.txt`);

    assert.equal(validateWindowsPathLength(target, { maxPathLength: 20 }).valid, false);
    assert.equal(validateWindowsPathLength(target, { maxPathLength: 20, allowLongPaths: true }).valid, true);
  });

  it('should block existing symlink or junction paths that resolve outside user roots', function() {
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-path-utils-outside-'));
    const linkPath = path.join(tempProfile, 'Documents', 'OutsideLink');

    try {
      try {
        fs.symlinkSync(outsideDir, linkPath, 'junction');
      } catch (error) {
        if (['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) {
          this.skip();
        }
        throw error;
      }

      const safety = pathSafety(path.join(linkPath, 'secret.txt'));
      assert.equal(safety.safe, false);
      assert.match(safety.reason, /resolves outside allowed user folders/i);
    } finally {
      fs.rmSync(linkPath, { recursive: true, force: true });
      fs.rmSync(outsideDir, { recursive: true, force: true });
    }
  });
});
