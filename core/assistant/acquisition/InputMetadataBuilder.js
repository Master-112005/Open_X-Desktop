'use strict';

const { sanitizeAcquisitionData } = require('./AcquisitionSanitizer');

class InputMetadataBuilder {
  build({ source = 'chat', payload = {}, metadata = {} } = {}) {
    const now = Date.now();
    const resolvedLocale = globalThis.Intl.DateTimeFormat().resolvedOptions();
    const timezone = resolvedLocale.timeZone || '';
    const safeMetadata = sanitizeAcquisitionData(metadata || {});
    return {
      inputSource: String(source || 'chat'),
      receivedTimestamp: Number(safeMetadata.receivedTimestamp || payload.timestamp) || now,
      processingTimestamp: now,
      locale: String(safeMetadata.locale || payload.locale || resolvedLocale.locale || 'en-US'),
      timezone,
      os: process.platform,
      applicationVersion: String(safeMetadata.applicationVersion || payload.applicationVersion || ''),
      protocolVersion: safeMetadata.protocolVersion || payload.protocolVersion || null,
      sourceReliability: safeMetadata.sourceReliability || null,
      ...(safeMetadata || {})
    };
  }
}

module.exports = InputMetadataBuilder;
