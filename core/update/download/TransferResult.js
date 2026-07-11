class TransferResult {
  constructor({ success = true, type = 'download.transfer', data = {}, error = null } = {}) {
    this.success = success === true;
    this.type = String(type || 'download.transfer');
    this.data = Object.freeze({ ...(data || {}) });
    this.error = error ? Object.freeze({
      message: error.message || String(error),
      code: error.code || null
    }) : null;
    Object.freeze(this);
  }

  static ok(type, data = {}) {
    return new TransferResult({ success: true, type, data });
  }

  static fail(type, error, data = {}) {
    return new TransferResult({ success: false, type, error, data });
  }
}

module.exports = TransferResult;
