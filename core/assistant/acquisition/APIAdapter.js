'use strict';

const BaseInputAdapter = require('./BaseInputAdapter');

class APIAdapter extends BaseInputAdapter {
  constructor(options = {}) {
    super({
      ...options,
      id: 'api',
      source: 'api',
      aliases: ['rest', 'http'],
      sourceType: 'future-api',
      priority: options.priority ?? 60,
      capabilities: ['text', 'structured-command']
    });
  }
}

module.exports = APIAdapter;
