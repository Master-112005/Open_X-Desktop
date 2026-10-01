'use strict';

const REASONING_VERSION = '8.0.0';
const ReasoningCore = require('./ReasoningCore');

module.exports = {
  REASONING_VERSION,
  ...ReasoningCore,
  IntentPatternScorer: require('./IntentPatternScorer'),
  IntentRegistry: require('./IntentRegistry'),
  ReasoningDiagnostics: require('./ReasoningDiagnostics')
};