'use strict';

const BaseInputAdapter = require('./BaseInputAdapter');

class VoiceAdapter extends BaseInputAdapter {
  constructor(options = {}) {
    super({
      ...options,
      id: 'voice',
      source: 'voice',
      aliases: ['desktop-voice', 'speech', 'microphone', 'mic'],
      sourceType: 'desktop-voice',
      priority: options.priority ?? 98,
      capabilities: ['text', 'speech-transcript', 'voice-command']
    });
  }
}

module.exports = VoiceAdapter;
