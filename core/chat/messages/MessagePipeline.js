const MessageModel = require('./MessageModel');
const { MESSAGE_STATUS } = require('./MessageConstants');

/**
 * Desktop encrypted message pipeline: validate, encrypt, compress, and decode.
 */
class MessagePipeline {
  /**
   * Creates message pipeline.
   * @param {object} options Pipeline options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.crypto = options.crypto;
    this.validation = options.validation;
    this.compression = options.compression;
    this.sessionResolver = options.sessionResolver;
  }

  /**
   * Builds an encrypted message ready for server routing.
   * @param {object} input Outgoing input.
   * @returns {Promise<object>} Encrypted message.
   */
  async createEncryptedMessage(input = {}) {
    const validated = this.validation.outgoing(input);
    const messageId = input.messageId || MessageModel.messageId();
    const key = await this.resolveSessionKey({ ...input, ...validated, messageId });
    const aad = Buffer.from(`OpenXChat:v${this.config.protocolVersion}:message:${messageId}:${validated.relationshipId}`);
    const encryptedEnvelope = await Promise.resolve(this.crypto.aes.encrypt({
      key,
      plaintext: Buffer.from(validated.plaintext, 'utf8'),
      aad
    }));
    const compressed = this.compression.compress(JSON.stringify(encryptedEnvelope));
    const ciphertext = compressed.data;
    return MessageModel.create({
      ...validated,
      messageId,
      ciphertext,
      checksum: MessageModel.checksum(ciphertext),
      sequence: input.sequence || 0,
      status: MESSAGE_STATUS.ENCRYPTED,
      version: this.config.protocolVersion,
      compression: compressed.compression,
      encryptionVersion: this.config.encryptionVersion,
      metadata: {
        ...validated.metadata,
        aad: aad.toString('base64url')
      }
    });
  }

  /**
   * Decodes a mailbox envelope into UI plaintext without storing plaintext.
   * @param {object} input Receive input.
   * @returns {Promise<object>} Received message plus plaintext for UI.
   */
  async receiveEncryptedEnvelope(input = {}) {
    const envelope = input.envelope || input;
    const metadata = envelope.metadata || {};
    const key = await this.resolveSessionKey({ ...input, envelope, metadata });
    const compression = {
      algorithm: metadata.compressionAlgorithm || envelope.futureCompression?.algorithm || 'none',
      compressed: metadata.compressionEnabled === true || envelope.futureCompression?.enabled === true,
      version: metadata.compressionVersion || '1'
    };
    const serialized = this.compression.decompress(envelope.ciphertext, compression).toString('utf8');
    const encryptedEnvelope = JSON.parse(serialized);
    const plaintext = await Promise.resolve(this.crypto.aes.decrypt({ key, ...encryptedEnvelope }));
    const text = Buffer.from(plaintext).toString('utf8');
    const message = MessageModel.create({
      messageId: envelope.messageId,
      relationshipId: metadata.relationshipId,
      senderAccountId: metadata.senderAccountId,
      senderDeviceId: envelope.senderDeviceId,
      recipientAccountId: metadata.recipientAccountId,
      recipientDeviceId: envelope.recipientDeviceId,
      messageType: metadata.messageType || 'Text',
      ciphertext: envelope.ciphertext,
      checksum: envelope.checksum,
      timestamp: metadata.timestamp || envelope.createdAt,
      sequence: envelope.mailboxSequence,
      status: MESSAGE_STATUS.DELIVERED,
      version: envelope.protocolVersion,
      compression,
      encryptionVersion: metadata.encryptionVersion || this.config.encryptionVersion,
      metadata: {
        relationshipId: metadata.relationshipId,
        envelopeId: envelope.envelopeId
      }
    });
    return { message, plaintext: text, envelope };
  }

  /**
   * Resolves a 32-byte session key from provided material or hooks.
   * @param {object} context Key context.
   * @returns {Promise<Buffer>} Session key.
   */
  async resolveSessionKey(context = {}) {
    let key = context.sessionKey || null;
    if (!key && typeof this.sessionResolver === 'function') key = await this.sessionResolver(context);
    if (!key && context.sessionId && this.crypto.sessions?.validateSession) {
      key = this.crypto.sessions.validateSession(context.sessionId).sessionKey;
    }
    if (!key && this.config.allowEphemeralSessionKey) {
      const session = this.crypto.sessions.createSession({ localDeviceId: context.senderDeviceId, remoteDeviceId: context.recipientDeviceId });
      key = this.crypto.sessions.validateSession(session.sessionId).sessionKey;
    }
    if (!key && this.config.requireSessionKey) throw new Error('A Phase 4 session key is required before sending or receiving messages.');
    return this.normalizeKey(key || this.crypto.random.key());
  }

  /**
   * Normalizes key material to a Buffer.
   * @param {*} value Key value.
   * @returns {Buffer} Key buffer.
   */
  normalizeKey(value) {
    if (Buffer.isBuffer(value)) return this.assertKey(value);
    if (value instanceof Uint8Array) return this.assertKey(Buffer.from(value));
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (/^[a-f0-9]{64}$/i.test(trimmed)) return this.assertKey(Buffer.from(trimmed, 'hex'));
      return this.assertKey(Buffer.from(trimmed, 'base64url'));
    }
    throw new Error('Message session key is invalid.');
  }

  /**
   * Validates key length.
   * @param {Buffer} key Key.
   * @returns {Buffer} Key.
   */
  assertKey(key) {
    if (key.byteLength !== 32) throw new Error('Message session key must be 32 bytes.');
    return key;
  }
}

module.exports = MessagePipeline;
