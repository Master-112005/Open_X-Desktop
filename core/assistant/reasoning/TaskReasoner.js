'use strict';

const BaseReasoner = require('./BaseReasoner');

class TaskReasoner extends BaseReasoner {
  reason(context) {
    const actions = new Set(context.candidateActions.map(item => item.action));
    const entities = this._entities(context);
    if (actions.has('MOVE_FILE')) {
      context.addTask({ task: 'Identify source file', action: 'MOVE_FILE', confidence: 0.68, source: this.id, metadata: { entities } });
      context.addTask({ task: 'Identify destination', action: 'MOVE_FILE', confidence: 0.68, source: this.id, metadata: { entities } });
    }
    if (context.candidateGoals.some(goal => goal.id === 'send.document')) {
      context.addTask({ task: 'Locate document', action: 'OPEN_FILE', confidence: 0.7, source: this.id, metadata: { entities } });
      context.addTask({ task: 'Identify recipient', action: 'SEND_MESSAGE', confidence: 0.64, source: this.id, metadata: { entities } });
      context.addTask({ task: 'Attach document', action: 'TRANSFER_FILE', confidence: 0.62, source: this.id, metadata: { entities } });
      context.addTask({ task: 'Send message', action: 'SEND_MESSAGE', confidence: 0.62, source: this.id, metadata: { entities } });
    }
    if (context.candidateGoals.some(goal => goal.id === 'productivity')) {
      context.addTask({ task: 'Identify work target', confidence: 0.6, source: this.id, metadata: { entities } });
      context.addTask({ task: 'Identify supporting application', action: 'OPEN_APPLICATION', confidence: 0.58, source: this.id, metadata: { entities } });
    }
    if (actions.has('PLAY_MEDIA')) context.addTask({ task: 'Play requested media', action: 'PLAY_MEDIA', confidence: 0.78, source: this.id, metadata: { entities } });
    if (actions.has('SEARCH_WEB')) context.addTask({ task: 'Search the web', action: 'SEARCH_WEB', confidence: 0.76, source: this.id, metadata: { entities } });
    if (actions.has('CREATE_REMINDER')) context.addTask({ task: 'Create reminder', action: 'CREATE_REMINDER', confidence: 0.78, source: this.id, metadata: { entities } });
    if (actions.has('SET_ALARM')) context.addTask({ task: 'Set alarm', action: 'SET_ALARM', confidence: 0.78, source: this.id, metadata: { entities } });
    if (actions.has('SET_TIMER')) context.addTask({ task: 'Set timer', action: 'SET_TIMER', confidence: 0.78, source: this.id, metadata: { entities } });
    if (actions.has('SET_VOLUME')) context.addTask({ task: 'Set volume', action: 'SET_VOLUME', confidence: 0.76, source: this.id, metadata: { entities } });
    if (actions.has('SET_BRIGHTNESS')) context.addTask({ task: 'Set brightness', action: 'SET_BRIGHTNESS', confidence: 0.76, source: this.id, metadata: { entities } });
    context.diagnostics.taskCandidates = context.candidateTasks.length;
    return context;
  }

  _entities(context) {
    const action = context.ranked('candidateActions')[0];
    return { ...(action?.metadata?.entities || {}) };
  }
}

module.exports = TaskReasoner;
