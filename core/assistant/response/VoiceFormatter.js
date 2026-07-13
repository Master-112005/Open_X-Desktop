'use strict';

const BaseResponseGenerator = require('./BaseResponseGenerator');

class VoiceFormatter extends BaseResponseGenerator {
  generate(context) {
    const text = context.futureExtensions.naturalLanguage || context.baseText();
    context.formattedVoiceResponse = text
      .replace(/\bStatus:\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    context.formattedVoiceResponse = this.text(
      context.formattedVoiceResponse || 'I do not have a spoken response for that yet.',
      context.configuration?.maxVoiceLength || 900
    );
    context.diagnostics.formatter(this.id);
    return context;
  }
}

module.exports = VoiceFormatter;
