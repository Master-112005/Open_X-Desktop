'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

const SCHEDULE_FRAGMENT = /\b(?:today|tomorrow|tonight|next\s+week|next\s+month|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:morning|afternoon|evening|night)|\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?|\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|this|next)\s+(?:month|year)?|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}(?:(?::|\s+)\d{2})?\s*(?:am|pm)|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:am|pm)|(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty(?:\s*five)?|sixty)\s*(?:seconds?|secs?|minutes?|mins?|minits?|hours?|hrs?))\b/gi;

class ReminderExtractor extends BaseEntityExtractor {
  extract(context) {
    const text = this.text(context);
    const match = text.match(/\b(?:remind|reminder|notify|alert)\b(?:.+?\b(?:to|say|about|that)\s+(.+))?/i);
    if (!match) return context;
    const recurrence = text.match(/\bevery\s+((?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekday|weekend|day|morning|evening|night|hour|week|month)(?:\s*(?:,|and)?\s*)?)+)\b/i);
    const candidate = match[1] || text
      .replace(/^.*?\b(?:remind|reminder|notify|alert)(?:\s+me)?\b/i, '');
    const value = String(candidate || '')
      .replace(/\bevery\s+((?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekday|weekend|day|morning|evening|night|hour|week|month)(?:\s*(?:,|and)?\s*)?)+)\b/gi, ' ')
      .replace(SCHEDULE_FRAGMENT, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^(?:at|on|in|after|for|by|to|that|about|say)\b\s*/i, '')
      .replace(/\s+(?:at|on|in|after|for|by|to|that|about|say)\s*$/i, '')
      .replace(/[.?!]+$/g, '')
      .trim();
    if (value) {
      this.addEntity(context, 'reminder', value, {
        confidence: match[1] ? 0.8 : 0.72,
        metadata: recurrence?.[1] ? { recurrence: recurrence[1].replace(/\s+/g, ' ').trim() } : {}
      });
    }
    return context;
  }
}

module.exports = ReminderExtractor;
