'use strict';

const path = require('path');
const BaseLearningModule = require('./BaseLearningModule');
const {
  HomeLearningManager,
  HomeEventRepository,
  DeviceRegistry,
  ActionSequenceLearner
} = require('../home-learning');

class HomeEventLearning extends BaseLearningModule {
  constructor(options = {}) {
    super(options);
    this.manager = options.manager || null;
  }

  supports(context) {
    const event = context.externalEvent || {};
    const type = String(event.type || event.event || '').trim().toLowerCase();
    return super.supports(context) && ['home_device_event', 'device_event', 'appliance_event'].includes(type);
  }

  learn(context) {
    const result = this._manager(context).observe(context.externalEvent);
    if (!result.accepted) {
      context.addRejected({
        category: 'pattern',
        key: 'home.event',
        reason: result.reason || 'Home event was rejected.'
      });
      return context;
    }
    for (const learningEvent of result.learningEvents || []) {
      context.addEvent({
        ...learningEvent,
        module: this.id
      });
    }
    return context;
  }

  _manager(context) {
    if (this.manager) return this.manager;
    const baseDir = context.configuration?.storage?.baseDir;
    if (baseDir) {
      this.manager = new HomeLearningManager({
        repository: new HomeEventRepository({ filePath: path.join(baseDir, 'home-events.jsonl') }),
        devices: new DeviceRegistry({ filePath: path.join(baseDir, 'home-devices.json') }),
        sequences: new ActionSequenceLearner({ filePath: path.join(baseDir, 'home-sequences.json') })
      });
      return this.manager;
    }
    this.manager = new HomeLearningManager();
    return this.manager;
  }
}

module.exports = HomeEventLearning;
