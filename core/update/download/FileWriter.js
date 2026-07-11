const fs = require('fs');

class FileWriter {
  constructor(options = {}) {
    this.partPath = options.partPath;
    this.resumeFrom = Math.max(0, Number(options.resumeFrom || 0));
    this.stream = null;
    this.diskWriteTimeMs = 0;
  }

  open() {
    this.stream = fs.createWriteStream(this.partPath, { flags: this.resumeFrom > 0 ? 'a' : 'w' });
    return this.stream;
  }

  write(chunk) {
    const startedAt = Date.now();
    return new Promise((resolve, reject) => {
      const done = error => {
        this.diskWriteTimeMs += Date.now() - startedAt;
        error ? reject(error) : resolve();
      };
      if (!this.stream.write(chunk)) this.stream.once('drain', () => done());
      else done();
    });
  }

  close() {
    return new Promise(resolve => {
      if (!this.stream) return resolve();
      this.stream.end(() => resolve());
      this.stream = null;
    });
  }

  complete(destinationPath) {
    fs.renameSync(this.partPath, destinationPath);
  }
}

module.exports = FileWriter;
