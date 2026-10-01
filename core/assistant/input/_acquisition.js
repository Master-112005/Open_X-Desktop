'use strict';

const errors = require('./AcquisitionErrors');
const {
  AcquisitionSanitizer,
  SourceConfidenceCalculator,
  SourceNormalizer
} = require('./InputSourceUtilities');
const {
  AttachmentResolver,
  InputAdapterRegistry,
  InputFactory,
  InputMetadataBuilder,
  LanguageDetector
} = require('./InputBuilders');
const {
  ALL_INPUT_ADAPTERS,
  APIAdapter,
  BaseInputAdapter,
  ChatAdapter,
  ClipboardAdapter,
  CloudAdapter,
  OCRAdapter,
  PhoneAdapter,
  PluginAdapter,
  VoiceAdapter
} = require('./InputAdapters');
const { InputDiagnostics, InputSourceManager } = require('./InputSourceManager');

const ACQUISITION_VERSION = '1.1.0';

function createDefaultInputSourceManager(options = {}) {
  const manager = new InputSourceManager(options);
  ALL_INPUT_ADAPTERS.forEach(Adapter => manager.register(new Adapter(options)));
  return manager;
}

module.exports = {
  ACQUISITION_VERSION,
  ...errors,
  AcquisitionSanitizer,
  ALL_INPUT_ADAPTERS,
  APIAdapter,
  AttachmentResolver,
  BaseInputAdapter,
  ChatAdapter,
  ClipboardAdapter,
  CloudAdapter,
  createDefaultInputSourceManager,
  InputAdapterRegistry,
  InputDiagnostics,
  InputFactory,
  InputMetadataBuilder,
  InputSourceManager,
  LanguageDetector,
  OCRAdapter,
  PhoneAdapter,
  PluginAdapter,
  SourceConfidenceCalculator,
  SourceNormalizer,
  VoiceAdapter
};