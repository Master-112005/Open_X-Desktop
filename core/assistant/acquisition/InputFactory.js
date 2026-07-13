'use strict';

const RawUserInput = require('../models/RawUserInput');
const IdGenerator = require('../utils/IdGenerator');
const AttachmentResolver = require('./AttachmentResolver');
const InputMetadataBuilder = require('./InputMetadataBuilder');
const LanguageDetector = require('./LanguageDetector');
const SourceConfidenceCalculator = require('./SourceConfidenceCalculator');

class InputFactory {
  constructor(options = {}) {
    this.idGenerator = options.idGenerator || new IdGenerator({ prefix: 'input' });
    this.languageDetector = options.languageDetector || new LanguageDetector();
    this.attachmentResolver = options.attachmentResolver || new AttachmentResolver(options);
    this.metadataBuilder = options.metadataBuilder || new InputMetadataBuilder();
    this.confidenceCalculator = options.confidenceCalculator || new SourceConfidenceCalculator();
    this.maxRawTextLength = Math.max(1, Number(options.maxRawTextLength) || 12000);
  }

  create({
    source = 'chat',
    sourceType = '',
    rawText = '',
    payload = {},
    metadata = {},
    attachments = [],
    device = null,
    platform = null,
    userContext = {},
    flags = {},
    confidence = null
  } = {}) {
    const safeRawText = String(rawText || '').slice(0, this.maxRawTextLength);
    const builtMetadata = this.metadataBuilder.build({ source, payload, metadata });
    const language = this.languageDetector.detect(safeRawText, builtMetadata);
    const resolvedAttachments = this.attachmentResolver.resolve(attachments || payload.attachments || [], source);
    const requestId = String(payload.requestId || builtMetadata.requestId || this.idGenerator.next('request'));
    return new RawUserInput({
      id: this.idGenerator.next('input'),
      requestId,
      conversationId: payload.conversationId || builtMetadata.conversationId || '',
      sessionId: payload.sessionId || builtMetadata.sessionId || '',
      timestamp: builtMetadata.receivedTimestamp || Date.now(),
      source,
      sourceType: sourceType || source,
      rawText: safeRawText,
      language,
      confidence: this.confidenceCalculator.calculate({ source, metadata: builtMetadata, explicitConfidence: confidence }),
      attachments: resolvedAttachments,
      metadata: builtMetadata,
      device,
      platform,
      userContext,
      flags,
      diagnostics: [{
        level: 'info',
        message: 'Input acquired.',
        data: {
          adapterSource: source,
          attachmentCount: resolvedAttachments.length,
          language: language.language,
          confidence: language.confidence
        },
        timestamp: Date.now()
      }],
      futureExtensions: {}
    });
  }
}

module.exports = InputFactory;
