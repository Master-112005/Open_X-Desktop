'use strict';

const BaseDecision = require('./BaseDecision');

class ExecutionDecision extends BaseDecision {
  decide(context) {
    const blueprint = context.executionBlueprint || {};
    const taskIds = new Set((blueprint.tasks || []).map(task => task.id));
    const missing = (blueprint.dependencies || []).filter(dependency => !taskIds.has(dependency.from) || !taskIds.has(dependency.to));
    if (missing.length > 0) {
      context.addBlocker('missing-dependencies', {
        dependencies: missing,
        reason: 'execution blueprint has missing dependencies'
      }, 'REJECT');
      context.futureExtensions.missingDependencies = missing;
    }
    const cycle = this._findCycle(blueprint.dependencies || []);
    if (cycle.length > 0) {
      context.addBlocker('dependency-cycle', {
        cycle,
        reason: 'execution blueprint has a dependency cycle'
      }, 'REJECT');
      context.futureExtensions.dependencyCycle = cycle;
    }
    return context;
  }

  _findCycle(dependencies = []) {
    const graph = new Map();
    for (const dependency of dependencies) {
      if (!dependency?.from || !dependency?.to) continue;
      if (!graph.has(dependency.from)) graph.set(dependency.from, []);
      graph.get(dependency.from).push(dependency.to);
    }
    const visiting = new Set();
    const visited = new Set();
    const path = [];

    const visit = node => {
      if (visiting.has(node)) {
        const start = path.indexOf(node);
        return start >= 0 ? path.slice(start).concat(node) : [node];
      }
      if (visited.has(node)) return [];
      visiting.add(node);
      path.push(node);
      for (const next of graph.get(node) || []) {
        const cycle = visit(next);
        if (cycle.length > 0) return cycle;
      }
      path.pop();
      visiting.delete(node);
      visited.add(node);
      return [];
    };

    for (const node of graph.keys()) {
      const cycle = visit(node);
      if (cycle.length > 0) return cycle;
    }
    return [];
  }
}

module.exports = ExecutionDecision;
