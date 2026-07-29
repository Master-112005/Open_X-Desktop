'use strict';

const BaseReasoner = require('./BaseReasoner');
const CognitiveReasoner = require('./CognitiveReasoner');

const ACTION_PROFILES = Object.freeze({
  OPEN_APPLICATION: {
    family: 'application',
    entities: ['applications', 'websites', 'browsers'],
    contexts: ['context.application', 'context.reference'],
    targetWords: /\b(?:app|application|program|chrome|youtube|settings|gallery|calendar|reminders?|powerpoint|ppt)\b/
  },
  CLOSE_APPLICATION: {
    family: 'application',
    entities: ['applications', 'browsers', 'windows'],
    contexts: ['context.application', 'context.reference', 'context.recent-action'],
    targetWords: /\b(?:app|application|program|window|chrome|youtube|powerpoint|ppt|it|that|them)\b/
  },
  SEARCH_WEB: {
    family: 'knowledge',
    entities: ['websites'],
    contexts: ['context.browser'],
    targetWords: /\b(?:what|who|where|why|how|search|google|web|website|internet|information)\b/
  },
  PLAY_MEDIA: {
    family: 'media',
    entities: ['media', 'websites', 'volumeLevels'],
    contexts: ['context.application', 'context.browser', 'context.recent-action'],
    targetWords: /\b(?:play|song|music|video|youtube|spotify|track|playlist|watch)\b/
  },
  PAUSE_MEDIA: {
    family: 'media',
    entities: ['media'],
    contexts: ['context.application', 'context.recent-action'],
    targetWords: /\b(?:pause|hold|stop)\b/
  },
  RESUME_MEDIA: {
    family: 'media',
    entities: ['media'],
    contexts: ['context.application', 'context.recent-action'],
    targetWords: /\b(?:resume|continue|play)\b/
  },
  SET_VOLUME: {
    family: 'audio',
    entities: ['volumeLevels'],
    contexts: ['context.recent-action'],
    targetWords: /\b(?:volume|vol|sound|audio|loud|quiet|mute)\b/
  },
  MUTE_AUDIO: {
    family: 'audio',
    entities: ['volumeLevels'],
    contexts: ['context.recent-action'],
    targetWords: /\b(?:mute|sound|audio)\b/
  },
  SET_BRIGHTNESS: {
    family: 'display',
    entities: ['brightnessLevels'],
    contexts: ['context.application'],
    targetWords: /\b(?:brightness|screen|display|dim|bright)\b/
  },
  OPEN_FOLDER: {
    family: 'file',
    entities: ['folders', 'paths'],
    contexts: ['context.selection', 'context.reference'],
    targetWords: /\b(?:folder|directory|downloads|documents|desktop|pictures)\b/
  },
  OPEN_FILE: {
    family: 'file',
    entities: ['files', 'paths'],
    contexts: ['context.selection', 'context.reference'],
    targetWords: /\b(?:file|document|pdf|ppt|pptx|doc|docx|sheet|report)\b/
  },
  DELETE_FILE: {
    family: 'file',
    entities: ['files', 'paths'],
    contexts: ['context.selection', 'context.reference'],
    targetWords: /\b(?:delete|remove|erase|file|folder|it|that)\b/
  },
  MOVE_FILE: {
    family: 'file',
    entities: ['files', 'folders', 'paths'],
    contexts: ['context.selection', 'context.reference'],
    targetWords: /\b(?:move|copy|file|folder|to|into)\b/
  },
  TRANSFER_FILE: {
    family: 'transfer',
    entities: ['files', 'folders', 'paths', 'devices'],
    contexts: ['context.selection', 'context.reference'],
    targetWords: /\b(?:send|share|transfer|copy|phone|mobile|device)\b/
  },
  CREATE_REMINDER: {
    family: 'schedule',
    entities: ['reminders', 'times', 'dates', 'durations'],
    contexts: ['context.recent-action'],
    targetWords: /\b(?:remind|reminder|notify|alert|daily|every|tomorrow|today)\b/
  },
  SET_ALARM: {
    family: 'schedule',
    entities: ['alarms', 'times', 'dates'],
    contexts: ['context.recent-action'],
    targetWords: /\b(?:alarm|wake|am|pm|daily|every)\b/
  },
  SET_TIMER: {
    family: 'schedule',
    entities: ['timers', 'durations'],
    contexts: ['context.recent-action'],
    targetWords: /\b(?:timer|countdown|minute|minutes|second|seconds|hour|hours|pomodoro)\b/
  }
});

const ACTION_GOALS = Object.freeze({
  OPEN_APPLICATION: 'application.control',
  CLOSE_APPLICATION: 'application.control',
  SEARCH_WEB: 'web.search',
  PLAY_MEDIA: 'media.playback',
  PAUSE_MEDIA: 'media.playback',
  RESUME_MEDIA: 'media.playback',
  SET_VOLUME: 'audio.adjustment',
  MUTE_AUDIO: 'audio.adjustment',
  SET_BRIGHTNESS: 'display.adjustment',
  OPEN_FOLDER: 'file.management',
  OPEN_FILE: 'file.management',
  DELETE_FILE: 'file.management',
  MOVE_FILE: 'file.management',
  TRANSFER_FILE: 'device.transfer',
  CREATE_REMINDER: 'reminder.management',
  SET_ALARM: 'alarm.management',
  SET_TIMER: 'timer.management'
});

const INCOMPATIBLE_ACTIONS = Object.freeze([
  ['OPEN_APPLICATION', 'CLOSE_APPLICATION'],
  ['SEARCH_WEB', 'OPEN_FILE'],
  ['SEARCH_WEB', 'OPEN_FOLDER'],
  ['SET_TIMER', 'SET_ALARM'],
  ['SET_VOLUME', 'MUTE_AUDIO']
]);

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function rounded(value) {
  return Number(clamp(value).toFixed(3));
}

class DeliberationReasoner extends BaseReasoner {
  reason(context) {
    const before = context.ranked('candidateActions').map(item => ({
      action: item.action,
      confidence: rounded(item.confidence || 0)
    }));
    const steps = this._decompose(context);
    const evaluations = [];

    for (const action of context.candidateActions) {
      const evaluation = this._evaluateAction(context, action, steps);
      action.confidence = rounded((action.confidence || 0) + evaluation.delta);
      action.evidence = Array.from(new Set([...(action.evidence || []), 'deliberation']));
      action.metadata = {
        ...(action.metadata || {}),
        deliberation: {
          scoreDelta: rounded(evaluation.delta),
          strengths: evaluation.strengths,
          penalties: evaluation.penalties
        },
        ...CognitiveReasoner.riskForAction(action.action, context.futureExtensions.cognitiveReasoning)
      };
      context.addEvidence('deliberation.action', action.action, action.confidence, this.id);
      evaluations.push({
        action: action.action,
        confidence: action.confidence,
        strengths: evaluation.strengths,
        penalties: evaluation.penalties
      });
    }

    this._rebalanceGoals(context);
    this._surfaceCloseAmbiguity(context);

    const after = context.ranked('candidateActions').map(item => ({
      action: item.action,
      confidence: rounded(item.confidence || 0)
    }));
    context.futureExtensions.deliberation = {
      strategy: 'deterministic-reason-act-entity-context-rerank',
      decomposition: steps,
      before,
      after,
      evaluations
    };
    context.diagnostics.deliberation = {
      actionEvaluations: evaluations.length,
      stepCount: steps.length
    };
    return context;
  }

  _decompose(context) {
    const text = this.text(context);
    if (!text) return [];
    const segments = text
      .split(/\b(?:then|and then|after that|also|plus)\b|[.;]/i)
      .map(segment => segment.trim())
      .filter(Boolean)
      .slice(0, 6);

    if (segments.length <= 1) {
      return [{
        index: 1,
        text,
        kind: this._stepKind(text),
        source: 'single-step'
      }];
    }

    return segments.map((segment, index) => ({
      index: index + 1,
      text: segment,
      kind: this._stepKind(segment),
      source: 'connector-decomposition'
    }));
  }

  _stepKind(text) {
    if (/\b(?:after|in)\s+\d+\s+(?:second|seconds|minute|minutes|hour|hours)\b/.test(text)) return 'deferred';
    if (/\b(?:open|close|play|pause|resume|set|send|find|search|remind|alarm|timer)\b/.test(text)) return 'action';
    if (/^(?:what|who|where|when|why|how)\b/.test(text)) return 'question';
    return 'context';
  }

  _evaluateAction(context, action, steps) {
    const profile = ACTION_PROFILES[action.action] || {};
    const strengths = [];
    const penalties = [];
    const signalBoost = Math.max(0, Math.min(0.25, Number(context.configuration?.deliberationBoost ?? 0.08)));
    const penaltyScale = Math.max(0, Math.min(0.25, Number(context.configuration?.ambiguityPenalty ?? 0.08)));
    const entityStepBoost = Math.min(0.06, signalBoost * 0.56);
    const contextStepBoost = Math.min(0.05, signalBoost * 0.56);
    const languageBoost = Math.min(0.04, signalBoost * 0.44);
    const goalBoost = Math.min(0.04, signalBoost * 0.44);
    const deferredBoost = Math.min(0.04, signalBoost * 0.44);
    const maxPositiveDelta = Math.max(0.12, Math.min(0.25, signalBoost * 2.75));
    let delta = 0;

    const supportedEntities = (profile.entities || []).filter(collection => Number(context.entitySummary?.[collection] || 0) > 0);
    if (supportedEntities.length > 0) {
      const boost = Math.min(signalBoost + 0.06, supportedEntities.length * entityStepBoost);
      delta += boost;
      strengths.push(`entity:${supportedEntities.join(',')}`);
    }

    const supportingContexts = context.evidence
      .filter(item => (profile.contexts || []).includes(item.type))
      .map(item => item.type);
    if (supportingContexts.length > 0) {
      delta += contextStepBoost;
      strengths.push(`context:${Array.from(new Set(supportingContexts)).join(',')}`);
    }

    if (profile.targetWords?.test?.(context.normalizedInput)) {
      delta += languageBoost;
      strengths.push('target-language');
    }

    if (this._goalSupportsAction(context, action.action)) {
      delta += goalBoost;
      strengths.push('goal-consistent');
    }

    const cognitiveBoost = this._cognitiveSupportForAction(context, action.action, signalBoost);
    if (cognitiveBoost > 0) {
      delta += cognitiveBoost;
      strengths.push('cognitive-consistent');
    }

    if (steps.some(step => step.kind === 'deferred') && ['CREATE_REMINDER', 'SET_ALARM', 'SET_TIMER'].includes(action.action)) {
      delta += deferredBoost;
      strengths.push('deferred-step');
    }

    const penalty = this._ambiguityPenalty(context, action.action) * (penaltyScale > 0 ? penaltyScale / 0.08 : 0);
    if (penalty > 0) {
      delta -= penalty;
      penalties.push(`ambiguity:${penalty.toFixed(2)}`);
    }

    return {
      delta: Math.max(-0.18, Math.min(maxPositiveDelta, delta)),
      strengths,
      penalties
    };
  }

  _goalSupportsAction(context, action) {
    const goalId = ACTION_GOALS[action];
    if (!goalId) return false;
    return context.candidateGoals.some(goal => goal.id === goalId);
  }

  _cognitiveSupportForAction(context, action, signalBoost) {
    const dimensions = new Set((context.futureExtensions.cognitiveReasoning?.dimensions || []).map(item => item.id));
    const hasAny = (...ids) => ids.some(id => dimensions.has(id));
    const boost = Math.min(0.035, signalBoost * 0.4);
    if (['CREATE_REMINDER', 'SET_ALARM', 'SET_TIMER'].includes(action) && hasAny('temporal', 'planning')) return boost;
    if (['OPEN_APPLICATION', 'CLOSE_APPLICATION', 'PAUSE_MEDIA', 'RESUME_MEDIA'].includes(action) && hasAny('context', 'conversation')) return boost;
    if (action === 'PLAY_MEDIA' && hasAny('preference', 'knowledge', 'personalMemory')) return boost;
    if (['OPEN_FILE', 'OPEN_FOLDER', 'MOVE_FILE', 'DELETE_FILE'].includes(action) && hasAny('knowledge', 'spatial', 'privacy')) return boost;
    if (action === 'TRANSFER_FILE' && hasAny('identity', 'privacy', 'spatial')) return boost;
    if (action === 'SEARCH_WEB' && hasAny('knowledge', 'decision', 'causal')) return boost;
    if (['SET_VOLUME', 'MUTE_AUDIO', 'SET_BRIGHTNESS'].includes(action) && hasAny('causal', 'commonSense', 'context')) return boost;
    return 0;
  }

  _ambiguityPenalty(context, action) {
    const text = context.normalizedInput;
    if (action === 'SEARCH_WEB' && /\b(?:file|folder|directory|local|desktop|downloads|documents|pictures|reminders?|alarms?|timers?)\b/.test(text)) {
      return 0.09;
    }
    if (action === 'OPEN_APPLICATION' && /^(?:what|who|where|when|why|how)\b/.test(text)) {
      return 0.08;
    }
    if (action === 'SET_TIMER' && /\b(?:am|pm|alarm|wake)\b/.test(text) && !/\b(?:timer|countdown)\b/.test(text)) {
      return 0.1;
    }
    if (action === 'SET_ALARM' && /\b(?:for|in)\s+\d+\s+(?:second|seconds|minute|minutes|hour|hours)\b/.test(text) && /\b(?:timer|countdown)\b/.test(text)) {
      return 0.08;
    }
    if (action === 'DELETE_FILE' && !/\b(?:delete|remove|erase)\b/.test(text)) {
      return 0.08;
    }
    return 0;
  }

  _rebalanceGoals(context) {
    const topAction = context.ranked('candidateActions')[0];
    if (!topAction) return;
    const supportingGoal = ACTION_GOALS[topAction.action];
    if (!supportingGoal) return;

    for (const goal of context.candidateGoals) {
      if (goal.id !== supportingGoal) continue;
      goal.confidence = rounded((goal.confidence || 0) + 0.04);
      goal.evidence = Array.from(new Set([...(goal.evidence || []), 'top-action-support']));
      goal.metadata = { ...(goal.metadata || {}), topAction: topAction.action };
    }
  }

  _surfaceCloseAmbiguity(context) {
    const ranked = context.ranked('candidateActions');
    if (ranked.length < 2) return;
    const [first, second] = ranked;
    const margin = Math.abs((first.confidence || 0) - (second.confidence || 0));
    const incompatible = INCOMPATIBLE_ACTIONS.some(pair => pair.includes(first.action) && pair.includes(second.action));
    if (!incompatible || margin > 0.035) return;
    context.addClarification({
      requirement: 'action-choice',
      field: 'action',
      confidence: rounded(0.62 + (0.035 - margin)),
      source: this.id,
      options: [first.action, second.action],
      reason: 'top actions are too close after deliberation'
    });
  }
}

module.exports = DeliberationReasoner;
