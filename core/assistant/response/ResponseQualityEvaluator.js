'use strict';

const BaseResponseGenerator = require('./BaseResponseGenerator');
const ResponseStyleManager = require('./ResponseStyleManager');

const SENSITIVE_VALUE_PATTERN = /\b(password|passcode|pin|otp|token|secret|private key|api key|credential)\b\s*(?:is|=|:)\s*([^\s,.!?;]+)/gi;
const UNCERTAINTY_PATTERN = /\b(?:not fully certain|not fully sure|i think|may be|might be|please confirm)\b/i;

function resultData(context) {
  const result = context.verificationResult || {};
  return {
    ...(result.entities || {}),
    ...(result.data || {}),
    ...(result.metadata || {}),
    ...(result.futureExtensions || {})
  };
}

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function gate(name, passed, reason = '') {
  return { name, passed: Boolean(passed), reason: String(reason || '') };
}

function safeText(text) {
  return compact(text).replace(SENSITIVE_VALUE_PATTERN, (_, label) => `${label} is [redacted]`);
}

class ResponseQualityEvaluator extends BaseResponseGenerator {
  supports(context) {
    return super.supports(context) && context.configuration?.responseQuality !== false;
  }

  generate(context) {
    const before = context.currentText?.() ||
      context.futureExtensions.responseText ||
      context.futureExtensions.naturalLanguage ||
      context.baseText();
    const policy = context.futureExtensions.responsePolicy || ResponseStyleManager.buildPolicy({
      baseText: before,
      result: context.verificationResult || {},
      metadata: context.metadata || {},
      source: context.metadata?.source || context.verificationResult?.source || ''
    });
    const refined = this.refineText(before, context, policy);
    const quality = this.evaluate(refined, context, policy);

    context.futureExtensions.responseQuality = quality;
    context.diagnostics.quality?.(quality);

    if (refined && refined !== before) {
      context.setResponseText?.(refined);
    }

    const failedGates = quality.gates.filter(item => !item.passed);
    failedGates.forEach(item => {
      context.diagnostics.warn('Response quality gate needs attention.', {
        gate: item.name,
        reason: item.reason,
        responseType: context.responseType
      });
    });

    const recovery = policy.recovery?.suggestion;
    if (recovery && !context.suggestions.some(item => item.text === recovery)) {
      context.addSuggestion('recovery', recovery);
    }

    return context;
  }

  refineText(text, context, policy) {
    const result = context.verificationResult || {};
    let value = safeText(text);

    if (!value) {
      value = 'I do not have a clear response for that yet.';
    }

    if (/^completed\s+0,\s*failed\s+0,\s*skipped\s+0\.?$/i.test(value) || /^unknown\.?$/i.test(value)) {
      value = result.success === false
        ? 'I could not complete that request.'
        : 'Done.';
    }

    if (policy.responseKind === 'confirmation' && !/\b(?:yes|no|confirm|continue|cancel)\b/i.test(value)) {
      value = `${this.ensureSentence(value)} Say yes to continue or no to cancel.`;
    }

    if (policy.responseKind === 'error' && policy.recovery?.suggestion && !/\b(?:retry|try|check|provide|open|connect)\b/i.test(value)) {
      value = `${this.ensureSentence(value)} ${policy.recovery.suggestion}`;
    }

    if (policy.confidence?.label === 'low' && !UNCERTAINTY_PATTERN.test(value)) {
      value = `${this.ensureSentence(value)} I am not fully certain, so please confirm if that is not what you meant.`;
    }

    return this.ensureSentence(value, context.configuration?.maxChatLength || 2400);
  }

  evaluate(text, context, policy) {
    const value = compact(text);
    const result = context.verificationResult || {};
    const data = resultData(context);
    const lowConfidence = policy.confidence?.label === 'low';
    const privacySensitive = policy.privacy?.sensitive === true;
    const riskyConfirmation = policy.responseKind === 'confirmation' || result.requiresConfirmation;
    const needsClarification = policy.responseKind === 'clarification' || result.needsClarification;
    const failed = !needsClarification && !riskyConfirmation && (
      policy.responseKind === 'error' ||
      result.success === false ||
      (Array.isArray(result.failedActions) && result.failedActions.length > 0)
    );

    const gates = [
      gate('clarity', value.length > 0 && !/^status:\s*(unknown|completed)/i.test(value), 'Response should not expose raw status text.'),
      gate('specificity', !/^(?:done|ok|completed)\.?$/i.test(value) || Boolean(data.action || data.intent || result.intent), 'Short acknowledgements need action context when available.'),
      gate('clarification', !needsClarification || /\?|\b(?:what|which|when|who|where|how)\b/i.test(value), 'Clarifications should ask a concrete question.'),
      gate('confirmation', !riskyConfirmation || /\b(?:yes|no|confirm|continue|cancel)\b/i.test(value), 'Confirmations should make the user decision explicit.'),
      gate('recovery', !failed || /\b(?:could not|unable|failed|retry|try|check|provide|connect)\b/i.test(value), 'Failures should explain the problem or next step.'),
      gate('uncertainty', !lowConfidence || UNCERTAINTY_PATTERN.test(value), 'Low-confidence responses should expose uncertainty.'),
      gate('privacy', !privacySensitive || !SENSITIVE_VALUE_PATTERN.test(value), 'Sensitive values must not be exposed.'),
      gate('length', value.length <= Number(context.configuration?.maxChatLength || 2400), 'Response should fit the configured chat channel.')
    ];

    const passed = gates.filter(item => item.passed).length;
    const gateSummary = gates.reduce((summary, item) => {
      summary[item.name] = item.passed;
      return summary;
    }, {});
    return {
      version: '1.0.0',
      dimensions: ResponseStyleManager.dimensions(),
      score: Math.round((passed / gates.length) * 100) / 100,
      passed: passed === gates.length,
      gates,
      gateSummary,
      responseKind: policy.responseKind || context.responseType,
      detailMode: policy.detailMode || 'adaptive'
    };
  }
}

module.exports = ResponseQualityEvaluator;
