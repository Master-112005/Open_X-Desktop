'use strict';

const BasePlanner = require('./BasePlanner');

class DependencyPlanner extends BasePlanner {
  plan(context) {
    const has = id => context.tasks.some(task => task.id === id);
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
      if (context.workflow.type === 'email' || context.workflow.type === 'file') {
        context.addDependency(previous.id, current.id, 'sequential-context');
      }
    }

    context.diagnostics.dependencyCount = context.dependencies.length;
    return context;
  }
}

module.exports = DependencyPlanner;
