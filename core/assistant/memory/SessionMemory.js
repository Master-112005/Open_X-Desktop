'use strict';

const BaseMemoryProvider = require('./BaseMemoryProvider');

class SessionMemory extends BaseMemoryProvider {
  apply(context) {
    const limit = Number(this.options.limit || context.configuration?.memoryLimit || 50);
    const session = context.state.sessionMemory || {
      startedAt: Date.now(),
      recentApplications: [],
      recentFiles: [],
      temporaryVariables: {}
    };
    for (const entity of context.entities) {
      if (entity.type === 'application') session.recentApplications.push(entity.canonical || entity.value);
      if (entity.type === 'file' || entity.type === 'path') session.recentFiles.push(entity.canonical || entity.value);
    }
    session.recentApplications = Array.from(new Set(session.recentApplications)).slice(-limit);
    session.recentFiles = Array.from(new Set(session.recentFiles)).slice(-limit);
    session.updatedAt = Date.now();
    context.state.sessionMemory = session;
    context.sessionMemory = { ...session };
    return context;
  }
}

module.exports = SessionMemory;
