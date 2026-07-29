'use strict';

const BaseResponseGenerator = require('./BaseResponseGenerator');

class VoiceFormatter extends BaseResponseGenerator {
  generate(context) {
    const text = context.futureExtensions.responseText ||
      context.futureExtensions.naturalLanguage ||
      context.baseText();
    const channelText = this.cleanForChannel(text || 'I do not have a spoken response for that yet.', {
      channel: 'voice',
      maxLength: context.configuration?.maxVoiceLength || 900
    });
    const policy = context.futureExtensions.responsePolicy || {};
    const shouldKeepFull = ['clarification', 'confirmation', 'error'].includes(policy.responseKind);
    context.formattedVoiceResponse = shouldKeepFull
      ? channelText
      : this.firstSentence(channelText, context.configuration?.maxVoiceLength || 900);
    context.diagnostics.formatter(this.id);
    return context;
  }
}

module.exports = VoiceFormatter;
