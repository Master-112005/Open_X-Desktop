'use strict';

const BaseReasoner = require('./BaseReasoner');

class TaskReasoner extends BaseReasoner {
  reason(context) {
    const actions = new Set(context.candidateActions.map(item => item.action));
    if (actions.has('MOVE_FILE')) {
      context.candidateTasks.push({ task: 'Identify source file', confidence: 0.68, source: this.id });
      context.candidateTasks.push({ task: 'Identify destination', confidence: 0.68, source: this.id });
    }
    if (context.candidateGoals.some(goal => goal.id === 'send.document')) {
      context.candidateTasks.push({ task: 'Locate document', confidence: 0.7, source: this.id });
      context.candidateTasks.push({ task: 'Identify recipient', confidence: 0.64, source: this.id });
      context.candidateTasks.push({ task: 'Attach document', confidence: 0.62, source: this.id });
      context.candidateTasks.push({ task: 'Send message', confidence: 0.62, source: this.id });
    }
    if (context.candidateGoals.some(goal => goal.id === 'productivity')) {
      context.candidateTasks.push({ task: 'Identify work target', confidence: 0.6, source: this.id });
      context.candidateTasks.push({ task: 'Identify supporting application', confidence: 0.58, source: this.id });
    }
    return context;
  }
}

module.exports = TaskReasoner;
