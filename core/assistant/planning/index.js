'use strict';

const { PlanningManager, createDefaultPlanningManager } = require('./PlanningManager');
const ExecutionBlueprint = require('./ExecutionBlueprint');

const PLANNING_VERSION = '9.0.0';

module.exports = {
  PLANNING_VERSION,
  PlanningPipeline: require('./PlanningPipeline'),
  PlanningManager,
  createDefaultPlanningManager,
  PlanningContext: require('./PlanningContext'),
  PlanningRegistry: require('./PlanningRegistry'),
  BasePlanner: require('./BasePlanner'),
  TaskPlanner: require('./TaskPlanner'),
  ExecutionPlanner: require('./ExecutionPlanner'),
  WorkflowPlanner: require('./WorkflowPlanner'),
  DependencyPlanner: require('./DependencyPlanner'),
  ParallelPlanner: require('./ParallelPlanner'),
  RecoveryPlanner: require('./RecoveryPlanner'),
  PlannerOptimizer: require('./PlannerOptimizer'),
  TaskGraphBuilder: require('./TaskGraphBuilder'),
  ExecutionGraphBuilder: require('./ExecutionGraphBuilder'),
  ExecutionBlueprint,
  PlanningConfiguration: require('./PlanningConfiguration'),
  PlanningDiagnostics: require('./PlanningDiagnostics'),
  PlanningLogger: require('./PlanningLogger'),
  TaskPlanningStage: require('./TaskPlanningStage'),
  ...require('./PlanningErrors')
};
