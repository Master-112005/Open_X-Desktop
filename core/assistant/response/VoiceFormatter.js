'use strict';

const BaseResponseGenerator = require('./BaseResponseGenerator');

class VoiceFormatter extends BaseResponseGenerator {
  generate(context) {
    const text = context.futureExtensions.naturalLanguage || context.baseText();
    context.formattedVoiceResponse = text
      .replace(/\bStatus:\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    context.diagnostics.formatter(this.id);
    return context;
  }
}

module.exports = VoiceFormatter;
