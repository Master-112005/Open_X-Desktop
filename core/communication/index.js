module.exports = {
  CommunicationEngine: require('./CommunicationEngine'),
  CommunicationProvider: require('./CommunicationProvider'),
  CommunicationProviderManager: require('./CommunicationProviderManager'),
  CommunicationEvents: require('./CommunicationEvents'),
  WhatsAppProvider: require('./WhatsAppProvider'),
  WhatsAppSessionManager: require('./WhatsAppSessionManager'),
  WhatsAppSelectors: require('./WhatsAppSelectors'),
  ...require('./CommunicationErrors')
};
