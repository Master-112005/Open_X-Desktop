'use strict';

const { VerificationManager, createDefaultVerificationManager } = require('./VerificationManager');

module.exports = {
  ...require('./VerificationResponseManager'),
  VerificationResponseStage: require('./VerificationResponseStage'),
  VerificationPipeline: require('./VerificationPipeline'),
  VerificationManager,
  createDefaultVerificationManager,
  VerificationContext: require('./VerificationContext'),
  VerificationRegistry: require('./VerificationRegistry'),
  BaseVerifier: require('./BaseVerifier'),
  ExecutionVerifier: require('./ExecutionVerifier'),
  ApplicationVerifier: require('./ApplicationVerifier'),
  BrowserVerifier: require('./BrowserVerifier'),
  WindowVerifier: require('./WindowVerifier'),
  ReminderVerifier: require('./ReminderVerifier'),
  TransferVerifier: require('./TransferVerifier'),
  CloudVerifier: require('./CloudVerifier'),
  VerificationGraphBuilder: require('./VerificationGraphBuilder'),
  VerificationResult: require('./VerificationResult'),
  VerificationConfiguration: require('./VerificationConfiguration'),
  VerificationDiagnostics: require('./VerificationDiagnostics'),
  VerificationLogger: require('./VerificationLogger'),
  ...require('./VerificationErrors')
};
