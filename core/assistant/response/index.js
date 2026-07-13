'use strict';

const { ResponseManager, createDefaultResponseManager } = require('./ResponseManager');
const RESPONSE_VERSION = '11.1.0';

module.exports = {
  RESPONSE_VERSION,
  ResponsePipeline: require('./ResponsePipeline'),
  ResponseManager,
  createDefaultResponseManager,
  ResponseContext: require('./ResponseContext'),
  ResponseRegistry: require('./ResponseRegistry'),
  BaseResponseGenerator: require('./BaseResponseGenerator'),
  ConfirmationResponse: require('./ConfirmationResponse'),
  SummaryResponse: require('./SummaryResponse'),
  ErrorResponse: require('./ErrorResponse'),
  ClarificationResponse: require('./ClarificationResponse'),
  SuggestionResponse: require('./SuggestionResponse'),
  VoiceFormatter: require('./VoiceFormatter'),
  ChatFormatter: require('./ChatFormatter'),
  NotificationFormatter: require('./NotificationFormatter'),
  NaturalLanguageFormatter: require('./NaturalLanguageFormatter'),
  Personality: require('./Personality'),
  ResponseGenerator: require('./ResponseGenerator'),
  AssistantResponse: require('./AssistantResponse'),
  ResponseConfiguration: require('./ResponseConfiguration'),
  ResponseDiagnostics: require('./ResponseDiagnostics'),
  ResponseLogger: require('./ResponseLogger'),
  ...require('./ResponseErrors')
};
