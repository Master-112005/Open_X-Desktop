class UpdateNotificationResult {
  constructor({ success = true, event = null, card = null, displayed = false, ignored = false, reason = '', error = null } = {}) {
    this.success = success === true;
    this.event = event || null;
    this.card = card || null;
    this.displayed = displayed === true;
    this.ignored = ignored === true;
    this.reason = String(reason || '');
    this.error = error ? Object.freeze({
      message: error.message || String(error.message || error),
      code: error.code || null
    }) : null;
    Object.freeze(this);
  }

  static ok(data = {}) {
    return new UpdateNotificationResult({ success: true, ...data });
  }

  static fail(error, data = {}) {
    return new UpdateNotificationResult({ success: false, error, ...data });
  }
}

module.exports = UpdateNotificationResult;
