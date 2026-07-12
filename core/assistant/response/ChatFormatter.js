'use strict';

const BaseResponseGenerator = require('./BaseResponseGenerator');

class ChatFormatter extends BaseResponseGenerator {
  generate(context) {
    context.formattedChatResponse = context.futureExtensions.naturalLanguage || context.baseText();
    context.diagnostics.formatter(this.id);
    return context;
  }
}

module.exports = ChatFormatter;
