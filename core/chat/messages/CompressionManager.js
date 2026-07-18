const zlib = require('zlib');
const { COMPRESSION_ALGORITHM } = require('./MessageConstants');

/**
 * Desktop message compression manager.
 */
class CompressionManager {
  /**
   * Creates compression manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.config = options.config;
  }

  /**
   * Compresses serialized encrypted payloads.
   * @param {Buffer|string} value Payload.
   * @returns {object} Compression result.
   */
  compress(value) {
    const input = Buffer.isBuffer(value) ? value : Buffer.from(String(value || ''), 'utf8');
    if (input.byteLength < this.config.compressionThresholdBytes) {
      return {
        data: input.toString('base64url'),
        compression: { algorithm: COMPRESSION_ALGORITHM.NONE, compressed: false, originalSize: input.byteLength, compressedSize: input.byteLength, version: '1' }
      };
    }
    const compressed = zlib.gzipSync(input);
    return {
      data: compressed.toString('base64url'),
      compression: { algorithm: COMPRESSION_ALGORITHM.GZIP, compressed: true, originalSize: input.byteLength, compressedSize: compressed.byteLength, version: '1' }
    };
  }

  /**
   * Decompresses serialized encrypted payloads.
   * @param {string} data Stored data.
   * @param {object} compression Compression metadata.
   * @returns {Buffer} Serialized encrypted payload.
   */
  decompress(data, compression = {}) {
    const buffer = Buffer.from(String(data || ''), 'base64url');
    if ((compression.algorithm || COMPRESSION_ALGORITHM.NONE) === COMPRESSION_ALGORITHM.GZIP) return zlib.gunzipSync(buffer);
    return buffer;
  }
}

module.exports = CompressionManager;
