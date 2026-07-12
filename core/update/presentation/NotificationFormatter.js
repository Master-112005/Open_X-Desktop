class NotificationFormatter {
  static build(type, model = {}) {
    return Object.freeze({
      type: String(type || 'information'),
      title: model.status?.label || 'OpenX Update',
      message: model.status?.message || model.releaseNotes?.summary || 'Update status changed.',
      severity: type === 'failed' ? 'error' : type === 'ready' ? 'success' : 'information',
      createdAt: new Date().toISOString()
    });
  }
}

module.exports = NotificationFormatter;
