'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class DateExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'date', /\b(today|tomorrow|tonight|next week|next month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, { confidence: 0.82 });
    this.addRegexMatches(context, 'date', /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi, { confidence: 0.78 });
    return context;
  }
}

module.exports = DateExtractor;
