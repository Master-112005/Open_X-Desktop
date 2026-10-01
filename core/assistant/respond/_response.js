'use strict';

const RESPONSE_VERSION = '11.3.0';

module.exports = {
  RESPONSE_VERSION,
  ...require('./ResponseCore'),
  Personality: require('./Personality'),
  ResponseGenerator: require('./ResponseGenerator')
};