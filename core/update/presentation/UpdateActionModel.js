class UpdateActionModel {
  constructor(input = {}) {
    this.id = String(input.id || '');
    this.label = String(input.label || this.id);
    this.enabled = input.enabled !== false;
    this.primary = input.primary === true;
    this.future = input.future === true;
    this.reason = String(input.reason || '');
    Object.freeze(this);
  }
}

module.exports = UpdateActionModel;
