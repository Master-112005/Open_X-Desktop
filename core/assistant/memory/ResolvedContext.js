'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

class ResolvedContext {
  constructor(input = {}) {
    this.workingMemory = input.workingMemory || {};
    this.conversationMemory = input.conversationMemory || {};
    this.sessionMemory = input.sessionMemory || {};
    this.dialogueHistory = input.dialogueHistory || [];
    this.topic = input.topic || null;
    this.resolvedReferences = input.resolvedReferences || [];
    this.resolvedAliases = input.resolvedAliases || [];
    this.resolvedPronouns = input.resolvedPronouns || [];
    this.application = input.application || {};
    this.runningApplications = input.runningApplications || [];
    this.desktopState = input.desktopState || {};
    this.browserState = input.browserState || {};
    this.screen = input.screen || {};
    this.clipboard = input.clipboard || {};
    this.selections = input.selections || {};
    this.windows = input.windows || {};
    this.system = input.system || {};
    this.media = input.media || {};
    this.calendar = input.calendar || {};
    this.time = input.time || {};
    this.user = input.user || {};
    this.metadata = { ...(input.metadata || {}) };
    this.diagnostics = input.diagnostics || {};
    this.confidence = Math.max(0, Math.min(1, Number(input.confidence ?? 0)));
    this.timing = { ...(input.timing || {}) };
    this.version = String(input.version || '7.0.0');
    this.futureExtensions = { ...(input.futureExtensions || {}) };
    deepFreeze(this);
  }

  getRecentReference(type = '') {
    const wanted = String(type || '');
    return this.conversationMemory?.references?.slice().reverse().find(reference => !wanted || reference.type === wanted) || null;
  }

  hasContext() {
    return Boolean(
      Object.keys(this.workingMemory || {}).length ||
      Object.keys(this.sessionMemory || {}).length ||
      (this.resolvedReferences || []).length ||
      this.topic
    );
  }

  toJSON() {
    return {
      workingMemory: this.workingMemory,
      conversationMemory: this.conversationMemory,
      sessionMemory: this.sessionMemory,
      dialogueHistory: this.dialogueHistory,
      topic: this.topic,
      resolvedReferences: this.resolvedReferences,
      resolvedAliases: this.resolvedAliases,
      resolvedPronouns: this.resolvedPronouns,
      application: this.application,
      runningApplications: this.runningApplications,
      desktopState: this.desktopState,
      browserState: this.browserState,
      screen: this.screen,
      clipboard: this.clipboard,
      selections: this.selections,
      windows: this.windows,
      system: this.system,
      media: this.media,
      calendar: this.calendar,
      time: this.time,
      user: this.user,
      metadata: this.metadata,
      diagnostics: this.diagnostics,
      confidence: this.confidence,
      timing: this.timing,
      version: this.version,
      futureExtensions: this.futureExtensions
    };
  }
}

module.exports = ResolvedContext;
