'use strict';

class VisionValidator {
  constructor({ configuration } = {}) {
    this.configuration = configuration;
  }

  validateInferenceRequest(request = {}) {
    const errors = [];
    const warnings = [];
    const hasImage = Boolean(request.imagePath || request.imageBuffer || request.image);
    if (!hasImage) errors.push({ code: 'vision.input_missing', message: 'Image input is required.' });
    if (request.imageBuffer && Buffer.isBuffer(request.imageBuffer)) {
      const maxBytes = this.configuration?.resources?.maxImageBytes || 25 * 1024 * 1024;
      if (request.imageBuffer.length > maxBytes) errors.push({ code: 'vision.image_too_large', message: 'Image input exceeds configured limit.' });
    }
    if (request.tasks && !Array.isArray(request.tasks)) {
      errors.push({ code: 'vision.tasks_invalid', message: 'Tasks must be an array.' });
    }
    return { valid: errors.length === 0, errors, warnings };
  }

  validateConfidence(value) {
    return Number.isFinite(value) && value >= 0 && value <= 1;
  }

  validateEmbedding(vector) {
    return Array.isArray(vector) && vector.length > 0 && vector.every(Number.isFinite);
  }
}

module.exports = VisionValidator;
