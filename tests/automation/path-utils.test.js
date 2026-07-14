const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  getSpecialFolders,
  isSafeUserPath,
  pathSafety,
  requireSafeUserPath,
  resolveDirectory,
  sanitizeWindowsName,
  validateWindowsName,
  validateWindowsPathLength
} = require('../../core/automation/common/path-utils');

describe('Automation Path Utilities', function() {
  const originalUserProfile = process.env.USERPROFILE;
  let tempProfile;

  beforeEach(function() {
    tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-path-utils-'));
    process.env.USERPROFILE = tempProfile;
    ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos'].forEach(folder => {
      fs.mkdirSync(path.join(tempProfile, folder), { recursive: true });
    });
  });

  afterEach(function() {
    process.env.USERPROFILE = originalUserProfile;
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
