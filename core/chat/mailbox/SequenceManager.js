const MailboxEvents = require('./MailboxEvents');
const { readSecureJsonFile, writeSecureJsonAtomic } = require('../../assistant/Data');

/**
 * Persists local highest acknowledged mailbox sequence per device.
 */
class SequenceManager {
  /**
   * Creates sequence manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.eventBus = options.eventBus;
    this.sequences = new Map();
    this.loaded = false;
  }

  /**
   * Loads sequence state from disk.
   */
  async load() {
    if (this.loaded) return;
    const parsed = readSecureJsonFile(this.config.sequenceStatePath, () => ({ schemaVersion: 1, sequences: {} }), {
      createIfMissing: true,
      validate: value => value && typeof value === 'object'
    });
    for (const [deviceId, sequence] of Object.entries(parsed?.sequences || {})) this.sequences.set(deviceId, Number(sequence || 0));
    this.loaded = true;
  }

  /**
   * Gets last acknowledged sequence for a device.
   * @param {string} deviceId DeviceID.
   * @returns {Promise<number>} Sequence.
   */
  async getLastAcknowledgedSequence(deviceId) {
    await this.load();
    return Number(this.sequences.get(deviceId) || 0);
  }

  /**
   * Updates last acknowledged sequence when it advances.
   * @param {string} deviceId DeviceID.
   * @param {number} sequence Sequence.
   * @returns {Promise<number>} Stored sequence.
   */
  async updateLastAcknowledgedSequence(deviceId, sequence) {
    await this.load();
    const next = Math.max(Number(this.sequences.get(deviceId) || 0), Number(sequence || 0));
    this.sequences.set(deviceId, next);
    await this.persist();
    this.eventBus?.emit?.(MailboxEvents.SEQUENCE_UPDATED, { deviceId, sequence: next });
    return next;
  }

  /**
   * Persists sequence state.
   */
  async persist() {
    writeSecureJsonAtomic(this.config.sequenceStatePath, {
      schemaVersion: 1,
      sequences: Object.fromEntries(this.sequences)
    }, { backup: true });
  }
}

module.exports = SequenceManager;
