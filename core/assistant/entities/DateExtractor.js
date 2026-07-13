'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class DateExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'date', /\b(today|tomorrow|tonight|next week|next month|(?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/gi, { confidence: 0.82 });
    this.addRegexMatches(context, 'date', /\b(?:every|on)\s+((?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s*(?:,|and)?\s*)?)+)\b/gi, { confidence: 0.76, metadata: { recurring: true } });
    this.addRegexMatches(context, 'date', /\b(weekdays?|weekends?|daily|weekly|monthly)\b/gi, { confidence: 0.72, metadata: { recurring: true } });
    this.addRegexMatches(context, 'date', /\b(?:this|next)\s+month\s+\d{1,2}(?:st|nd|rd|th)?\b/gi, { confidence: 0.8 });
    this.addRegexMatches(context, 'date', /\b\d{1,2}(?:st|nd|rd|th)?(?:\s+(?:of\s+)?(?:this|next)\s+month|\s+(?:this|next)\s+month)\b/gi, { confidence: 0.8 });
    this.addRegexMatches(context, 'date', /\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/gi, { confidence: 0.78 });
    this.addRegexMatches(context, 'date', /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+(?:\d{2,4}|(?:of\s+)?(?:this|next)\s+year))?\b/gi, { confidence: 0.78 });
    this.addRegexMatches(context, 'date', /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:,?\s+(?:\d{2,4}|(?:of\s+)?(?:this|next)\s+year))?\b/gi, { confidence: 0.78 });
    return context;
  }
}

module.exports = DateExtractor;
