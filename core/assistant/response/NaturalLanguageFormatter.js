'use strict';

const BaseResponseGenerator = require('./BaseResponseGenerator');

class NaturalLanguageFormatter extends BaseResponseGenerator {
  generate(context) {
    context.futureExtensions.naturalLanguage = context.baseText().replace(/\s+/g, ' ').trim();
    context.diagnostics.formatter(this.id);
    return context;
  }
}

module.exports = NaturalLanguageFormatter;
