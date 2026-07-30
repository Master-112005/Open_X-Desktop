'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ensureDataRoot, writeFileAtomic } = require('../Data');

const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
}

class PersonalMemoryEncryption {
  constructor(options = {}) {
    this.config = options.config || {};
    const paths = ensureDataRoot(this.config);
    this.keyPath = path.resolve(options.keyPath || paths.personalVaultKeyPath);
    this.key = options.key ? Buffer.from(options.key) : this._loadOrCreateKey();
  }

  encrypt(value) {
    if (value === undefined || value === null || value === '') return null;
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      algorithm: 'aes-256-gcm',
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ciphertext: ciphertext.toString('base64')
    };
  }

  decrypt(payload) {
    if (!payload) return null;
    if (typeof payload !== 'object' || payload.algorithm !== 'aes-256-gcm') {
      throw new Error('Unsupported personal-memory encryption payload.');
    }
    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
      throw new Error('Invalid personal-memory encryption payload.');
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return JSON.parse(plaintext);
  }

  hashValue(value) {
    return crypto
      .createHmac('sha256', this.key)
      .update(String(value || '').trim().toLowerCase())
      .digest('hex');
  }

  _loadOrCreateKey() {
    ensureParent(this.keyPath);
    if (fs.existsSync(this.keyPath)) {
      const key = Buffer.from(fs.readFileSync(this.keyPath, 'utf8').trim(), 'base64');
      if (key.length === KEY_BYTES) return key;
    }
    const key = crypto.randomBytes(KEY_BYTES);
    writeFileAtomic(this.keyPath, `${key.toString('base64')}\n`);
    try { fs.chmodSync(this.keyPath, 0o600); } catch (_) {}
    return key;
  }
}

module.exports = PersonalMemoryEncryption;
