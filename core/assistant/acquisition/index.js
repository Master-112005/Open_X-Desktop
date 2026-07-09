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
  ...require('./AcquisitionErrors'),
  APIAdapter,
  AttachmentResolver: require('./AttachmentResolver'),
  BaseInputAdapter,
  ChatAdapter,
  ClipboardAdapter,
  CloudAdapter,
  createDefaultInputSourceManager,
  InputAdapterRegistry: require('./InputAdapterRegistry'),
  InputFactory,
  InputMetadataBuilder: require('./InputMetadataBuilder'),
  InputSourceManager,
  LanguageDetector: require('./LanguageDetector'),
  OCRAdapter,
  PhoneAdapter,
  PluginAdapter,
  SourceConfidenceCalculator: require('./SourceConfidenceCalculator'),
  VoiceAdapter
};
