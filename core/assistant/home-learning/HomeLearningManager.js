'use strict';

const HomeEventCollector = require('./HomeEventCollector');
const HomeEventRepository = require('./HomeEventRepository');
const DeviceRegistry = require('./DeviceRegistry');
const DeviceContextBuilder = require('./DeviceContextBuilder');
const DevicePreferenceLearner = require('./DevicePreferenceLearner');
const AppliancePatternLearner = require('./AppliancePatternLearner');
const ActionSequenceLearner = require('./ActionSequenceLearner');
const HomeRoutineLearner = require('./HomeRoutineLearner');
const HomeLearningPolicy = require('./HomeLearningPolicy');
const HomeLearningDiagnostics = require('./HomeLearningDiagnostics');

class HomeLearningManager {
  constructor(options = {}) {
    this.collector = options.collector || new HomeEventCollector(options);
    this.repository = options.repository || new HomeEventRepository(options);
    this.devices = options.devices || new DeviceRegistry(options);
    this.contextBuilder = options.contextBuilder || new DeviceContextBuilder();
    this.devicePreferences = options.devicePreferences || new DevicePreferenceLearner(options);
    this.patterns = options.patterns || new AppliancePatternLearner(options);
    this.sequences = options.sequences || new ActionSequenceLearner(options);
    this.routines = options.routines || new HomeRoutineLearner(options);
    this.policy = options.policy || new HomeLearningPolicy();
    this.diagnostics = options.diagnostics || new HomeLearningDiagnostics(options);
  }

  observe(rawEvent = {}) {
    const collected = this.collector.collect(rawEvent);
    if (!collected.valid) {
      this.diagnostics.record('home.rejected', { reason: collected.reason });
      return { accepted: false, reason: collected.reason, learningEvents: [] };
    }
    const event = collected.event;
    const device = this.devices.upsert({
      deviceId: event.deviceId,
      name: event.deviceName,
      type: event.deviceType,
      room: event.room,
      capabilities: rawEvent.capabilities || []
    });
    if (!this.policy.allowsDevice(device)) {
      return { accepted: false, reason: 'device_learning_disabled', learningEvents: [] };
    }
    const policy = this.policy.allowsEvent(event);
    if (!policy.allowed) {
      return { accepted: false, reason: policy.reason, learningEvents: [] };
    }
    const stored = this.repository.append(event);
    if (stored.duplicate) {
      this.diagnostics.record('home.duplicate', { deviceId: event.deviceId, action: event.action });
      return { accepted: true, duplicate: true, event, learningEvents: [] };
    }
    const context = this.contextBuilder.build(event, device);
    const learningEvents = [
      ...this.devicePreferences.learn(event, context),
      ...this.patterns.learn(event, context),
      ...this.routines.learn(event, context),
      ...this.sequences.observe(event, context)
    ].map(item => ({ ...item, module: item.module || 'home-learning' }));
    this.diagnostics.record('home.accepted', {
      deviceId: event.deviceId,
      action: event.action,
      learningEvents: learningEvents.length
    });
    return { accepted: true, duplicate: false, event, device, context, learningEvents };
  }
}

module.exports = HomeLearningManager;
