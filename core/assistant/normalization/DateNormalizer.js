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

const WEEKDAYS = Object.freeze([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
]);

class DateNormalizer extends BaseNormalizer {
  normalize(context) {
    const text = String(context.workingText || '');
    const lower = text.toLowerCase();
    const expressions = [];
    let match;
    ['today', 'tomorrow', 'yesterday', 'tonight', 'this weekend', 'next week', 'next month', 'every day', 'daily', 'weekly', 'every weekday', 'every weekend'].forEach(expression => {
      if (lower.includes(expression)) expressions.push({ original: expression, type: 'relative' });
    });
    const weekdayMatches = lower.match(/\b(?:next|this|every)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g) || [];
    weekdayMatches.forEach(original => expressions.push({ original, type: 'weekday' }));
    const compactWeekdayMatches = lower.match(/\b(?:mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?)\b/g) || [];
    compactWeekdayMatches.forEach(original => {
      const weekday = WEEKDAYS.find(day => original.startsWith(day.slice(0, -1)) || original.startsWith(day));
      expressions.push({ original, type: 'weekday', weekday });
    });
    const weekdayRange = lower.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+to\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    if (weekdayRange) {
      expressions.push({ original: weekdayRange[0], type: 'weekday-range', start: weekdayRange[1], end: weekdayRange[2] });
    }
    const weekdayListPattern = /\b(?:every\s+)?((?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s*(?:,|and|&)\s*|\s+)+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:(?:\s*(?:,|and|&)\s*|\s+)(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))*)\b/g;
    while ((match = weekdayListPattern.exec(lower)) !== null) {
      const weekdays = match[1].match(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/g) || [];
      if (weekdays.length > 1) expressions.push({ original: match[0], type: 'weekday-list', weekdays: [...new Set(weekdays)] });
    }
    const monthPattern = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi;
    while ((match = monthPattern.exec(text)) !== null) {
      expressions.push({ original: match[0], type: 'calendar', day: Number(match[1]), month: MONTHS[match[2].toLowerCase()] });
    }
    const thisMonthPattern = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(?:this|next)\s+month\b/gi;
    while ((match = thisMonthPattern.exec(text)) !== null) {
      expressions.push({ original: match[0], type: 'relative-month-day', day: Number(match[1]) });
    }
    expressions.forEach(expression => context.addObservation('dates', expression));
    return context.setText(text, this.id, { expressionsCount: expressions.length });
  }
}

module.exports = DateNormalizer;
