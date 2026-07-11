const path = require('path');

class MetadataVerifier {
  verify(context) {
    const startedAt = Date.now();
    try {
      const fileName = path.basename(context.filePath);
      const versionMatch = fileName.match(/(\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?)/);
      const metadata = {
        productName: context.manifest.productName || 'OpenX',
        company: context.manifest.company || context.manifest.publisher || '',
        internalName: context.manifest.internalName || '',
        originalFilename: fileName,
        productVersion: context.manifest.productVersion || context.manifest.version || versionMatch?.[1] || '',
        fileVersion: context.manifest.fileVersion || context.manifest.version || versionMatch?.[1] || '',
        description: context.manifest.description || '',
        architecture: String(context.manifest.architecture || context.manifest.arch || 'any').toLowerCase(),
        platform: String(context.manifest.platform || process.platform).toLowerCase()
      };
      if (context.manifest.expectedFileName && path.basename(context.manifest.expectedFileName) !== fileName) {
        throw this.error('FILENAME_MISMATCH', 'Downloaded package filename does not match manifest.');
      }
      context.metadata = metadata;
      return context.addCheck('metadata', true, metadata, null, Date.now() - startedAt);
    } catch (error) {
      return context.addCheck('metadata', false, {}, error, Date.now() - startedAt);
    }
  }

  error(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }
}

module.exports = MetadataVerifier;
