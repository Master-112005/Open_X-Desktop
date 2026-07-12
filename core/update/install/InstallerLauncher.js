const childProcess = require('child_process');
const path = require('path');

class InstallerLauncher {
  constructor(options = {}) {
    this.spawn = options.spawn || childProcess.spawn;
    this.monitorExit = options.monitorExit === true;
  }

  launch(input = {}) {
    const installerPath = String(input.installerPath || '').trim();
    const extension = path.extname(installerPath).toLowerCase();
    const args = Array.isArray(input.args) ? input.args : [];
    const command = extension === '.msi' ? 'msiexec.exe' : installerPath;
    const finalArgs = extension === '.msi' ? ['/i', installerPath, ...args] : args;
    const child = this.spawn(command, finalArgs, {
      cwd: input.workingDirectory || path.dirname(installerPath),
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    });
    if (this.monitorExit && typeof child.once === 'function' && typeof input.onExit === 'function') {
      child.once('exit', (code, signal) => input.onExit({ code, signal }));
      child.once('error', error => input.onExit({ code: null, signal: null, error: error.message }));
    }
    if (typeof child.unref === 'function') child.unref();
    return {
      pid: child.pid || null,
      command,
      args: finalArgs,
      process: child
    };
  }
}

module.exports = InstallerLauncher;
