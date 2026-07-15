'use strict';

class ImagePreprocessingPipeline {
  constructor({ configuration, validator = null } = {}) {
    this.configuration = configuration;
    this.validator = validator;
  }

  async process(request = {}) {
    const validation = this.validator?.validateInferenceRequest?.(request) || { valid: true, errors: [] };
    if (!validation.valid) {
      const error = new Error(validation.errors.map(item => item.message).join('; '));
      error.code = validation.errors[0]?.code || 'vision.validation_failed';
      error.validation = validation;
      throw error;
    }
    return {
      imagePath: request.imagePath || '',
      imageBuffer: request.imageBuffer || null,
      image: request.image || null,
      tasks: Array.isArray(request.tasks) ? request.tasks.slice() : [],
      options: { ...(request.options || {}) },
      preprocessing: {
        targetSize: this.configuration?.preprocessing?.targetSize || 224,
        preserveAspectRatio: this.configuration?.preprocessing?.preserveAspectRatio !== false,
        normalize: this.configuration?.preprocessing?.normalize !== false,
        colorSpace: 'rgb',
        channelOrder: 'chw',
        note: 'Adapter receives original input plus normalized preprocessing instructions.'
      }
    };
  }
}

module.exports = ImagePreprocessingPipeline;
