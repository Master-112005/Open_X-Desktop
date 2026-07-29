'use strict';

const BaseResponseGenerator = require('./BaseResponseGenerator');

const RESPONSE_DIMENSIONS = Object.freeze([
  'directAnswer',
  'contextAware',
  'personalized',
  'conversational',
  'clarification',
  'confirmation',
  'proactive',
  'suggestion',
  'explanation',
  'stepByStep',
  'emotional',
  'shortMode',
  'detailedMode',
  'memoryBased',
  'adaptiveLength',
  'multiModal',
  'actionExplanation',
  'errorHandling',
  'safety',
  'confidence',
  'followUp',
  'personality',
  'privacyAware',
  'learning',
  'humanInitiative'
]);

const SENSITIVE_WORD_PATTERN = /\b(?:password|passcode|pin|otp|token|secret|private\s+key|api\s+key|credential)\b/i;
const UNCERTAIN_WORD_PATTERN = /\b(?:not fully sure|not fully certain|not certain|i think|need confirmation)\b/i;

const FIELD_QUESTIONS = Object.freeze({
  reminderText: 'What should I remind you about?',
  message: 'What should I remind you about?',
  reminderMessage: 'What should I remind you about?',
  task: 'What should I remind you about?',
  title: 'What should I call it?',
  time: 'When should I do that?',
  timeExpression: 'When should I do that?',
  dueAt: 'When should I do that?',
  date: 'Which date should I use?',
  duration: 'How long should the timer run?',
  appName: 'Which app should I use?',
  targetApp: 'Which app should I use?',
  filename: 'Which file should I use?',
  fileName: 'Which file should I use?',
  filePath: 'Which file should I use?',
  path: 'Which file or folder should I use?',
  folderName: 'Which folder should I use?',
  folderPath: 'Which folder should I use?',
  contactName: 'Who should I contact?',
  recipient: 'Who should I send it to?',
  messageText: 'What message should I send?',
  email: 'Which email address should I use?',
  phoneNumber: 'Which phone number should I use?',
  query: 'What should I search for?'
});

function cleanText(value, maxLength = 2200) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function stripTrailingPunctuation(value) {
  return String(value || '').replace(/[.!?]+$/g, '').trim();
}

function unique(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map(value => String(value || '').trim())
    .filter(Boolean)));
}

function naturalJoin(values) {
  const items = unique(values);
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function asNumber(value, fallback = null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function dataFrom(result = {}) {
  return {
    ...(result?.entities || {}),
    ...(result?.data || {}),
    ...(result?.metadata || {}),
    ...(result?.futureExtensions || {})
  };
}

function getDecision(result = {}) {
  return result?.metadata?.decision ||
    result?.futureExtensions?.decision ||
    result?.decision ||
    null;
}

function normalizeActionName(value) {
  const action = String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!action) return 'that action';
  return action
    .split(' ')
    .map(part => part.length <= 2 && /^[A-Z0-9]+$/.test(part)
      ? part
      : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function extractMissingFields(result = {}, text = '') {
  const decision = getDecision(result);
  const requirements = Array.isArray(decision?.clarificationRequirements)
    ? decision.clarificationRequirements
    : [];
  const fromDecision = requirements.map(item => item?.field || item?.requirement || item?.reason);
  const validationMissing = Array.isArray(result?.validation?.missing) ? result.validation.missing : [];
  const languageMissing = Array.isArray(result?.languageUnderstanding?.missingEntities)
    ? result.languageUnderstanding.missingEntities
    : [];
  const fromText = [];
  const match = String(text || '').match(/one more detail before i can continue:\s*([^.,]+)/i);
  if (match?.[1]) {
    fromText.push(...match[1].split(/\s*,\s*/));
  }
  return unique([...fromDecision, ...validationMissing, ...languageMissing, ...fromText])
    .map(field => field.replace(/^entities\./, '').trim());
}

function missingFieldQuestion(fields, intentId = '') {
  const normalized = unique(fields)
    .map(field => field.replace(/^entities\./, '').trim())
    .filter(Boolean);
  if (normalized.length === 0) return 'What detail should I use?';

  if (normalized.length === 1) {
    const field = normalized[0];
    if (FIELD_QUESTIONS[field]) return FIELD_QUESTIONS[field];
    const lowerIntent = String(intentId || '').toLowerCase();
    if (/reminder/.test(lowerIntent)) return 'What should I remind you about?';
    if (/alarm/.test(lowerIntent)) return 'What alarm time should I use?';
    if (/timer/.test(lowerIntent)) return 'How long should the timer run?';
    if (/message|chat/.test(lowerIntent)) return 'What message should I send?';
    if (/file/.test(lowerIntent)) return 'Which file should I use?';
    if (/folder/.test(lowerIntent)) return 'Which folder should I use?';
    return `What ${field} should I use?`;
  }

  const commonTime = normalized.some(field => /time|date|due|duration/i.test(field));
  const commonTarget = normalized.some(field => /app|file|folder|contact|recipient|target|query/i.test(field));
  if (commonTime && commonTarget) {
    return `I need the ${naturalJoin(normalized)} before I continue.`;
  }
  return `I need ${naturalJoin(normalized)} before I continue.`;
}

function confidenceValue(result = {}, fallback = 1) {
  const data = dataFrom(result);
  return Math.max(0, Math.min(1, asNumber(
    result.confidence ??
    result.intentConfidence ??
    data.confidence ??
    data.overallConfidence ??
    fallback,
    fallback
  )));
}

function classifyConfidence(confidence) {
  if (confidence >= 0.85) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}

function inferDetailMode({ text, result, source, responseStyle }) {
  const style = String(responseStyle || '').toLowerCase();
  if (['short', 'concise'].includes(style)) return 'short';
  if (['detailed', 'detail', 'verbose'].includes(style)) return 'detailed';
  if (String(source || '').toLowerCase() === 'voice') return 'short';
  if (result?.needsClarification || result?.requiresConfirmation) return 'short';
  if (String(result?.intent || '').startsWith('help') || /\b(?:explain|how|why|steps|setup)\b/i.test(text)) {
    return 'detailed';
  }
  return 'adaptive';
}

function inferTone(text = '') {
  const source = String(text || '').toLowerCase();
  if (/\b(?:sad|upset|lost|worried|scared|stressed|stressd|angry|depressed|tired|tried|tierd|sleepy|exhausted|hurt|cold|chilly|freezing|hot|sick|unwell|hungry|hungery|thirsty|thursty|anxious|anxous|overwhelmed|lonely|confused|confuzed|feeling|fealing)\b/.test(source)) {
    return 'supportive';
  }
  if (/\b(?:thanks|thank you|great|good|done|finished)\b/.test(source)) {
    return 'warm';
  }
  return 'professional';
}

function shouldExposeUncertainty(policy, text) {
  if (policy.responseKind === 'clarification') return false;
  if (policy.responseKind === 'confirmation') return false;
  if (policy.confidence.label !== 'low') return false;
  return !UNCERTAIN_WORD_PATTERN.test(text);
}

function appendSentence(text, sentence) {
  const base = cleanText(text);
  const addition = cleanText(sentence);
  if (!base) return addition;
  if (!addition) return base;
  if (base.toLowerCase().includes(addition.toLowerCase())) return base;
  return `${stripTrailingPunctuation(base)}. ${addition}`;
}

function directAnswerFrom(result = {}) {
  const data = dataFrom(result);
  const answer = data.answer || result.answer || null;
  if (answer?.text) return cleanText(answer.text);
  if (data.directAnswer) return cleanText(data.directAnswer);
  if (data.answerText) return cleanText(data.answerText);
  return '';
}

function recoverySuggestion(result = {}) {
  const failed = Array.isArray(result.failedActions) ? result.failedActions : [];
  const first = failed[0] || {};
  const reason = String(first.error || first.reason || result.error || '').toLowerCase();
  if (reason.includes('not found')) return 'Try a more specific name or location.';
  if (reason.includes('permission')) return 'Check the permission setting, then retry.';
  if (reason.includes('timeout')) return 'Retry once the app or server is responsive.';
  if (result.needsClarification) return 'Reply with the missing detail and I can continue.';
  return '';
}

function composeActionSummary(result = {}) {
  const successful = Array.isArray(result.successfulActions) ? result.successfulActions : [];
  if (successful.length === 0) return '';
  const names = successful
    .slice(0, 4)
    .map(item => item.label || item.message || item.action || item.route || item.intent || item.taskId)
    .filter(Boolean)
    .map(normalizeActionName);
  if (names.length === 0) {
    return `${successful.length} action${successful.length === 1 ? '' : 's'} completed.`;
  }
  const more = successful.length > names.length ? `, plus ${successful.length - names.length} more` : '';
  return `Completed ${naturalJoin(names)}${more}.`;
}

function composeFailure(result = {}, baseText = '') {
  const failed = Array.isArray(result.failedActions) ? result.failedActions : [];
  const first = failed[0] || {};
  const target = normalizeActionName(first.action || first.route || first.taskId || result.intent || 'that request');
  const reason = cleanText(first.error || first.reason || first.message || result.error || '');
  if (baseText && !/^failed:/i.test(baseText)) return baseText;
  return reason ? `I could not complete ${target} because ${reason}.` : `I could not complete ${target}.`;
}

class ResponseStyleManager extends BaseResponseGenerator {
  supports(context) {
    return super.supports(context) && context.configuration?.responsePolicy !== false;
  }

  generate(context) {
    const baseText = cleanText(context.futureExtensions.responseText || context.baseText());
    const policy = ResponseStyleManager.buildPolicy({
      baseText,
      result: context.verificationResult || {},
      metadata: context.metadata || {},
      source: context.metadata?.source || context.verificationResult?.source || '',
      responseStyle: context.metadata?.responseStyle || ''
    });
    const responseText = ResponseStyleManager.composeResponse(baseText, context.verificationResult || {}, policy);
    context.futureExtensions.responsePolicy = policy;
    if (responseText && responseText !== baseText) {
      context.futureExtensions.responseText = responseText;
    }
    context.diagnostics.policy?.(policy);
    return context;
  }

  static dimensions() {
    return RESPONSE_DIMENSIONS.slice();
  }

  static missingFieldQuestion(fields, intentId = '') {
    return missingFieldQuestion(fields, intentId);
  }

  static buildPolicy({ baseText = '', result = {}, metadata = {}, source = '', responseStyle = '' } = {}) {
    const text = cleanText(baseText);
    const input = metadata.input || result.input || result.originalInput || '';
    const missingFields = extractMissingFields(result, text);
    const failedActions = Array.isArray(result.failedActions) ? result.failedActions : [];
    const successfulActions = Array.isArray(result.successfulActions) ? result.successfulActions : [];
    const directAnswer = directAnswerFrom(result);
    const confidence = confidenceValue(result, directAnswer ? 0.9 : 1);
    const data = dataFrom(result);
    const decision = getDecision(result);
    const risk = String(data.risk || data.safetyRisk || decision?.risk || '').toLowerCase();
    const privacySensitive = Boolean(data.privacySensitive || data.requiresPrivacy || SENSITIVE_WORD_PATTERN.test(`${input} ${text}`));
    const safetySensitive = Boolean(result.requiresConfirmation || data.requiresConfirmation || ['high', 'critical'].includes(risk));

    let responseKind = 'summary';
    if (result.needsClarification || missingFields.length > 0 || /^i need clarification/i.test(text)) {
      responseKind = 'clarification';
    } else if (result.requiresConfirmation || decision?.requiresConfirmation || /^please confirm/i.test(text)) {
      responseKind = 'confirmation';
    } else if (failedActions.length > 0 || result.success === false || result.executionStatus === 'FAILED') {
      responseKind = 'error';
    } else if (directAnswer) {
      responseKind = 'directAnswer';
    } else if (successfulActions.length > 0 || result.success === true || result.executionStatus === 'COMPLETED') {
      responseKind = 'actionReport';
    }

    const policy = {
      version: '1.0.0',
      responseKind,
      dimensions: RESPONSE_DIMENSIONS.slice(),
      detailMode: inferDetailMode({ text: `${input} ${text}`, result, source, responseStyle }),
      tone: inferTone(`${input} ${text}`),
      confidence: {
        value: confidence,
        label: classifyConfidence(confidence),
        expose: confidence < 0.6
      },
      directAnswer: Boolean(directAnswer),
      contextAware: Boolean(result.context || metadata.context || result.resolvedContext),
      personalized: Boolean(data.preference || data.personalized || data.memory || data.userPreference),
      memoryBased: Boolean(data.memory || data.remembered || data.preference),
      clarification: responseKind === 'clarification' ? { missingFields } : null,
      confirmation: responseKind === 'confirmation' ? { risk: risk || 'medium' } : null,
      safety: {
        sensitive: safetySensitive,
        risk: risk || (safetySensitive ? 'medium' : 'low')
      },
      privacy: {
        sensitive: privacySensitive,
        boundary: privacySensitive ? 'Do not expose sensitive values in the response.' : ''
      },
      recovery: {
        suggestion: recoverySuggestion(result)
      },
      modality: {
        source: source || 'chat',
        voiceReady: true,
        notificationReady: true
      }
    };

    return policy;
  }

  static composeResponse(baseText = '', result = {}, policy = {}) {
    let text = cleanText(baseText);
    const direct = directAnswerFrom(result);

    if (policy.responseKind === 'directAnswer' && direct) {
      text = direct;
    } else if (policy.responseKind === 'clarification') {
      text = missingFieldQuestion(policy.clarification?.missingFields || [], result.intent);
    } else if (policy.responseKind === 'confirmation') {
      if (/^(?:status:\s*)?(?:pending|pending_confirmation|unknown)\b/i.test(text)) {
        text = 'Please confirm before I continue.';
      }
      if (!/\b(?:say yes|confirm|continue|cancel)\b/i.test(text)) {
        text = appendSentence(text || 'Please confirm before I continue.', 'Say yes to continue or no to cancel.');
      }
    } else if (policy.responseKind === 'error') {
      text = composeFailure(result, text);
      if (policy.recovery?.suggestion && !/would you like|try|retry|check/i.test(text)) {
        text = appendSentence(text, policy.recovery.suggestion);
      }
    } else if (policy.responseKind === 'actionReport') {
      const generic = /^(?:status:\s*)?(?:completed|unknown|failed|skipped|\d+\s+actions?\s+completed)/i.test(text);
      const actionSummary = composeActionSummary(result);
      if (generic && actionSummary) {
        text = actionSummary;
      }
    }

    if (policy.privacy?.sensitive && !/\b(?:sensitive|private|privacy|password|pin|otp)\b/i.test(text)) {
      text = appendSentence(text, 'I did not include sensitive details here.');
    }

    if (shouldExposeUncertainty(policy, text)) {
      text = appendSentence(text, 'I am not fully certain, so please confirm if that is not what you meant.');
    }

    if (policy.detailMode === 'short') {
      return cleanText(text, 320);
    }
    if (policy.detailMode === 'detailed') {
      return cleanText(text, 1600);
    }
    return cleanText(text);
  }

  static refineLegacyResponse(text, { result = {}, input = '', source = '', responseStyle = '' } = {}) {
    const baseText = cleanText(text);
    const policy = ResponseStyleManager.buildPolicy({
      baseText,
      result: { ...(result || {}), input: input || result?.input || '' },
      metadata: { input },
      source,
      responseStyle
    });
    const refined = ResponseStyleManager.composeResponse(baseText, result || {}, policy);
    return {
      text: refined || baseText,
      changed: Boolean(refined && refined !== baseText),
      policy,
      suggestions: policy.recovery?.suggestion ? [{ type: 'recovery', text: policy.recovery.suggestion }] : []
    };
  }
}

module.exports = ResponseStyleManager;
