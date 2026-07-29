'use strict';

const BaseReasoner = require('./BaseReasoner');

const DIMENSIONS = Object.freeze({
  intent: 'Intent Understanding',
  context: 'Context Reasoning',
  personalMemory: 'Personal Memory Reasoning',
  preference: 'User Preference Learning',
  temporal: 'Temporal Reasoning',
  causal: 'Causal Reasoning',
  planning: 'Goal Planning and Execution Reasoning',
  commonSense: 'Common Sense Reasoning',
  emotional: 'Emotional Reasoning',
  conversation: 'Conversation Reasoning',
  knowledge: 'Knowledge Reasoning',
  uncertainty: 'Uncertainty Reasoning',
  decision: 'Decision Reasoning',
  privacy: 'Privacy Reasoning',
  learning: 'Learning Reasoning',
  spatial: 'Spatial Reasoning',
  identity: 'Identity Reasoning',
  multiAgent: 'Multi-Agent Reasoning',
  safety: 'Safety Reasoning',
  selfReflection: 'Self-Reflection Reasoning'
});

const DIMENSION_ORDER = Object.freeze(Object.keys(DIMENSIONS));

const RULES = Object.freeze([
  { id: 'intent', evidence: 'goal-language', pattern: /\b(?:want|need|can you|could you|please|help|i am|i'm|i feel|feeling|make|prepare|do)\b/, confidence: 0.68 },
  { id: 'context', evidence: 'context-dependent-language', pattern: /\b(?:this|that|it|them|there|here|current|same|again|now)\b/, confidence: 0.66 },
  { id: 'personalMemory', evidence: 'personal-reference', pattern: /\b(?:my|mine|usual|normally|favorite|favourite|routine|again|same)\b/, confidence: 0.66 },
  { id: 'preference', evidence: 'preference-language', pattern: /\b(?:i like|i prefer|favorite|favourite|always|usually|normally|every day|daily|habit|routine)\b/, confidence: 0.7 },
  { id: 'temporal', evidence: 'time-language', pattern: /\b(?:today|tomorrow|yesterday|tonight|morning|evening|night|early|late|later|soon|after|before|in \d+|at \d+|am|pm|daily|every)\b/, confidence: 0.72 },
  { id: 'causal', evidence: 'cause-effect-language', pattern: /\b(?:because|why|reason|problem|issue|not working|failed|slow|lag|uncomfortable|too hot|too cold|too loud|too bright)\b/, confidence: 0.68 },
  { id: 'planning', evidence: 'multi-step-language', pattern: /\b(?:prepare|plan|planning|routine|first|then|after that|and then|before|schedule|organize|setup|set up)\b/, confidence: 0.7 },
  { id: 'commonSense', evidence: 'human-situation-language', pattern: /\b(?:leaving home|going out|sleep|tired|tried|tierd|hungry|thirsty|cold|hot|sick|unwell|exam|meeting|work|study|morning routine|night routine)\b/, confidence: 0.62 },
  { id: 'emotional', evidence: 'emotion-language', pattern: /\b(?:sad|happy|angry|tired|tried|tierd|stressed|stressd|worried|failed|excited|upset|lonely|afraid|anxious|anxous|confused|feeling|fealing)\b/, confidence: 0.72 },
  { id: 'conversation', evidence: 'dialogue-reference', pattern: /\b(?:it|that|them|those|same|again|yes|no|actually|instead|book it|close it|cancel it)\b/, confidence: 0.72 },
  { id: 'knowledge', evidence: 'knowledge-request', pattern: /\b(?:what|who|where|when|why|how|find|search|photos?|pictures?|trip|information|explain|tell me)\b/, confidence: 0.66 },
  { id: 'uncertainty', evidence: 'ambiguous-language', pattern: /\b(?:something|anything|somewhere|someone|some one|early|later|soon|maybe|probably|my meeting|the file|the app|it|that|them)\b/, confidence: 0.64 },
  { id: 'decision', evidence: 'choice-language', pattern: /\b(?:should i|which|best|better|choose|buy|compare|recommend|worth it|option)\b/, confidence: 0.7 },
  { id: 'privacy', evidence: 'sensitive-data-language', pattern: /\b(?:password|pin|otp|private|secret|personal|photo|photos|message|chat|account|delete history|clear history|location)\b/, confidence: 0.72 },
  { id: 'learning', evidence: 'learnable-preference-language', pattern: /\b(?:i like|i prefer|remember that|always|usually|daily|every day|routine|habit|from now)\b/, confidence: 0.68 },
  { id: 'spatial', evidence: 'place-language', pattern: /\b(?:home|office|room|kitchen|bedroom|desk|near|nearby|around me|outside|inside|folder|directory|location)\b/, confidence: 0.66 },
  { id: 'identity', evidence: 'person-reference', pattern: /\b(?:mom|mummy|mother|dad|daddy|father|friend|brother|sister|wife|husband|call|message|send|person|people)\b/, confidence: 0.68 },
  { id: 'multiAgent', evidence: 'workflow-coordination-language', pattern: /\b(?:coordinate|plan my trip|prepare my routine|send.*remind|calendar.*message|message.*calendar|book.*remind)\b/, confidence: 0.62 },
  { id: 'safety', evidence: 'risky-action-language', pattern: /\b(?:delete all|remove all|erase all|format|shutdown|restart|sign out|send.*password|share.*private|close all)\b/, confidence: 0.78 },
  { id: 'selfReflection', evidence: 'requires-self-check', pattern: /\b(?:are you sure|correctly|confirm|verify|can you do this|is this safe|should i)\b/, confidence: 0.66 }
]);

const ENTITY_DIMENSIONS = Object.freeze({
  dates: ['temporal'],
  times: ['temporal'],
  durations: ['temporal'],
  reminders: ['temporal', 'planning'],
  alarms: ['temporal', 'planning'],
  timers: ['temporal', 'planning'],
  contacts: ['identity', 'conversation', 'privacy'],
  people: ['identity', 'knowledge', 'privacy'],
  locations: ['spatial', 'context'],
  devices: ['context', 'spatial'],
  files: ['knowledge', 'privacy'],
  folders: ['spatial', 'knowledge'],
  paths: ['spatial', 'privacy'],
  media: ['preference', 'knowledge'],
  applications: ['context'],
  websites: ['knowledge']
});

const HIDDEN_INTENT_RULES = Object.freeze([
  {
    id: 'wellbeing.rest',
    pattern: /\b(?:i am|i'm|im|i feel|feeling|fealing)\s+(?:tired|tried|tierd|sleepy|exhausted|drained|stressed|stressd|anxious|anxous|worried|overwhelmed|sad|upset)\b/,
    confidence: 0.72,
    alternatives: ['rest support', 'schedule adjustment', 'light workload', 'supportive response']
  },
  {
    id: 'environment.comfort',
    pattern: /\b(?:i\s+am|i'm|im|i\s+feel|feeling|fealing|feel)\s+(?:cold|chilly|freezing|hot|overheated|uncomfortable|thirsty|thursty|hungry|hungery)\b|\b(?:room|place|desk|environment|it)\s+(?:feels|is)\s+(?:uncomfortable|hot|cold|dark|bright|loud|noisy)\b|\btoo\s+(?:hot|cold|dark|bright|loud|noisy)\b/,
    confidence: 0.7,
    alternatives: ['adjust environment', 'diagnose comfort issue', 'ask for affected device']
  },
  {
    id: 'routine.execution',
    pattern: /\b(?:morning|night|study|work|sleep)\s+routine\b|\bprepare my\b/,
    confidence: 0.7,
    alternatives: ['decompose routine', 'schedule tasks', 'use learned preferences']
  },
  {
    id: 'decision.support',
    pattern: /\b(?:should i|which one|best|better|recommend|worth it|compare)\b/,
    confidence: 0.72,
    alternatives: ['compare trade-offs', 'ask constraints', 'rank options']
  },
  {
    id: 'identity.communication',
    pattern: /\b(?:tell|ask|message|send|call)\s+(?:mom|mummy|dad|daddy|friend|brother|sister|[a-z][a-z0-9._-]{2,})\b/,
    confidence: 0.72,
    alternatives: ['resolve person', 'choose channel', 'confirm message content']
  }
]);

const PRIVACY_ACTIONS = new Set(['TRANSFER_FILE', 'DELETE_FILE', 'MOVE_FILE', 'SEND_MESSAGE']);
const SAFETY_ACTIONS = new Set(['DELETE_FILE', 'DELETE_FOLDER', 'SYSTEM_SHUTDOWN', 'SYSTEM_RESTART', 'FORMAT_DRIVE']);

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function scoreLabel(score) {
  if (score >= 0.75) return 'high';
  if (score >= 0.45) return 'medium';
  return score > 0 ? 'low' : 'none';
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

class CognitiveReasoner extends BaseReasoner {
  reason(context) {
    const dimensions = new Map();
    const addDimension = (id, confidence, evidence, metadata = {}) => {
      if (!DIMENSIONS[id]) return null;
      const existing = dimensions.get(id) || {
        id,
        name: DIMENSIONS[id],
        confidence: 0,
        evidence: [],
        metadata: {}
      };
      existing.confidence = Math.max(existing.confidence, clamp(confidence));
      existing.evidence = unique([...existing.evidence, evidence]);
      existing.metadata = { ...existing.metadata, ...(metadata || {}) };
      dimensions.set(id, existing);
      context.addEvidence(`reasoning.${id}`, evidence, confidence, this.id);
      return existing;
    };

    this._addPatternDimensions(context, addDimension);
    this._addEntityDimensions(context, addDimension);
    this._addContextDimensions(context, addDimension);

    const hiddenIntents = this._hiddenIntents(context);
    for (const intent of hiddenIntents) {
      context.addEvidence('reasoning.hidden-intent', intent.id, intent.confidence, this.id);
      this._addInference(context, intent.id);
      if (intent.id.startsWith('wellbeing.')) addDimension('emotional', intent.confidence, 'hidden-wellbeing-intent');
      if (intent.id.startsWith('environment.')) addDimension('causal', intent.confidence, 'hidden-environment-intent');
      if (intent.id.startsWith('routine.')) addDimension('planning', intent.confidence, 'hidden-routine-intent');
      if (intent.id.startsWith('decision.')) addDimension('decision', intent.confidence, 'hidden-decision-intent');
      if (intent.id.startsWith('identity.')) addDimension('identity', intent.confidence, 'hidden-identity-intent');
    }

    const rankedDimensions = this._rankDimensions(dimensions);
    const uncertainty = this._uncertainty(context, rankedDimensions);
    const safety = this._safety(context, rankedDimensions);
    const privacy = this._privacy(context, rankedDimensions);
    const learning = this._learning(context, rankedDimensions);
    const selfReflection = this._selfReflection(context, uncertainty, safety, privacy);

    if (uncertainty.score > 0) {
      context.addEvidence('reasoning.uncertainty-score', uncertainty.level, uncertainty.score, this.id);
      this._addInference(context, 'uncertainty-detected');
    }
    if (safety.score > 0) {
      context.addEvidence('reasoning.safety-score', safety.level, safety.score, this.id);
      this._addInference(context, 'safety-risk');
    }
    if (privacy.score > 0) {
      context.addEvidence('reasoning.privacy-score', privacy.level, privacy.score, this.id);
      this._addInference(context, 'privacy-sensitive');
    }
    if (learning.shouldLearn) {
      context.addEvidence('reasoning.learning-signal', learning.reason, learning.score, this.id);
      this._addInference(context, 'learning-opportunity');
    }
    if (uncertainty.requiresClarification) {
      context.addMissing({
        field: uncertainty.field,
        confidence: uncertainty.score,
        source: this.id
      });
      context.addClarification({
        requirement: 'resolve-uncertainty',
        field: uncertainty.field,
        confidence: uncertainty.score,
        source: this.id,
        reason: uncertainty.reason
      });
    }

    const summary = {
      version: '1.0.0',
      strategy: 'deterministic-cognitive-signal-layer',
      dimensions: rankedDimensions,
      hiddenIntents,
      uncertainty,
      safety,
      privacy,
      learning,
      selfReflection
    };
    context.futureExtensions.cognitiveReasoning = summary;
    context.diagnostics.cognitiveReasoning = {
      dimensions: rankedDimensions.length,
      hiddenIntents: hiddenIntents.length,
      uncertainty: uncertainty.level,
      safety: safety.level,
      privacy: privacy.level,
      shouldLearn: learning.shouldLearn
    };
    return context;
  }

  _addPatternDimensions(context, addDimension) {
    for (const rule of RULES) {
      if (!rule.pattern.test(context.normalizedInput)) continue;
      addDimension(rule.id, rule.confidence, rule.evidence);
    }
  }

  _addEntityDimensions(context, addDimension) {
    for (const [collection, dimensionIds] of Object.entries(ENTITY_DIMENSIONS)) {
      const count = Number(context.entitySummary?.[collection] || 0);
      if (count <= 0) continue;
      const confidence = Math.min(0.82, 0.6 + (count * 0.04));
      for (const id of dimensionIds) {
        addDimension(id, confidence, `entity:${collection}`, { [`${collection}Count`]: count });
      }
    }
  }

  _addContextDimensions(context, addDimension) {
    const resolved = context.resolvedContext || {};
    if (resolved.hasContext?.() || Object.keys(resolved.workingMemory || {}).length > 0 || Object.keys(resolved.conversationMemory || {}).length > 0) {
      addDimension('context', 0.74, 'resolved-context-present');
      addDimension('conversation', 0.7, 'conversation-memory-present');
    }
    if (resolved.user?.hasProfile || Object.keys(resolved.user?.preferences || {}).length > 0) {
      addDimension('personalMemory', 0.72, 'user-profile-present');
      addDimension('preference', 0.72, 'user-preferences-present');
    }
    if (resolved.time?.currentDate || resolved.time?.localTime || resolved.calendar?.events?.length) {
      addDimension('temporal', 0.7, 'time-or-calendar-context-present');
    }
    if (resolved.application?.focusedApplication || resolved.browserState?.currentBrowser || resolved.media?.active) {
      addDimension('context', 0.72, 'active-surface-present');
    }
    if (resolved.runningApplications?.length || resolved.devices?.length || resolved.system?.platform) {
      addDimension('context', 0.66, 'device-state-present');
    }
  }

  _hiddenIntents(context) {
    const intents = [];
    for (const rule of HIDDEN_INTENT_RULES) {
      if (!rule.pattern.test(context.normalizedInput)) continue;
      intents.push({
        id: rule.id,
        confidence: rule.confidence,
        alternatives: rule.alternatives.slice()
      });
    }
    return intents;
  }

  _rankDimensions(dimensions) {
    return DIMENSION_ORDER
      .map(id => dimensions.get(id))
      .filter(Boolean)
      .map(item => ({
        id: item.id,
        name: item.name,
        confidence: Number(item.confidence.toFixed(3)),
        evidence: item.evidence.slice(0, 8),
        metadata: { ...item.metadata }
      }))
      .sort((left, right) => right.confidence - left.confidence || DIMENSION_ORDER.indexOf(left.id) - DIMENSION_ORDER.indexOf(right.id));
  }

  _uncertainty(context, dimensions) {
    const text = context.normalizedInput;
    const hasReferences = Boolean(
      context.resolvedContext?.resolvedReferences?.length ||
      context.resolvedContext?.resolvedPronouns?.length ||
      context.resolvedContext?.getRecentReference?.()
    );
    const hasActionableEntity = Boolean(
      context.entitySummary.applications ||
      context.entitySummary.files ||
      context.entitySummary.folders ||
      context.entitySummary.contacts ||
      context.entitySummary.people ||
      context.entitySummary.media ||
      context.entitySummary.times ||
      context.entitySummary.durations
    );
    const vagueReference = /\b(?:it|that|them|this|same)\b/.test(text) && !hasReferences && !hasActionableEntity;
    const vagueTime = /\b(?:early|later|soon|sometime|when i can)\b/.test(text) && !(context.entitySummary.times || context.entitySummary.durations || context.entitySummary.dates);
    const vagueTarget = /\b(?:something|anything|someone|some one|somewhere|my meeting|the file|the app)\b/.test(text) && !hasActionableEntity;
    const needsClarification = vagueReference || vagueTime || vagueTarget;
    const dimensionScore = dimensions.find(item => item.id === 'uncertainty')?.confidence || 0;
    const score = needsClarification ? Math.max(0.72, dimensionScore) : dimensionScore;
    const reason = vagueReference
      ? 'reference target is missing'
      : vagueTime
        ? 'time expression is relative to an unknown preference'
        : vagueTarget
          ? 'target is underspecified'
          : score > 0 ? 'uncertainty language detected' : '';
    return {
      score: Number(score.toFixed(3)),
      level: scoreLabel(score),
      requiresClarification: needsClarification,
      field: vagueTime ? 'timeExpression' : 'target',
      reason
    };
  }

  _safety(context, dimensions) {
    const text = context.normalizedInput;
    const destructive = /\b(?:delete all|remove all|erase all|format|wipe|empty recycle bin|shutdown|restart|sign out|close all)\b/.test(text);
    const irreversible = /\b(?:permanent|forever|without backup|force)\b/.test(text);
    const score = Math.max(
      dimensions.find(item => item.id === 'safety')?.confidence || 0,
      destructive ? 0.84 : 0,
      irreversible ? 0.78 : 0
    );
    return {
      score: Number(score.toFixed(3)),
      level: scoreLabel(score),
      requiresConfirmation: score >= 0.7,
      reason: destructive ? 'destructive or broad command detected' : irreversible ? 'irreversible language detected' : score > 0 ? 'safety-sensitive language detected' : ''
    };
  }

  _privacy(context, dimensions) {
    const text = context.normalizedInput;
    const secret = /\b(?:password|pin|otp|secret|token|private key)\b/.test(text);
    const personal = /\b(?:private|personal|photos?|messages?|chat|account|location|address)\b/.test(text);
    const score = Math.max(
      dimensions.find(item => item.id === 'privacy')?.confidence || 0,
      secret ? 0.9 : 0,
      personal ? 0.72 : 0
    );
    return {
      score: Number(score.toFixed(3)),
      level: scoreLabel(score),
      sensitive: score >= 0.6,
      requiresCare: score >= 0.6,
      reason: secret ? 'secret credential language detected' : personal ? 'personal data language detected' : score > 0 ? 'privacy-sensitive language detected' : ''
    };
  }

  _learning(context, dimensions) {
    const text = context.normalizedInput;
    const explicitPreference = /\b(?:i like|i prefer|my favorite|my favourite|remember that|from now)\b/.test(text);
    const habit = /\b(?:always|usually|daily|every day|routine|habit)\b/.test(text);
    const score = Math.max(
      dimensions.find(item => item.id === 'learning')?.confidence || 0,
      explicitPreference ? 0.74 : 0,
      habit ? 0.7 : 0
    );
    return {
      score: Number(score.toFixed(3)),
      level: scoreLabel(score),
      shouldLearn: score >= 0.68,
      reason: explicitPreference ? 'explicit preference statement' : habit ? 'habit or routine statement' : score > 0 ? 'learnable signal detected' : '',
      memoryType: explicitPreference ? 'preference' : habit ? 'routine' : null
    };
  }

  _selfReflection(context, uncertainty, safety, privacy) {
    const shouldReview = uncertainty.score >= 0.65 || safety.score >= 0.7 || privacy.score >= 0.7;
    return {
      required: shouldReview,
      checks: unique([
        uncertainty.score >= 0.65 ? 'clarify ambiguity before acting' : '',
        safety.score >= 0.7 ? 'require confirmation for risky action' : '',
        privacy.score >= 0.7 ? 'avoid exposing sensitive data' : ''
      ]),
      confidenceAdjustment: Number((-(uncertainty.score * 0.04) - (safety.score * 0.03) - (privacy.score * 0.02)).toFixed(3))
    };
  }

  _addInference(context, inference) {
    if (!inference || context.inferences.some(item => item.inference === inference && item.source === this.id)) return;
    context.inferences.push({
      inference,
      confidence: 0.68,
      source: this.id
    });
  }

  static riskForAction(action, cognitive) {
    const risk = {};
    const safety = cognitive?.safety || {};
    const privacy = cognitive?.privacy || {};
    const uncertainty = cognitive?.uncertainty || {};
    if (safety.requiresConfirmation && SAFETY_ACTIONS.has(action)) {
      risk.risk = 'high';
      risk.dangerous = true;
      risk.requiresConfirmation = true;
      risk.confirmationReason = safety.reason || 'safety-sensitive action requires confirmation';
    }
    if (privacy.sensitive && PRIVACY_ACTIONS.has(action)) {
      risk.privacySensitive = true;
      if (action === 'TRANSFER_FILE' || action === 'SEND_MESSAGE') {
        risk.requiresConfirmation = true;
        risk.confirmationReason = privacy.reason || 'privacy-sensitive action requires confirmation';
      }
    }
    if (uncertainty.requiresClarification) {
      risk.uncertain = true;
      risk.uncertaintyReason = uncertainty.reason;
    }
    return risk;
  }
}

module.exports = CognitiveReasoner;
