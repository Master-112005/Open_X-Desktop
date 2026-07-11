class UpdateViewModel {
  constructor(input = {}) {
    Object.assign(this, input);
    Object.freeze(this);
  }
}

module.exports = UpdateViewModel;
