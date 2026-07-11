const path = require('path');
const UpdateLauncher = require('./UpdateLauncher');

class SilentInstaller {
  constructor(options = {}) {
    this.launcher = options.launcher || new UpdateLauncher({ spawn: options.spawn });
    this.configuration = options.configuration || {};
  }

  commandFor(installerPath) {
    const extension = path.extname(installerPath).toLowerCase();
    if (extension === '.msi') return 'msiexec.exe';
    return installerPath;
  }

  argsFor(installerPath, overrideArgs) {
    const extension = path.extname(installerPath).toLowerCase();
    if (Array.isArray(overrideArgs) && overrideArgs.length > 0) return overrideArgs.slice();
    const configured = this.configuration.silentArgs || {};
    if (extension === '.msi') return ['/i', installerPath, ...(configured.msi || ['/qn', '/norestart'])];
    return (configured.exe || ['/S']).slice();
  }

  launch(input = {}) {
    const installerPath = String(input.installerPath || '').trim();
    const command = this.commandFor(installerPath);
    const args = this.argsFor(installerPath, input.args);
    const child = this.launcher.launch(command, args, {
      cwd: input.workingDirectory || path.dirname(installerPath),
      detached: false,
      stdio: 'ignore',
      windowsHide: true
    });
    return {
      pid: child.pid || null,
      command,
      args,
      process: child,
      visibility: Object.freeze({
        mode: 'silent',
        windowsHide: true,
        focused: false,
        minimized: false,
        hidden: true
      })
    };
  }
}

module.exports = SilentInstaller;
