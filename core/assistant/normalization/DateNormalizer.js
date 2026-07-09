'use strict';

const BaseNormalizer = require('./BaseNormalizer');

const MONTHS = Object.freeze({
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12'
});

class DateNormalizer extends BaseNormalizer {
  normalize(context) {
    const text = String(context.workingText || '');
    const lower = text.toLowerCase();
    const expressions = [];
    ['today', 'tomorrow', 'yesterday', 'this weekend', 'next week', 'next month'].forEach(expression => {
      if (lower.includes(expression)) expressions.push({ original: expression, type: 'relative' });
    });
    const weekdayMatches = lower.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g) || [];
    weekdayMatches.forEach(original => expressions.push({ original, type: 'weekday' }));
    const monthPattern = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi;
    let match;
    while ((match = monthPattern.exec(text)) !== null) {
      expressions.push({ original: match[0], type: 'calendar', day: Number(match[1]), month: MONTHS[match[2].toLowerCase()] });
    }
    const thisMonthPattern = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(?:this|next)\s+month\b/gi;
    while ((match = thisMonthPattern.exec(text)) !== null) {
      expressions.push({ original: match[0], type: 'relative-month-day', day: Number(match[1]) });
    }
    expressions.forEach(expression => context.addObservation('dates', expression));
    return context.setText(text, this.id, { expressions });
  }
}

module.exports = DateNormalizer;
