const RequestConfiguration = require('./RequestConfiguration');
const RequestEvents = require('./RequestEvents');
const RequestLogger = require('./RequestLogger');
const RequestValidation = require('./RequestValidation');
const { readSecureJsonFile, writeSecureJsonAtomic } = require('../../assistant/Data');

/**
 * Desktop private nickname manager. Nicknames stay local to this installation.
 */
class NicknameManager {
  /**
   * Creates a nickname manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.config = options.config instanceof RequestConfiguration ? options.config : new RequestConfiguration(options.config || {});
    this.eventBus = options.eventBus;
    this.logger = options.logger || new RequestLogger();
    this.validator = options.validator || new RequestValidation({ config: this.config });
    this.nicknames = new Map();
    this.loaded = false;
  }

  /**
   * Loads nickname state from local disk.
   */
  async load() {
    if (this.loaded) return;
    const parsed = readSecureJsonFile(this.config.nicknameStatePath, () => ({ schemaVersion: 1, nicknames: [] }), {
      createIfMissing: true,
      validate: value => value && typeof value === 'object'
    });
    for (const record of Array.isArray(parsed?.nicknames) ? parsed.nicknames : []) {
      if (record?.ownerAccountId && record?.targetAccountId) this.nicknames.set(this.key(record.ownerAccountId, record.targetAccountId), record);
    }
    this.loaded = true;
  }

  /**
   * Sets a private nickname for an account.
   * @param {object} input Nickname input.
   * @returns {Promise<object>} Nickname record.
   */
  async setNickname(input = {}) {
    await this.load();
    const ownerAccountId = this.validator.accountId(input.ownerAccountId);
    const targetAccountId = this.validator.accountId(input.targetAccountId);
    const now = new Date().toISOString();
    const record = {
      ownerAccountId,
      targetAccountId,
      nickname: this.validator.nickname(input.nickname),
      status: 'Active',
      updatedAt: now,
      futureOwnDeviceSynchronization: { enabled: false, phase: 'future' }
    };
    this.nicknames.set(this.key(ownerAccountId, targetAccountId), record);
    await this.persist();
    this.emit(RequestEvents.NICKNAME_UPDATED, { ownerAccountId, targetAccountId });
    return record;
  }

  /**
   * Deletes a private nickname.
   * @param {object} input Delete input.
   * @returns {Promise<object|null>} Deleted nickname or null.
   */
  async deleteNickname(input = {}) {
    await this.load();
    const ownerAccountId = this.validator.accountId(input.ownerAccountId);
    const targetAccountId = this.validator.accountId(input.targetAccountId);
    const key = this.key(ownerAccountId, targetAccountId);
    const existing = this.nicknames.get(key) || null;
    this.nicknames.delete(key);
    await this.persist();
    this.emit(RequestEvents.NICKNAME_DELETED, { ownerAccountId, targetAccountId });
    return existing ? { ...existing, status: 'Deleted', updatedAt: new Date().toISOString() } : null;
  }

  /**
   * Gets a private nickname.
   * @param {string} ownerAccountId Owner AccountID.
   * @param {string} targetAccountId Target AccountID.
   * @returns {Promise<object|null>} Nickname record.
   */
  async getNickname(ownerAccountId, targetAccountId) {
    await this.load();
    return this.nicknames.get(this.key(this.validator.accountId(ownerAccountId), this.validator.accountId(targetAccountId))) || null;
  }

  /**
   * Lists private nicknames for an owner.
   * @param {string} ownerAccountId Owner AccountID.
   * @returns {Promise<object[]>} Nicknames.
   */
  async listNicknames(ownerAccountId) {
    await this.load();
    const owner = this.validator.accountId(ownerAccountId);
    return Array.from(this.nicknames.values()).filter(record => record.ownerAccountId === owner);
  }

  /**
   * Persists local nickname state.
   */
  async persist() {
    const data = { schemaVersion: 1, nicknames: Array.from(this.nicknames.values()) };
    writeSecureJsonAtomic(this.config.nicknameStatePath, data, { backup: true });
  }

  /**
   * Builds a stable owner-target key.
   * @param {string} ownerAccountId Owner AccountID.
   * @param {string} targetAccountId Target AccountID.
   * @returns {string} Storage key.
   */
  key(ownerAccountId, targetAccountId) {
    return `${ownerAccountId}:${targetAccountId}`;
  }

  /**
   * Emits an event if a bus is available.
   * @param {string} eventName Event name.
   * @param {object} payload Payload.
   */
  emit(eventName, payload = {}) {
    this.eventBus?.emit?.(eventName, payload);
  }
}

module.exports = NicknameManager;
