'use strict';

const BaseResponseGenerator = require('./BaseResponseGenerator');

class ChatFormatter extends BaseResponseGenerator {
  generate(context) {
    const text = context.futureExtensions.responseText ||
      context.futureExtensions.naturalLanguage ||
      context.baseText() ||
      'I do not have a response for that yet.';
    context.formattedChatResponse = this.cleanForChannel(text, {
      channel: 'chat',
      maxLength: context.configuration?.maxChatLength || 2400
    });
    context.diagnostics.formatter(this.id);
    return context;
  }
}

module.exports = ChatFormatter;
