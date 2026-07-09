'use strict';

const BaseInputAdapter = require('./BaseInputAdapter');

class ChatAdapter extends BaseInputAdapter {
  constructor(options = {}) {
    super({ ...options, id: 'chat', source: 'chat', sourceType: 'desktop-chat', priority: options.priority ?? 100 });
  }
}

module.exports = ChatAdapter;
