const { Logger } = require('../../core/assistant/Data');
const { CommunicationEngine } = require('../../core/communication');

class WhatsAppDesktopController {
  constructor(config = {}) {
    this.logger = new Logger(config?.logging || { level: 'info' });
    this.communicationEngine = config.communicationEngine || new CommunicationEngine({
      config,
      eventBus: config.eventBus || null,
      logger: this.logger
    });
  }

  sendMessage(contactName, messageText) {
    return this.communicationEngine.prepareMessage({
      provider: 'whatsapp',
      recipient: contactName,
      message: messageText
    });
  }

  startVoiceCall() {
    return {
      success: false,
      error: 'Direct WhatsApp calling is not supported by the communication engine'
    };
  }

  async destroy() {
    await this.communicationEngine.stop();
  }
}

module.exports = WhatsAppDesktopController;
