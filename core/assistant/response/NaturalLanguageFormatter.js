'use strict';

const BaseResponseGenerator = require('./BaseResponseGenerator');

class NaturalLanguageFormatter extends BaseResponseGenerator {
  generate(context) {
    const text = context.futureExtensions.responseText || context.baseText();
    context.futureExtensions.naturalLanguage = this.cleanForChannel(text || 'I do not have a response for that yet.', {
      channel: 'chat',
      maxLength: 2400
    });
    context.diagnostics.formatter(this.id);
    return context;
  }
}

module.exports = NaturalLanguageFormatter;
