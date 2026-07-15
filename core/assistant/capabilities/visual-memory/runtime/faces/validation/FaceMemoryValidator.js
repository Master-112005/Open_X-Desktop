'use strict';

class FaceMemoryValidator {
  validateConsent(consent) {
    if (consent?.enabled !== true) return { valid: false, reason: 'Face Memory requires explicit user consent.' };
    return { valid: true };
  }

  validateEmbedding(vector) {
    if (!Array.isArray(vector) || vector.length === 0 || !vector.every(Number.isFinite)) {
      return { valid: false, reason: 'Face embedding must be a non-empty numeric array.' };
    }
    return { valid: true };
  }

  validateIdentityName(name) {
    const value = String(name || '').trim();
    if (!value) return { valid: false, reason: 'Identity name is required.' };
    if (value.length > 120) return { valid: false, reason: 'Identity name is too long.' };
    return { valid: true, name: value };
  }

  validateMerge(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return { valid: false, reason: 'Two different identities are required for merge.' };
    return { valid: true };
  }
}

module.exports = FaceMemoryValidator;
