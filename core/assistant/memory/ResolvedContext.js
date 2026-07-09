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
}

module.exports = ResolvedContext;
