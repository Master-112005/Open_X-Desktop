'use strict';

const path = require('path');
const BaseLearningModule = require('./BaseLearningModule');
const HomeEventCollector = require('../home-learning/HomeEventCollector');
const DeviceContextBuilder = require('../home-learning/DeviceContextBuilder');
const ActionSequenceLearner = require('../home-learning/ActionSequenceLearner');

class ActionSequenceLearning extends BaseLearningModule {
  constructor(options = {}) {
    super(options);
    this.collector = options.collector || new HomeEventCollector(options);
    this.contextBuilder = options.contextBuilder || new DeviceContextBuilder();
    this.sequenceLearner = options.sequenceLearner || null;
  }

  supports(context) {
    const event = context.externalEvent || {};
    const type = String(event.type || event.event || '').trim().toLowerCase();
    return super.supports(context) && ['home_device_event', 'device_event', 'appliance_event'].includes(type);
  }

  learn(context) {
    const collected = this.collector.collect(context.externalEvent);
    if (!collected.valid) {
      context.addRejected({ category: 'workflow', key: 'home.sequence', reason: collected.reason });
      return context;
    }
    const event = collected.event;
    const deviceContext = this.contextBuilder.build(event);
    for (const learningEvent of this._learner(context).observe(event, deviceContext)) {
      context.addEvent({ ...learningEvent, module: this.id });
    }
    return context;
  }

  _learner(context) {
    if (this.sequenceLearner) return this.sequenceLearner;
    const baseDir = context.configuration?.storage?.baseDir;
    const options = {};
    if (baseDir) options.filePath = path.join(baseDir, 'home-sequences.json');
    this.sequenceLearner = new ActionSequenceLearner(options);
    return this.sequenceLearner;
  }
}

module.exports = ActionSequenceLearning;
