'use strict';

const BaseInputAdapter = require('./BaseInputAdapter');

class ChatAdapter extends BaseInputAdapter {
  constructor(options = {}) {
    super({
      ...options,
      id: 'chat',
      source: 'chat',
      aliases: ['desktop', 'text'],
      sourceType: 'desktop-chat',
      priority: options.priority ?? 100,
      capabilities: ['text', 'typed-command']
    });
  }
}

module.exports = ChatAdapter;
