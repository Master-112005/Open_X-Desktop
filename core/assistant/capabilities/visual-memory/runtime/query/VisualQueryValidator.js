'use strict';

function lowerValues(list) {
  return (list || []).map(item => String(item.value || '').toLowerCase());
}

class VisualQueryValidator {
  constructor(options = {}) {
    this.lowConfidenceThreshold = Number(options.lowConfidenceThreshold || 0.45);
  }

  validate({ parsed, constraints, confidence } = {}) {
    const warnings = [];
    const errors = [];
    const clarification = [];

    if (!parsed?.active) {
      return { valid: true, warnings, errors, needsClarification: false, clarification };
    }

    if (!constraints?.media?.length) {
      errors.push({ code: 'visual-query.missing-media', message: 'No visual media type was understood.' });
      clarification.push('Which kind of visual item should I understand: photo, screenshot, document, or album?');
    }

    if (confidence < this.lowConfidenceThreshold) {
      warnings.push({ code: 'visual-query.low-confidence', message: 'The visual request confidence is low.' });
      clarification.push('Can you describe the photo or screenshot a little more clearly?');
    }

    const times = lowerValues(constraints.time);
    if (times.includes('today') && times.includes('yesterday')) {
      errors.push({ code: 'visual-query.conflicting-time', message: 'The query contains conflicting relative dates.' });
      clarification.push('Do you mean today or yesterday?');
    }

    const personCounts = new Set(lowerValues(constraints.personCount));
    if (personCounts.has('1') && (personCounts.has('group') || personCounts.has('2') || personCounts.has('3'))) {
      errors.push({ code: 'visual-query.conflicting-person-count', message: 'The query asks for both one person and multiple people.' });
      clarification.push('Should I understand this as one person or a group?');
    }

    if (constraints.people.length === 0 && constraints.relationships.length === 0 && /\bwith\s+(?:him|her|them|that\s+person)\b/i.test(parsed.normalizedText || '')) {
      warnings.push({ code: 'visual-query.ambiguous-person', message: 'The person reference is ambiguous.' });
      clarification.push('Who is the person in the photo request?');
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors,
      needsClarification: errors.length > 0 || clarification.length > 0 && confidence < 0.7,
      clarification
    };
  }
}

module.exports = VisualQueryValidator;
