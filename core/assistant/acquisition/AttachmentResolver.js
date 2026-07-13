'use strict';

const { AttachmentError } = require('./AcquisitionErrors');
const { compactText, sanitizeAcquisitionData } = require('./AcquisitionSanitizer');

class AttachmentResolver {
  constructor(options = {}) {
    this.maxAttachments = Math.max(0, Number(options.maxAttachments) || 20);
  }

  resolve(attachments = [], source = 'unknown') {
    if (!attachments) return [];
    if (!Array.isArray(attachments)) {
      throw new AttachmentError('Attachments must be an array.', { source });
    }
    return attachments.slice(0, this.maxAttachments).map((attachment, index) => {
      const value = attachment && typeof attachment === 'object' ? attachment : {};
      return Object.freeze({
        id: compactText(value.id || value.identifier || `${source}_attachment_${index + 1}`, 120),
        name: compactText(value.name || value.filename || '', 180),
        type: compactText(value.type || 'unknown', 80),
        size: Math.max(0, Number(value.size || value.sizeBytes || 0)),
        mimeType: compactText(value.mimeType || value.mime || '', 120),
        source: compactText(value.source || source, 80),
        metadata: sanitizeAcquisitionData(value.metadata || {})
      });
    });
  }
}

module.exports = AttachmentResolver;
