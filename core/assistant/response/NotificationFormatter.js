'use strict';

const BaseResponseGenerator = require('./BaseResponseGenerator');

class NotificationFormatter extends BaseResponseGenerator {
  generate(context) {
    const text = context.futureExtensions.naturalLanguage || context.baseText();
    context.formattedNotification = text.length > 90 ? `${text.slice(0, 87).trim()}...` : text;
    context.diagnostics.formatter(this.id);
    return context;
  }
}

module.exports = NotificationFormatter;
