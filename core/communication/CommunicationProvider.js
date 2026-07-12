const EventEmitter = require('events');

class CommunicationProvider extends EventEmitter {
  constructor(options = {}) {
    super();
    this.id = options.id || 'provider';
    this.logger = options.logger || console;
    this.debug = options.debug === true;
  }

  async connect() { throw new Error(`${this.id}.connect() is not implemented`); }
  async disconnect() { throw new Error(`${this.id}.disconnect() is not implemented`); }
  async isConnected() { throw new Error(`${this.id}.isConnected() is not implemented`); }
  async searchContacts() { throw new Error(`${this.id}.searchContacts() is not implemented`); }
  async openConversation() { throw new Error(`${this.id}.openConversation() is not implemented`); }
  async composeMessage() { throw new Error(`${this.id}.composeMessage() is not implemented`); }
  async send() { throw new Error(`${this.id}.send() is not implemented`); }
  async cancel() { throw new Error(`${this.id}.cancel() is not implemented`); }
  async health() { return { provider: this.id, connected: false, state: 'unknown' }; }
}

module.exports = CommunicationProvider;
