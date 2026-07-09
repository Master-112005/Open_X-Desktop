'use strict';

class InputMetadataBuilder {
  build({ source = 'chat', payload = {}, metadata = {} } = {}) {
    const now = Date.now();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    return {
      inputSource: String(source || 'chat'),
      receivedTimestamp: Number(metadata.receivedTimestamp || payload.timestamp) || now,
      processingTimestamp: now,
      locale: String(metadata.locale || payload.locale || Intl.DateTimeFormat().resolvedOptions().locale || 'en-US'),
      timezone,
      os: process.platform,
      applicationVersion: String(metadata.applicationVersion || payload.applicationVersion || ''),
      protocolVersion: metadata.protocolVersion || payload.protocolVersion || null,
      ...(metadata || {})
    };
  }
}

module.exports = InputMetadataBuilder;
