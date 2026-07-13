'use strict';

const BaseResponseGenerator = require('./BaseResponseGenerator');

class NotificationFormatter extends BaseResponseGenerator {
  generate(context) {
    const text = context.futureExtensions.naturalLanguage || context.baseText();
    const limit = Number(context.configuration?.maxNotificationLength || 120);
    context.formattedNotification = this.text(text, limit);
    context.diagnostics.formatter(this.id);
    return context;
  }
}

module.exports = NotificationFormatter;
