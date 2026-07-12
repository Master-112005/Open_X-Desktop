const crypto = require('crypto');

const ENVELOPE_VERSION = 1;
const SCHEME = 'openx-e2ee-v1';
const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const DEFAULT_REPLAY_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_MAX_REPLAY_ENTRIES = 2000;

function toBase64Url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function fromBase64Url(value, expectedBytes = 0) {
  const buffer = Buffer.from(String(value || ''), 'base64url');
  if (expectedBytes && buffer.length !== expectedBytes) {
    throw new Error('Invalid E2EE key material length.');
  }
  return buffer;
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function generateSecret() {
  return toBase64Url(crypto.randomBytes(KEY_BYTES));
}

function deriveKey(secret, domain, context = {}) {
  const input = fromBase64Url(secret, KEY_BYTES);
  const salt = crypto
    .createHash('sha256')
    .update(`openx:${SCHEME}:${String(domain || 'relay')}:${canonicalJson(context)}`)
    .digest();
  const info = Buffer.from(`openx:${SCHEME}:${String(domain || 'relay')}`, 'utf8');
  return Buffer.from(crypto.hkdfSync('sha256', input, salt, info, KEY_BYTES));
}

function buildPacketAad(packet = {}) {
  return {
    packetId: String(packet.packetId || ''),
    protocolVersion: Number(packet.protocolVersion || 1),
    packetType: String(packet.packetType || ''),
    sourceDeviceId: String(packet.sourceDeviceId || ''),
    destinationDeviceId: String(packet.destinationDeviceId || ''),
    ownerId: String(packet.ownerId || ''),
    timestamp: Number(packet.timestamp || 0),
    requestId: packet.requestId || null,
    responseId: packet.responseId || null
  };
}

function encryptJson(secret, payload, { domain = 'relay-packet', context = {}, aad = {} } = {}) {
  const key = deriveKey(secret, domain, context);
  const nonce = crypto.randomBytes(NONCE_BYTES);
  const aadText = canonicalJson(aad);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(aadText, 'utf8'));
  const plaintext = Buffer.from(JSON.stringify(payload ?? null), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    version: ENVELOPE_VERSION,
    scheme: SCHEME,
    alg: 'AES-256-GCM',
    kdf: 'HKDF-SHA256',
    domain,
    nonce: toBase64Url(nonce),
    tag: toBase64Url(cipher.getAuthTag()),
    ciphertext: toBase64Url(ciphertext),
    aadHash: crypto.createHash('sha256').update(aadText).digest('base64url')
  };
}

function decryptJson(secret, envelope, { domain = '', context = {}, aad = {} } = {}) {
  if (!envelope || envelope.scheme !== SCHEME || envelope.version !== ENVELOPE_VERSION) {
    throw new Error('Unsupported E2EE envelope.');
  }
  if (domain && envelope.domain !== domain) {
    throw new Error('Unexpected E2EE envelope domain.');
  }
  const aadText = canonicalJson(aad);
  const aadHash = crypto.createHash('sha256').update(aadText).digest('base64url');
  if (envelope.aadHash && envelope.aadHash !== aadHash) {
    throw new Error('E2EE authenticated metadata mismatch.');
  }
  const key = deriveKey(secret, envelope.domain, context);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    fromBase64Url(envelope.nonce, NONCE_BYTES),
    { authTagLength: TAG_BYTES }
  );
  decipher.setAAD(Buffer.from(aadText, 'utf8'));
  decipher.setAuthTag(fromBase64Url(envelope.tag, TAG_BYTES));
  const plaintext = Buffer.concat([
    decipher.update(fromBase64Url(envelope.ciphertext)),
    decipher.final()
  ]).toString('utf8');
  return JSON.parse(plaintext);
}

function clonePacket(packet = {}) {
  return JSON.parse(JSON.stringify(packet || {}));
}

class SecurePacketChannel {
  constructor(options = {}) {
    this.masterKey = '';
    this.logger = options.logger || console;
    this.now = options.now || (() => Date.now());
    this.replayWindowMs = Number(options.replayWindowMs) || DEFAULT_REPLAY_WINDOW_MS;
    this.maxReplayEntries = Number(options.maxReplayEntries) || DEFAULT_MAX_REPLAY_ENTRIES;
    this.replayCache = new Map();
    if (options.masterKey) this.setMasterKey(options.masterKey);
  }

  setMasterKey(masterKey) {
    const key = String(masterKey || '').trim();
    if (!key) {
      this.masterKey = '';
      this.replayCache.clear();
      return false;
    }
    fromBase64Url(key, KEY_BYTES);
    this.masterKey = key;
    return true;
  }

  hasKey() {
    return Boolean(this.masterKey);
  }

  getStatus() {
    return {
      enabled: this.hasKey(),
      scheme: SCHEME,
      replayWindowMs: this.replayWindowMs,
      replayCacheSize: this.replayCache.size
    };
  }

  encryptPacket(packet) {
    if (!this.hasKey()) return packet;
    const source = clonePacket(packet);
    const aad = buildPacketAad(source);
    const sensitive = {
      payload: source.payload ?? null,
      metadata: source.metadata || {},
      checksum: source.checksum || null,
      encryption: source.encryption || null
    };
    const envelope = encryptJson(this.masterKey, sensitive, {
      domain: 'relay-packet',
      context: {
        ownerId: source.ownerId,
        sourceDeviceId: source.sourceDeviceId,
        destinationDeviceId: source.destinationDeviceId
      },
      aad
    });
    return {
      ...source,
      payload: { type: 'encrypted', scheme: SCHEME },
      metadata: {
        encrypted: true,
        retryable: source.metadata?.retryable === true
      },
      checksum: null,
      encryption: {
        encrypted: true,
        scheme: SCHEME,
        envelope
      }
    };
  }

  decryptPacket(packet) {
    const encrypted = packet?.encryption;
    if (!encrypted?.encrypted) return packet;
    if (!this.hasKey()) {
      throw new Error('Missing E2EE master key.');
    }
    if (encrypted.scheme !== SCHEME) {
      throw new Error('Unsupported E2EE packet scheme.');
    }
    this.rejectReplay(packet, encrypted.envelope);
    const source = clonePacket(packet);
    const aad = buildPacketAad(source);
    const sensitive = decryptJson(this.masterKey, encrypted.envelope, {
      domain: 'relay-packet',
      context: {
        ownerId: source.ownerId,
        sourceDeviceId: source.sourceDeviceId,
        destinationDeviceId: source.destinationDeviceId
      },
      aad
    });
    return {
      ...source,
      payload: sensitive?.payload ?? null,
      metadata: sensitive?.metadata || {},
      checksum: sensitive?.checksum || null,
      encryption: sensitive?.encryption || null
    };
  }

  rejectReplay(packet, envelope) {
    const timestamp = Number(packet?.timestamp || 0);
    const age = Math.abs(this.now() - timestamp);
    if (!Number.isFinite(timestamp) || timestamp <= 0 || age > this.replayWindowMs) {
      throw new Error('E2EE packet outside replay window.');
    }
    this.pruneReplayCache();
    const nonce = String(envelope?.nonce || '');
    const key = `${packet?.sourceDeviceId || ''}:${packet?.packetId || ''}:${nonce}`;
    if (this.replayCache.has(key)) {
      throw new Error('E2EE packet replay rejected.');
    }
    this.replayCache.set(key, this.now());
  }

  pruneReplayCache() {
    const cutoff = this.now() - this.replayWindowMs;
    for (const [key, seenAt] of this.replayCache) {
      if (seenAt < cutoff || this.replayCache.size > this.maxReplayEntries) {
        this.replayCache.delete(key);
      }
    }
  }
}

module.exports = {
  ENVELOPE_VERSION,
  SCHEME,
  generateSecret,
  encryptJson,
  decryptJson,
  SecurePacketChannel,
  buildPacketAad
};
