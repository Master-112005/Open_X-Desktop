'use strict';

const BaseCandidateFilter = require('./BaseCandidateFilter');
const { FILTER_IDS } = require('./CandidateContracts');
const { getConstraintValues, normalize } = require('./filter-utils');

class MetadataFilter extends BaseCandidateFilter {
  constructor(options = {}) {
    super({ ...options, id: FILTER_IDS.METADATA });
  }

  apply(pool, visualQuery) {
    const media = getConstraintValues(visualQuery, ['media', 'photoTypes', 'documentTypes']).map(normalize);
    return pool.applyFilter(this.id, candidate => {
      const fileType = normalize(candidate.photo?.fileType || candidate.metadata?.fileType || '');
      const photoType = normalize(candidate.metadata?.photoType || candidate.metadata?.mediaType || '');
      const path = normalize(candidate.path);
      const wantsScreenshot = media.includes('screenshot');
      const wantsDocument = media.some(value => ['document', 'receipt', 'invoice', 'id card', 'passport', 'license', 'bill'].includes(value));
      if (wantsScreenshot) {
        const matched = photoType.includes('screenshot') || path.includes('screenshot') || path.includes('screen shot');
        return { passed: matched, confidence: matched ? 0.8 : 0.15, reason: matched ? 'screenshot metadata matched' : 'not a screenshot metadata match' };
      }
      if (wantsDocument) {
        const matched = ['pdf'].includes(fileType) || media.some(value => path.includes(normalize(value)) || photoType.includes(normalize(value)));
        return { passed: matched || ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'].includes(fileType), confidence: matched ? 0.75 : 0.45, reason: matched ? 'document metadata matched' : 'document type unavailable' };
      }
      const supported = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'].includes(fileType) || !fileType;
      return { passed: supported, confidence: supported ? 0.62 : 0.1, reason: supported ? 'supported media metadata' : 'unsupported media type' };
    });
  }
}

module.exports = MetadataFilter;
