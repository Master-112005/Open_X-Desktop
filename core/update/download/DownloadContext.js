class DownloadContext {
  constructor(input = {}) {
    this.directories = Object.freeze({ ...(input.directories || {}) });
    this.configuration = input.configuration;
    this.initialized = input.initialized === true;
    Object.freeze(this);
  }
}

module.exports = DownloadContext;
