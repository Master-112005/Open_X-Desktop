const fs = require('fs');

class ReadableVerifier {
  verify(context) {
    const startedAt = Date.now();
    try {
      fs.accessSync(context.filePath, fs.constants.R_OK);
      return context.addCheck('readable', true, { readable: true }, null, Date.now() - startedAt);
    } catch (error) {
      error.code = error.code || 'FILE_NOT_READABLE';
      return context.addCheck('readable', false, {}, error, Date.now() - startedAt);
    }
  }
}

module.exports = ReadableVerifier;
