'use strict';

const BaseLearningModule = require('./BaseLearningModule');
const HomeEventCollector = require('../home-learning/HomeEventCollector');
const DeviceContextBuilder = require('../home-learning/DeviceContextBuilder');
const DevicePreferenceLearner = require('../home-learning/DevicePreferenceLearner');

class DevicePreferenceLearning extends BaseLearningModule {
  constructor(options = {}) {
    super(options);
    this.collector = options.collector || new HomeEventCollector(options);
    this.contextBuilder = options.contextBuilder || new DeviceContextBuilder();
    this.learner = options.learner || new DevicePreferenceLearner(options);
  }

  supports(context) {
    const event = context.externalEvent || {};
    const type = String(event.type || event.event || '').trim().toLowerCase();
    return super.supports(context) && ['home_device_event', 'device_event', 'appliance_event'].includes(type);
  }

  learn(context) {
    const collected = this.collector.collect(context.externalEvent);
    if (!collected.valid) {
      context.addRejected({ category: 'preference', key: 'home.device', reason: collected.reason });
      return context;
    }
    const event = collected.event;
    const deviceContext = this.contextBuilder.build(event);
    for (const learningEvent of this.learner.learn(event, deviceContext)) {
      context.addEvent({ ...learningEvent, module: this.id });
    }
    return context;
  }
}

module.exports = DevicePreferenceLearning;
