'use strict';

const BaseResponseGenerator = require('./BaseResponseGenerator');

class ChatFormatter extends BaseResponseGenerator {
  generate(context) {
    const text = context.futureExtensions.naturalLanguage || context.baseText() || 'I do not have a response for that yet.';
    context.formattedChatResponse = this.text(text, context.configuration?.maxChatLength || 2400);
    context.diagnostics.formatter(this.id);
    return context;
  }
}

module.exports = ChatFormatter;
