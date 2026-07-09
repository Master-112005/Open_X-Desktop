'use strict';

const BaseNormalizer = require('./BaseNormalizer');

class TimeNormalizer extends BaseNormalizer {
  normalize(context) {
    const text = String(context.workingText || '');
    const expressions = [];
    const timePattern = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi;
    let match;
    while ((match = timePattern.exec(text)) !== null) {
      let hour = Number(match[1]);
      const minute = Number(match[2] || 0);
      const meridiem = match[3].toLowerCase();
      if (meridiem === 'pm' && hour < 12) hour += 12;
      if (meridiem === 'am' && hour === 12) hour = 0;
      expressions.push({ original: match[0], canonical: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` });
    }
    if (/\bnoon\b/i.test(text)) expressions.push({ original: 'noon', canonical: '12:00' });
    if (/\bmidnight\b/i.test(text)) expressions.push({ original: 'midnight', canonical: '00:00' });
    const halfPast = /\bhalf\s+past\s+(\d{1,2})\b/gi;
    while ((match = halfPast.exec(text)) !== null) {
      expressions.push({ original: match[0], canonical: `${String(Number(match[1])).padStart(2, '0')}:30` });
    }
    expressions.forEach(expression => context.addObservation('times', expression));
    return context.setText(text, this.id, { expressions });
  }
}

module.exports = TimeNormalizer;
