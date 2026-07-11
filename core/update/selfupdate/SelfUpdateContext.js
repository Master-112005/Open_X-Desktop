class SelfUpdateContext {
  constructor(input = {}) {
    this.initialized = input.initialized === true;
    this.running = input.running === true;
    this.directories = Object.freeze({ ...(input.directories || {}) });
    this.latestVerification = input.latestVerification || null;
    Object.freeze(this);
  }

  update(input = {}) {
    return new SelfUpdateContext({
      initialized: input.initialized ?? this.initialized,
      running: input.running ?? this.running,
      directories: input.directories || this.directories,
      latestVerification: input.latestVerification ?? this.latestVerification
    });
  }
}

module.exports = SelfUpdateContext;
