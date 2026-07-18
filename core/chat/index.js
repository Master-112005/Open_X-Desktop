/**
 * Desktop Chat infrastructure exports.
 */
module.exports = Object.freeze({
  ChatConfiguration: require('./ChatConfiguration'),
  ChatConnectionManager: require('./ChatConnectionManager'),
  ChatEventBus: require('./ChatEventBus'),
  ChatEvents: require('./ChatEvents'),
  ChatHealthManager: require('./ChatHealthManager'),
  ChatLifecycleManager: require('./ChatLifecycleManager'),
  ChatLogger: require('./ChatLogger'),
  ChatManager: require('./ChatManager'),
  ChatService: require('./ChatService'),
  ChatStatusManager: require('./ChatStatusManager'),
  ChatVersionManager: require('./ChatVersionManager'),
  State: require('./state'),
  Devices: require('./devices'),
  Crypto: require('./crypto'),
  Discovery: require('./discovery'),
  Requests: require('./requests'),
  Mailbox: require('./mailbox'),
  Messages: require('./messages'),
  Synchronization: require('./synchronization'),
  History: require('./history'),
  MultiDevice: require('./multidevice'),
  Connection: require('./connection'),
  Transfer: require('./transfer'),
  Conversations: require('./conversations'),
  Security: require('./security'),
  Infrastructure: require('./infrastructure'),
  Quality: require('./quality')
});
