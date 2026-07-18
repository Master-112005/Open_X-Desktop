/**
 * Desktop Phase 8 message module exports.
 */
module.exports = Object.freeze({
  MessageConstants: require('./MessageConstants'),
  MessageEvents: require('./MessageEvents'),
  MessageConfiguration: require('./MessageConfiguration'),
  MessageLogger: require('./MessageLogger'),
  MessageClient: require('./MessageClient'),
  MessageModel: require('./MessageModel'),
  MessageValidation: require('./MessageValidation'),
  CompressionManager: require('./CompressionManager'),
  MessageStorage: require('./MessageStorage'),
  MessagePipeline: require('./MessagePipeline'),
  MessageRouter: require('./MessageRouter'),
  AcknowledgementManager: require('./AcknowledgementManager'),
  RetryManager: require('./RetryManager'),
  TypingManager: require('./TypingManager'),
  MessageManager: require('./MessageManager')
});
