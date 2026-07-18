const os = require('os');
const path = require('path');

/**
 * Desktop encrypted mailbox client configuration.
 */
class MailboxConfiguration {
  /**
   * Creates mailbox configuration.
   * @param {object} options Configuration overrides.
   */
  constructor(options = {}) {
    this.apiBaseUrl = String(options.apiBaseUrl || process.env.OPENX_CHAT_API_URL || 'http://localhost:8090').replace(/\/+$/, '');
    this.requestTimeoutMs = Number(options.requestTimeoutMs || 15000);
    this.maxEnvelopeSizeBytes = Number(options.maxEnvelopeSizeBytes || 262144);
    this.sequenceStatePath = options.sequenceStatePath || process.env.OPENX_CHAT_MAILBOX_SEQUENCE_STATE_PATH || path.join(os.homedir(), 'Documents', 'OpenX_Data', 'chat-mailbox-sequences.json');
    this.validate();
    Object.freeze(this);
  }

  /**
   * Validates configuration.
   */
  validate() {
    if (!/^https?:\/\//i.test(this.apiBaseUrl)) throw new Error('Mailbox API base URL must be http:// or https://.');
    if (this.requestTimeoutMs < 1000) throw new Error('Mailbox request timeout is too small.');
    if (this.maxEnvelopeSizeBytes < 1) throw new Error('Mailbox envelope size limit is invalid.');
  }
}

module.exports = MailboxConfiguration;
