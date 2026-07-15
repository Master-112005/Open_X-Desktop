'use strict';

class VisualMemoryLearningValidator {
  validateFeedback(input = {}) {
    if (!input || typeof input !== 'object') return { valid: false, reason: 'Feedback must be an object.' };
    if (!input.type) return { valid: false, reason: 'Feedback type is required.' };
    return { valid: true };
  }

  validateCorrection(input = {}) {
    if (!input || typeof input !== 'object') return { valid: false, reason: 'Correction must be an object.' };
    if (!input.type) return { valid: false, reason: 'Correction type is required.' };
    if (!input.memoryId && !input.photoId && !input.identityId) return { valid: false, reason: 'Correction target is required.' };
    return { valid: true };
  }

  validatePreference(input = {}) {
    if (!input || typeof input !== 'object') return { valid: false, reason: 'Preference must be an object.' };
    if (!input.key) return { valid: false, reason: 'Preference key is required.' };
    return { valid: true };
  }
}

module.exports = VisualMemoryLearningValidator;
