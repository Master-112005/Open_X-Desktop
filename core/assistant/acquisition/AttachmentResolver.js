'use strict';

const { AttachmentError } = require('./AcquisitionErrors');

class AttachmentResolver {
  resolve(attachments = [], source = 'unknown') {
    if (!attachments) return [];
    if (!Array.isArray(attachments)) {
      throw new AttachmentError('Attachments must be an array.', { source });
    }
    return attachments.slice(0, 20).map((attachment, index) => {
      const value = attachment && typeof attachment === 'object' ? attachment : {};
      return Object.freeze({
        id: String(value.id || value.identifier || `${source}_attachment_${index + 1}`),
        type: String(value.type || 'unknown').slice(0, 80),
        size: Math.max(0, Number(value.size || value.sizeBytes || 0)),
        mimeType: String(value.mimeType || value.mime || '').slice(0, 120),
        source: String(value.source || source),
        metadata: { ...(value.metadata || {}) }
      });
    });
  }
}

module.exports = AttachmentResolver;
