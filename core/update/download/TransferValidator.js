const SAFE_CONTENT_TYPES = [
  'application/octet-stream',
  'application/x-msdownload',
  'application/vnd.microsoft.portable-executable',
  'application/zip',
  'application/x-zip-compressed',
  'binary/octet-stream'
];

class TransferValidator {
  constructor(options = {}) {
    this.configuration = options.configuration;
  }

  validateRequest(input = {}) {
    if (input.relayProvided !== true && input.source !== 'relay') {
      return this.fail('SOURCE_NOT_RELAY', 'Download URL must be supplied by Relay.');
    }
    let parsed;
    try {
      parsed = new URL(String(input.url || input.assetUrl || ''));
    } catch (_) {
      return this.fail('INVALID_URL', 'Download URL is invalid.');
    }
    if (!this.configuration.allowedProtocols.includes(parsed.protocol)) {
      return this.fail('UNSUPPORTED_PROTOCOL', 'Download URL protocol is not supported.');
    }
    return { success: true, url: parsed.toString() };
  }

  validateResponse(response, options = {}) {
    const statusCode = Number(response.statusCode || 0);
    if (statusCode >= 300 && statusCode < 400) return this.fail('REDIRECT_REJECTED', 'Unexpected redirects are rejected.');
    if (statusCode !== 200 && statusCode !== 206) return this.fail(`HTTP_${statusCode}`, `Download failed with HTTP ${statusCode}.`);
    const contentLength = Number(response.headers['content-length'] || 0);
    if (contentLength && contentLength + Number(options.resumeFrom || 0) > this.configuration.maxBytes) {
      return this.fail('RESPONSE_TOO_LARGE', 'Download response exceeds maximum size.');
    }
    const contentType = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (contentType && !SAFE_CONTENT_TYPES.includes(contentType) && !contentType.startsWith('application/')) {
      return this.fail('UNKNOWN_CONTENT_TYPE', 'Download content type is not allowed.');
    }
    return { success: true, contentLength, contentType, acceptRanges: /bytes/i.test(String(response.headers['accept-ranges'] || '')) };
  }

  fail(code, message) {
    const error = new Error(message);
    error.code = code;
    return { success: false, error };
  }
}

module.exports = TransferValidator;
