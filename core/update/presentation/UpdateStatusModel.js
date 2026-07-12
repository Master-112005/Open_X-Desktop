class UpdateStatusModel {
  constructor(input = {}) {
    this.state = input.state || 'IDLE';
    this.label = input.label || 'Waiting';
    this.health = input.health || 'ok';
    this.message = input.message || '';
    Object.freeze(this);
  }
}

module.exports = UpdateStatusModel;
