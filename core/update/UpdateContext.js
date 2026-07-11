const { deepFreeze } = require('./UpdateResult');

class UpdateContext {
  constructor(options = {}) {
    this.configuration = options.configuration || null;
    this.version = options.version || null;
    this.diagnostics = options.diagnostics || null;
    this.directories = options.directories || null;
    this.manager = options.manager || null;
    this.initialized = options.initialized === true;
    this.running = options.running === true;
    this.createdAt = options.createdAt || new Date().toISOString();
    this.updatedAt = options.updatedAt || this.createdAt;
  }

  update(values = {}) {
    return new UpdateContext({
      configuration: values.configuration ?? this.configuration,
      version: values.version ?? this.version,
      diagnostics: values.diagnostics ?? this.diagnostics,
      directories: values.directories ?? this.directories,
      manager: values.manager ?? this.manager,
      initialized: values.initialized ?? this.initialized,
      running: values.running ?? this.running,
      createdAt: this.createdAt,
      updatedAt: new Date().toISOString()
    });
  }

  snapshot() {
    return deepFreeze({
      configuration: this.configuration?.toJSON?.() || this.configuration || null,
      version: this.version,
      directories: this.directories,
      initialized: this.initialized,
      running: this.running,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    });
  }
}

module.exports = UpdateContext;
