'use strict';

const PlanningConfiguration = require('./PlanningConfiguration');
const PlanningRegistry = require('./PlanningRegistry');
const PlanningPipeline = require('./PlanningPipeline');
const TaskPlanner = require('./TaskPlanner');
const WorkflowPlanner = require('./WorkflowPlanner');
const DependencyPlanner = require('./DependencyPlanner');
const ParallelPlanner = require('./ParallelPlanner');
const RecoveryPlanner = require('./RecoveryPlanner');
const ExecutionPlanner = require('./ExecutionPlanner');
const PlannerOptimizer = require('./PlannerOptimizer');
const TaskGraphBuilder = require('./TaskGraphBuilder');
const ExecutionGraphBuilder = require('./ExecutionGraphBuilder');

class PlanningManager {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof PlanningConfiguration
      ? options.configuration
      : new PlanningConfiguration(options.configuration || options);
    this.registry = options.registry || new PlanningRegistry();
    this.pipeline = options.pipeline || null;
    this.logger = options.logger || null;
    if (options.defaultPlanners !== false) this._registerDefaults();
  }

  _registerDefaults() {
    [
      [TaskPlanner, 'planning.taskPlanner', 10],
      [WorkflowPlanner, 'planning.workflowPlanner', 20],
      [DependencyPlanner, 'planning.dependencyPlanner', 30],
      [ParallelPlanner, 'planning.parallelPlanner', 40],
      [RecoveryPlanner, 'planning.recoveryPlanner', 50],
      [PlannerOptimizer, 'planning.optimizer', 60],
      [ExecutionPlanner, 'planning.executionPlanner', 70],
      [TaskGraphBuilder, 'planning.taskGraphBuilder', 80],
      [ExecutionGraphBuilder, 'planning.executionGraphBuilder', 90]
    ].forEach(([Ctor, id, priority]) => {
      const configured = this.configuration.getPlannerOptions(id, { priority });
      this.registry.register(new Ctor({ id, ...configured }), { id, priority: configured.priority, enabled: configured.enabled });
    });
  }

  registerPlanner(planner, options = {}) {
    this.registry.register(planner, options);
    return this;
  }

  async plan(reasoningResult, options = {}) {
    if (!this.pipeline) {
      this.pipeline = new PlanningPipeline({
        registry: this.registry,
        configuration: this.configuration,
        logger: this.logger
      });
    }
    return this.pipeline.run(reasoningResult, {
      ...(options || {}),
      metadata: {
        ...(options.metadata || {}),
        planningManagerVersion: this.configuration.version
      }
    });
  }

  getStatus() {
    return {
      enabled: this.configuration.enabled,
      version: this.configuration.version,
      pipelineReady: Boolean(this.pipeline),
      plannerCount: this.registry.list().length,
      planners: this.registry.health()
    };
  }

  destroy() {
    for (const planner of this.registry.list()) planner.destroy?.();
    this.registry.clear();
    this.pipeline = null;
  }
}

function createDefaultPlanningManager(options = {}) {
  return new PlanningManager(options);
}

module.exports = { PlanningManager, createDefaultPlanningManager };
