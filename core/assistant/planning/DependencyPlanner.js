'use strict';

const BasePlanner = require('./BasePlanner');

class DependencyPlanner extends BasePlanner {
  plan(context) {
    const has = id => context.tasks.some(task => task.id === id);
    for (const task of context.tasks) {
      for (const dependencyId of task.dependsOn || []) {
        context.addDependency(dependencyId, task.id, 'explicit');
      }
    }
    if (has('attach.document') && has('locate.document')) context.addDependency('locate.document', 'attach.document');
    if (has('send.message') && has('compose.email')) context.addDependency('compose.email', 'send.message');
    if (has('attach.document') && has('compose.email')) context.addDependency('compose.email', 'attach.document');
    if (has('send.message') && has('attach.document')) context.addDependency('attach.document', 'send.message');
    if (has('identify.destination') && has('identify.source.file')) context.addDependency('identify.source.file', 'identify.destination');
    if (has('move.file') && has('identify.destination')) context.addDependency('identify.destination', 'move.file');
    if (has('delete.file') && has('identify.source.file')) context.addDependency('identify.source.file', 'delete.file');

    for (let index = 1; index < context.tasks.length; index += 1) {
      const previous = context.tasks[index - 1];
      const current = context.tasks[index];
      if (context.configuration?.sequentialWorkflows?.has?.(context.workflow.type)) {
        context.addDependency(previous.id, current.id, 'sequential-context');
      }
    }

    this._addSourceBeforeMutationDependencies(context);

    context.diagnostics.dependencyCount = context.dependencies.length;
    return context;
  }

  _addSourceBeforeMutationDependencies(context) {
    const sourceTasks = context.tasks.filter(task => /\b(?:identify|locate|find|search)\b/i.test(task.label || ''));
    const mutationTasks = context.tasks.filter(task => /^(?:MOVE_FILE|DELETE_FILE|OPEN_FILE|CREATE_FILE|SEND_MESSAGE)$/i.test(task.action || ''));
    if (sourceTasks.length === 0 || mutationTasks.length === 0) return;
    for (const mutation of mutationTasks) {
      for (const source of sourceTasks) {
        if (source.id !== mutation.id) context.addDependency(source.id, mutation.id, 'source-before-action');
      }
    }
  }
}

module.exports = DependencyPlanner;
