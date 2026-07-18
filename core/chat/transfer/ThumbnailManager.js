/**
 * Creates local thumbnail preview payloads for encrypted image transfer.
 */
class ThumbnailManager {
  /**
   * Creates thumbnail manager.
   * @param {object} options Dependencies.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.integrity = options.integrity;
  }

  /**
   * Builds a small preview payload for image transfers.
   * @param {object} input Image input.
   * @returns {Buffer|null} Thumbnail plaintext payload.
   */
  generate(input = {}) {
    if (input.fileCategory !== 'Image') return null;
    const bytes = Buffer.from(input.bytes);
    const dimensions = this.dimensions(input.fileName, bytes);
    return Buffer.from(JSON.stringify({
      fileName: input.fileName,
      width: dimensions.width,
      height: dimensions.height,
      sourceHash: this.integrity.sha256(bytes),
      generatedAt: new Date().toISOString(),
      maxDimension: this.config.thumbnailMaxDimension
    }), 'utf8');
  }

  /**
   * Extracts basic dimensions when cheap header parsing is available.
   * @param {string} fileName File name.
   * @param {Buffer} bytes Bytes.
   * @returns {object} Dimensions.
   */
  dimensions(fileName, bytes) {
    const extension = String(fileName.split('.').pop() || '').toLowerCase();
    if (extension === 'png' && bytes.length >= 24 && bytes.slice(1, 4).toString('ascii') === 'PNG') {
      return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    }
    return { width: null, height: null };
  }
}

module.exports = ThumbnailManager;
