'use strict';

const BaseValidator = require('./BaseValidator');

class ConstraintValidator extends BaseValidator {
  validate(context) {
    const taskIds = new Set((context.executionBlueprint?.tasks || []).map(task => task.id));
    context.check(this.id, taskIds.size === (context.executionBlueprint?.tasks || []).length, 'task ids are unique', {
      taskCount: (context.executionBlueprint?.tasks || []).length,
      uniqueTaskCount: taskIds.size
    });
    for (const dependency of context.executionBlueprint?.dependencies || []) {
      context.check(this.id, taskIds.has(dependency.from) && taskIds.has(dependency.to), 'dependency endpoints exist', dependency);
    }
    for (const order of context.executionBlueprint?.ordering || []) {
      context.check(this.id, taskIds.has(order.taskId), 'ordering task exists', order);
    }
    const cycle = this._findCycle(context.executionBlueprint?.dependencies || []);
    context.check(this.id, !cycle, cycle ? 'dependency graph has cycle' : 'dependency graph acyclic', { cycle });
    if ((context.executionBlueprint?.dependencies || []).length === 0) {
      context.check(this.id, true, 'no dependency constraints');
    }
    return context;
  }

  _findCycle(dependencies) {
    const graph = new Map();
    for (const dependency of dependencies) {
      if (!dependency?.from || !dependency?.to) continue;
      if (!graph.has(dependency.from)) graph.set(dependency.from, []);
      graph.get(dependency.from).push(dependency.to);
    }
    const visiting = new Set();
    const visited = new Set();
    const visit = node => {
      if (visiting.has(node)) return node;
      if (visited.has(node)) return null;
      visiting.add(node);
      for (const next of graph.get(node) || []) {
        const cycle = visit(next);
        if (cycle) return cycle;
      }
      visiting.delete(node);
      visited.add(node);
      return null;
    };
    for (const node of graph.keys()) {
      const cycle = visit(node);
      if (cycle) return cycle;
    }
    return null;
  }
}

module.exports = ConstraintValidator;
