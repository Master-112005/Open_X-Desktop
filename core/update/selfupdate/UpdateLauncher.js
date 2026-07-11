const childProcess = require('child_process');

class UpdateLauncher {
  constructor(options = {}) {
    this.spawn = options.spawn || childProcess.spawn;
  }

  launch(command, args = [], options = {}) {
    const child = this.spawn(command, args, options);
    return child;
  }
}

module.exports = UpdateLauncher;
