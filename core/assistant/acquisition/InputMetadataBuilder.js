'use strict';

class InputMetadataBuilder {
  build({ source = 'chat', payload = {}, metadata = {} } = {}) {
    const now = Date.now();
    const resolvedLocale = globalThis.Intl.DateTimeFormat().resolvedOptions();
    const timezone = resolvedLocale.timeZone || '';
    return {
      inputSource: String(source || 'chat'),
      receivedTimestamp: Number(metadata.receivedTimestamp || payload.timestamp) || now,
      processingTimestamp: now,
      locale: String(metadata.locale || payload.locale || resolvedLocale.locale || 'en-US'),
      timezone,
      os: process.platform,
      applicationVersion: String(metadata.applicationVersion || payload.applicationVersion || ''),
      protocolVersion: metadata.protocolVersion || payload.protocolVersion || null,
      ...(metadata || {})
    };
  }
}

module.exports = InputMetadataBuilder;
