'use strict';

const BaseResponseGenerator = require('./BaseResponseGenerator');

class NaturalLanguageFormatter extends BaseResponseGenerator {
  generate(context) {
    const text = context.baseText().replace(/\s+/g, ' ').trim();
    context.futureExtensions.naturalLanguage = this.text(text || 'I do not have a response for that yet.', 2400);
    context.diagnostics.formatter(this.id);
    return context;
  }
}

module.exports = NaturalLanguageFormatter;
