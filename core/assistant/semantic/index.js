'use strict';

const SemanticCore = require('./SemanticCore');

module.exports = {
  ...SemanticCore,
  NaturalLanguageRouter: require('./NaturalLanguageRouter'),
  WebTargets: require('./WebTargets')
};