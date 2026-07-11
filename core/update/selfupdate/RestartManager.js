const childProcess = require('child_process');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class RestartManager {
  constructor(options = {}) {
    this.spawn = options.spawn || childProcess.spawn;
    this.executablePath = options.executablePath || process.execPath;
    this.args = Array.isArray(options.args) ? options.args : process.argv.slice(1);
    this.cwd = options.cwd || process.cwd();
    this.env = options.env || process.env;
    this.waitMs = Math.max(0, Number(options.waitMs) || 0);
  }

  updateOptions(options = {}) {
    if (options.executablePath) this.executablePath = options.executablePath;
    if (Array.isArray(options.args)) this.args = options.args;
    if (options.cwd) this.cwd = options.cwd;
    if (options.env) this.env = options.env;
    if (options.waitMs !== undefined) this.waitMs = Math.max(0, Number(options.waitMs) || 0);
  }

  async restart(options = {}) {
    const executablePath = options.executablePath || this.executablePath;
    const args = Array.isArray(options.args) ? options.args : this.args;
    const cwd = options.cwd || this.cwd;
    const env = options.env || this.env;
    const waitMs = options.waitMs ?? this.waitMs;
    const startedAt = Date.now();
    const child = this.spawn(executablePath, args, {
      cwd,
      env,
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    });
    if (typeof child.unref === 'function') child.unref();
    if (waitMs > 0) await delay(waitMs);
    return {
      success: true,
      pid: child.pid || null,
      executablePath,
      args: args.slice(),
      cwd,
      durationMs: Date.now() - startedAt
    };
  }
}

module.exports = RestartManager;
