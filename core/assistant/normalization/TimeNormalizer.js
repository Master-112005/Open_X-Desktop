'use strict';

const BaseNormalizer = require('./BaseNormalizer');

class TimeNormalizer extends BaseNormalizer {
  normalize(context) {
    const text = String(context.workingText || '');
    const expressions = [];
    const timePattern = /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)\b/gi;
    let match;
    while ((match = timePattern.exec(text)) !== null) {
      let hour = Number(match[1]);
      const minute = Number(match[2] || 0);
      const meridiem = match[3].toLowerCase().replace(/[^apm]/g, '');
      if (meridiem === 'pm' && hour < 12) hour += 12;
      if (meridiem === 'am' && hour === 12) hour = 0;
      expressions.push({ original: match[0], canonical: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` });
    }
    if (/\bnoon\b/i.test(text)) expressions.push({ original: 'noon', canonical: '12:00' });
    if (/\bmidnight\b/i.test(text)) expressions.push({ original: 'midnight', canonical: '00:00' });
    if (/\bmorning\b/i.test(text)) expressions.push({ original: 'morning', canonical: '09:00', approximate: true });
    if (/\bafternoon\b/i.test(text)) expressions.push({ original: 'afternoon', canonical: '14:00', approximate: true });
    if (/\bevening\b/i.test(text)) expressions.push({ original: 'evening', canonical: '18:00', approximate: true });
    if (/\btonight\b/i.test(text)) expressions.push({ original: 'tonight', canonical: '20:00', approximate: true });
    const halfPast = /\bhalf\s+past\s+(\d{1,2})\b/gi;
    while ((match = halfPast.exec(text)) !== null) {
      expressions.push({ original: match[0], canonical: `${String(Number(match[1])).padStart(2, '0')}:30` });
    }
    const oClock = /\b(\d{1,2})\s+o'?clock\b/gi;
    while ((match = oClock.exec(text)) !== null) {
      expressions.push({ original: match[0], canonical: `${String(Number(match[1])).padStart(2, '0')}:00`, approximate: true });
    }
    const quarterPast = /\bquarter\s+past\s+(\d{1,2})\b/gi;
    while ((match = quarterPast.exec(text)) !== null) {
      expressions.push({ original: match[0], canonical: `${String(Number(match[1])).padStart(2, '0')}:15` });
    }
    const quarterTo = /\bquarter\s+to\s+(\d{1,2})\b/gi;
    while ((match = quarterTo.exec(text)) !== null) {
      const hour = Number(match[1]) - 1 || 12;
      expressions.push({ original: match[0], canonical: `${String(hour).padStart(2, '0')}:45` });
    }
    expressions.forEach(expression => context.addObservation('times', expression));
    return context.setText(text, this.id, { expressionsCount: expressions.length });
  }
}

module.exports = TimeNormalizer;
