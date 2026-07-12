class UpdatePresentationContext {
  constructor(input = {}) {
    this.source = input.source || 'settings';
    this.openedAt = input.openedAt || new Date().toISOString();
    Object.freeze(this);
  }
}

module.exports = UpdatePresentationContext;
