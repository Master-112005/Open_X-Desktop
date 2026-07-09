'use strict';

const BaseInputAdapter = require('./BaseInputAdapter');

class APIAdapter extends BaseInputAdapter {
  constructor(options = {}) {
    super({ ...options, id: 'api', source: 'api', sourceType: 'future-api', priority: options.priority ?? 60 });
  }
}

module.exports = APIAdapter;
