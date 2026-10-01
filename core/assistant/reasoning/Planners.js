'use strict';

const { deepFreeze } = require('../shared/UtilsCore');

class BasePlanner {
  constructor(options = {}) {
    this.id = String(options.id || this.constructor.name);
    this.name = String(options.name || this.id);
    this.priority = Number.isFinite(options.priority) ? Number(options.priority) : 100;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.options = { ...(options || {}) };
    this.initialized = false;
  }

  initialize() {
    this.initialized = true;
    return true;
  }

  supports(context) {
    return this.enabled && !!context;
  }

  plan(context) {
    return context;
  }

  taskId(value) {
    return String(value || 'task')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '') || 'task';
  }

  tasks(context) {
    return Array.isArray(context?.tasks) ? context.tasks : [];
  }

  taskEntities(task = {}, context = null) {
    return {
      ...(context?.reasoningResult?.metadata?.entities || {}),
      ...(context?.metadata?.entities || {}),
      ...(task.metadata?.entities || {})
    };
  }

  actionTarget(task = {}, context = null) {
    const entities = this.taskEntities(task, context);
    return String(
      entities.appName ||
      entities.filename ||
      entities.folderName ||
      entities.contactName ||
      entities.query ||
      entities.path ||
      task.metadata?.target ||
      ''
    ).trim().toLowerCase();
  }

  cleanup() {
    return true;
  }

  destroy() {
    this.initialized = false;
    return true;
  }
}

const ACTION_LABELS = Object.freeze({
  OPEN_APPLICATION: 'open application',
  CLOSE_APPLICATION: 'close application',
  SEARCH_WEB: 'search web',
  PLAY_MEDIA: 'play media',
  PAUSE_MEDIA: 'pause media',
  RESUME_MEDIA: 'resume media',
  STOP_MEDIA: 'stop media',
  SET_VOLUME: 'set volume',
  MUTE_AUDIO: 'mute audio',
  OPEN_FOLDER: 'open folder',
  OPEN_FILE: 'open file',
  CREATE_FILE: 'create file',
  DELETE_FILE: 'delete file',
  MOVE_FILE: 'move file',
  CREATE_REMINDER: 'create reminder'
});

class TaskPlanner extends BasePlanner {
  plan(context) {
    const reasoning = context.reasoningResult || {};
    const inheritedEntities = {
      ...(reasoning.metadata?.entities || {}),
      ...(context.metadata?.entities || {})
    };
    const sourceTasks = Array.isArray(reasoning.candidateTasks) && reasoning.candidateTasks.length > 0
      ? reasoning.candidateTasks
      : [];

    for (const candidate of sourceTasks) {
      context.addTask({
        id: this.taskId(candidate.task),
        label: candidate.task,
        action: candidate.action || null,
        intent: candidate.intent || reasoning.resolvedIntent?.intent || null,
        optional: candidate.optional === true,
        repeatable: candidate.repeatable === true,
        retryable: candidate.retryable !== false,
        cancelable: candidate.cancelable !== false,
        metadata: {
          ...(candidate.metadata || {}),
          confidence: candidate.confidence,
          source: candidate.source,
          entities: { ...inheritedEntities, ...(candidate.metadata?.entities || {}) }
        }
      });
    }

    for (const action of reasoning.candidateActions || []) {
      context.addTask({
        id: this.taskId(action.taskId || action.action),
        label: action.label || ACTION_LABELS[action.action] || String(action.action || '').replace(/_/g, ' ').toLowerCase(),
        action: action.action,
        intent: reasoning.resolvedIntent?.intent || null,
        optional: action.optional === true,
        repeatable: action.repeatable === true,
        retryable: action.retryable !== false,
        cancelable: action.cancelable !== false,
        metadata: {
          ...(action.metadata || {}),
          confidence: action.confidence,
          source: action.source,
          evidence: Array.isArray(action.evidence) ? action.evidence.slice() : [],
          automationAction: action.automationAction || action.metadata?.automationAction,
          entities: { ...inheritedEntities, ...(action.metadata?.entities || {}) }
        },
        dependsOn: action.dependsOn || action.metadata?.dependsOn || []
      });
    }

    if (context.tasks.length === 0 && reasoning.resolvedAction?.action) {
      const action = reasoning.resolvedAction;
      context.addTask({
        id: this.taskId(action.action),
        label: action.label || ACTION_LABELS[action.action] || action.action.replace(/_/g, ' ').toLowerCase(),
        action: action.action,
        intent: reasoning.resolvedIntent?.intent || null,
        metadata: {
          ...(action.metadata || {}),
          confidence: action.confidence,
          source: action.source,
          entities: { ...inheritedEntities, ...(action.metadata?.entities || {}) }
        }
      });
    }

    if (Array.isArray(reasoning.clarificationRequirements) && reasoning.clarificationRequirements.length > 0) {
      context.metadata.clarificationRequirements = reasoning.clarificationRequirements.slice();
    }

    context.diagnostics.taskCount = context.tasks.length;
    return context;
  }
}

const WORKFLOW_BY_GOAL = Object.freeze({
  'media.playback': 'media',
  'send.document': 'email',
  productivity: 'productivity',
  'application.control': 'application',
  'web.search': 'browser',
  'file.management': 'file',
  'reminder.management': 'reminder',
  'audio.adjustment': 'media'
});

class WorkflowPlanner extends BasePlanner {
  plan(context) {
    const goalId = context.reasoningResult?.resolvedGoal?.id || '';
    const type = WORKFLOW_BY_GOAL[goalId] || this._inferWorkflowType(context);
    context.workflow = {
      id: `workflow.${type}`,
      type,
      goal: goalId || null,
      tasks: context.tasks.map(task => task.id),
      workflows: [],
      actionCounts: context.actionCounts()
    };
    context.diagnostics.workflowCount = context.workflow.id ? 1 : 0;
    return context;
  }

  _inferWorkflowType(context) {
    const actions = new Set(context.tasks.map(task => task.action).filter(Boolean));
    if ([...actions].some(action => action.includes('REMINDER') || action.includes('ALARM') || action.includes('TIMER'))) return 'schedule';
    if ([...actions].some(action => action.includes('FILE') || action.includes('FOLDER'))) return 'file';
    if ([...actions].some(action => action.includes('APPLICATION'))) return 'application';
    if ([...actions].some(action => action.includes('MEDIA') || action.includes('VOLUME') || action.includes('AUDIO'))) return 'media';
    if ([...actions].some(action => action.includes('WEB') || action.includes('BROWSER'))) return 'browser';
    if ([...actions].some(action => action.includes('SYSTEM') || action.includes('SHUTDOWN') || action.includes('RESTART'))) return 'system';
    return 'general';
  }
}

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

class ParallelPlanner extends BasePlanner {
  plan(context) {
    if (context.configuration?.parallelPlanning === false) return context;
    const independent = context.tasks.filter(task =>
      !context.dependencies.some(dependency => dependency.to === task.id || dependency.from === task.id)
    );
    const parallelTasks = independent.filter(task => context.configuration?.parallelActions?.has?.(task.action));
    const groupedByAction = new Map();
    for (const task of parallelTasks) {
      if (!groupedByAction.has(task.action)) groupedByAction.set(task.action, []);
      groupedByAction.get(task.action).push(task);
    }
    for (const [action, tasks] of groupedByAction.entries()) {
      if (tasks.length <= 1) continue;
      context.parallelGroups.push({
        id: action === 'OPEN_APPLICATION'
          ? 'parallel.openApplications'
          : `parallel.${String(action || 'tasks').toLowerCase().replace(/[^a-z0-9]+/g, '.')}`,
        tasks: tasks.map(task => task.id),
        reason: `independent ${action.toLowerCase().replace(/_/g, ' ')} tasks`
      });
    }
    context.diagnostics.parallelGroups = context.parallelGroups.length;
    return context;
  }
}

class RecoveryPlanner extends BasePlanner {
  plan(context) {
    if (context.configuration?.recoveryPlanning === false) return context;
    for (const task of context.tasks) {
      const highRisk = task.metadata?.risk === 'high' || task.metadata?.requiresConfirmation === true;
      const mutation = /^(?:DELETE|MOVE|SEND|SYSTEM|FORMAT)/.test(String(task.action || ''));
      context.recoveryPlan.push({
        taskId: task.id,
        strategies: task.optional
          ? ['skip-optional-task']
          : highRisk || mutation
            ? ['abort-workflow']
            : ['retry-once', 'abort-workflow'],
        retryLimit: task.retryable === false || highRisk || mutation ? 0 : 1,
        cancelable: task.cancelable !== false,
        metadataOnly: true
      });
    }
    context.diagnostics.recoveryPlans = context.recoveryPlan.length;
    return context;
  }
}

class PlannerOptimizer extends BasePlanner {
  plan(context) {
    const before = context.tasks.length;
    const seen = new Set();
    context.tasks = context.tasks.filter(task => {
      if (seen.has(task.id)) {
        context.diagnostics.warn('Removed duplicate task id during optimization.', { taskId: task.id });
        return false;
      }
      seen.add(task.id);
      return true;
    });
    context.removeInvalidReferences();
    context.dependencies = context.dependencies.filter((dependency, index, all) =>
      all.findIndex(item => item.from === dependency.from && item.to === dependency.to && item.type === dependency.type) === index
    );
    context.workflow.tasks = context.workflow.tasks.filter(taskId => seen.has(taskId));
    context.workflow.actionCounts = context.actionCounts();
    context.dependencies = context.dependencies.filter(dependency => seen.has(dependency.from) && seen.has(dependency.to));
    const removed = before - context.tasks.length;
    const result = {
      optimization: 'dedupe-tasks',
      removedTasks: removed,
      strategy: context.configuration?.optimizationLevel || 'safe'
    };
    context.optimizations.push(result);
    context.diagnostics.optimizationResults.push(result);
    return context;
  }
}

class ExecutionPlanner extends BasePlanner {
  plan(context) {
    const remaining = new Map(context.tasks.map(task => [task.id, task]));
    const ordered = [];
    while (remaining.size > 0) {
      const next = [...remaining.values()].find(task =>
        context.dependencies
          .filter(dependency => dependency.to === task.id)
          .every(dependency => ordered.includes(dependency.from))
      );
      if (!next) {
        const fallback = remaining.values().next().value;
        context.diagnostics.warn('Dependency cycle or unresolved dependency detected during ordering; using deterministic fallback.', {
          remainingTaskIds: [...remaining.keys()]
        });
        ordered.push(fallback.id);
        remaining.delete(fallback.id);
        continue;
      }
      ordered.push(next.id);
      remaining.delete(next.id);
    }
    context.ordering = ordered.map((taskId, index) => ({
      taskId,
      index,
      mode: context.parallelGroups.some(group => group.tasks.includes(taskId)) ? 'parallel' : 'sequential',
      conditional: false,
      optional: context.tasks.find(task => task.id === taskId)?.optional === true,
      repeatable: context.tasks.find(task => task.id === taskId)?.repeatable === true,
      retryable: context.tasks.find(task => task.id === taskId)?.retryable !== false,
      cancelable: context.tasks.find(task => task.id === taskId)?.cancelable !== false
    }));
    context.conditions = context.tasks.flatMap(task => task.conditions.map(condition => ({ taskId: task.id, condition })));
    context.optionalTasks = context.tasks.filter(task => task.optional).map(task => task.id);
    context.estimatedComplexity = context.tasks.length > 5 ? 'high' : context.tasks.length > 2 ? 'medium' : 'low';
    context.estimatedDuration = context.tasks.reduce((total, task) =>
      total + context.configuration.durationForAction(task.action), 0);
    context.diagnostics.executionOrderCount = context.ordering.length;
    return context;
  }
}

class TaskGraphBuilder extends BasePlanner {
  plan(context) {
    context.taskGraph = deepFreeze({
      nodes: context.tasks.map(task => ({
        id: task.id,
        label: task.label,
        action: task.action,
        optional: task.optional,
        retryable: task.retryable,
        cancelable: task.cancelable,
        confidence: Number(task.metadata?.confidence) || null,
        target: this.actionTarget(task, context)
      })),
      edges: context.dependencies.map(dependency => ({
        from: dependency.from,
        to: dependency.to,
        type: dependency.type
      })),
      parallelGroups: context.parallelGroups.slice(),
      recoveryNodes: context.recoveryPlan.map(plan => ({ taskId: plan.taskId, strategies: plan.strategies.slice() }))
    });
    return context;
  }
}

class ExecutionGraphBuilder extends BasePlanner {
  plan(context) {
    context.executionGraph = deepFreeze({
      nodes: context.ordering.map(order => ({
        id: order.taskId,
        index: order.index,
        mode: order.mode,
        optional: order.optional,
        retryable: order.retryable,
        cancelable: order.cancelable,
        action: context.tasks.find(task => task.id === order.taskId)?.action || null
      })),
      edges: [
        ...context.dependencies.map(dependency => ({
          from: dependency.from,
          to: dependency.to,
          type: dependency.type || 'requires'
        })),
        ...context.ordering.slice(1).map((order, index) => ({
          from: context.ordering[index].taskId,
          to: order.taskId,
          type: order.mode === 'parallel' ? 'parallel-branch' : 'next'
        }))
      ].filter((edge, index, all) =>
        all.findIndex(item => item.from === edge.from && item.to === edge.to && item.type === edge.type) === index
      ),
      conditionalBranches: context.conditions.slice(),
      recoveryPaths: context.recoveryPlan.slice(),
      retryPaths: context.recoveryPlan
        .filter(plan => plan.strategies.includes('retry-once'))
        .map(plan => ({ taskId: plan.taskId, strategy: 'retry-once' })),
      cancellationPoints: context.tasks.filter(task => task.cancelable).map(task => task.id)
    });
    return context;
  }
}

module.exports = {
  BasePlanner,
  TaskPlanner,
  WorkflowPlanner,
  DependencyPlanner,
  ParallelPlanner,
  RecoveryPlanner,
  PlannerOptimizer,
  ExecutionPlanner,
  TaskGraphBuilder,
  ExecutionGraphBuilder
};