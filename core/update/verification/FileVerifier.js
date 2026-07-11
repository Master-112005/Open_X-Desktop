const fs = require('fs');
const path = require('path');

class FileVerifier {
  constructor(options = {}) {
    this.configuration = options.configuration;
  }

  verify(context) {
    const startedAt = Date.now();
    try {
      const filePath = path.resolve(String(context.filePath || ''));
      if (!fs.existsSync(filePath)) throw this.error('FILE_MISSING', 'Downloaded package does not exist.');
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) throw this.error('NOT_A_FILE', 'Downloaded package path is not a file.');
      if (stats.size <= 0) throw this.error('EMPTY_FILE', 'Downloaded package is empty.');
      fs.accessSync(filePath, fs.constants.R_OK);
      const extension = path.extname(filePath).toLowerCase();
      if (!this.configuration.allowedExtensions.includes(extension)) {
        throw this.error('INVALID_EXTENSION', `Downloaded package extension ${extension || '<none>'} is not allowed.`);
      }
      context.filePath = filePath;
      context.file = { path: filePath, size: stats.size, extension, readable: true };
      return context.addCheck('file', true, context.file, null, Date.now() - startedAt);
    } catch (error) {
      return context.addCheck('file', false, {}, error, Date.now() - startedAt);
    }
  }

  error(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }
}

module.exports = FileVerifier;
