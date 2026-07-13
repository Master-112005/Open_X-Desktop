'use strict';

const APIAdapter = require('./APIAdapter');
const BaseInputAdapter = require('./BaseInputAdapter');
const ChatAdapter = require('./ChatAdapter');
const ClipboardAdapter = require('./ClipboardAdapter');
const CloudAdapter = require('./CloudAdapter');
const InputFactory = require('./InputFactory');
const InputSourceManager = require('./InputSourceManager');
const OCRAdapter = require('./OCRAdapter');
const PhoneAdapter = require('./PhoneAdapter');
const PluginAdapter = require('./PluginAdapter');
const VoiceAdapter = require('./VoiceAdapter');

const ACQUISITION_VERSION = '1.1.0';

function createDefaultInputSourceManager(options = {}) {
  const manager = new InputSourceManager(options);
  [
    new ChatAdapter(options),
    new VoiceAdapter(options),
    new PhoneAdapter(options),
    new CloudAdapter(options),
    new PluginAdapter(options),
    new APIAdapter(options),
    new OCRAdapter(options),
    new ClipboardAdapter(options)
  ].forEach(adapter => manager.register(adapter));
  return manager;
}

module.exports = {
  ACQUISITION_VERSION,
  ...require('./AcquisitionErrors'),
  AcquisitionSanitizer: require('./AcquisitionSanitizer'),
  APIAdapter,
  AttachmentResolver: require('./AttachmentResolver'),
  BaseInputAdapter,
  ChatAdapter,
  ClipboardAdapter,
  CloudAdapter,
  createDefaultInputSourceManager,
  InputAdapterRegistry: require('./InputAdapterRegistry'),
  InputDiagnostics: require('./InputDiagnostics'),
  InputFactory,
  InputMetadataBuilder: require('./InputMetadataBuilder'),
  InputSourceManager,
  LanguageDetector: require('./LanguageDetector'),
  OCRAdapter,
  PhoneAdapter,
  PluginAdapter,
  SourceConfidenceCalculator: require('./SourceConfidenceCalculator'),
  SourceNormalizer: require('./SourceNormalizer'),
  VoiceAdapter
};
