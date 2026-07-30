'use strict';

const path = require('path');
const {
  ensureDataRoot,
  readSecureJsonFile: readJsonFile,
  writeSecureJsonAtomic: writeJsonAtomic
} = require('../Data');

function actionKey(event) {
  return `${event.room}.${event.deviceType}.${event.action}${event.value === null ? '' : `_${String(event.value).toLowerCase().replace(/[^a-z0-9]+/g, '_')}`}`;
}

class ActionSequenceLearner {
  constructor(options = {}) {
    this.config = options.config || {};
    const paths = ensureDataRoot(this.config);
    this.filePath = path.resolve(options.filePath || paths.homeLearningSequencePath);
    this.keyPath = options.keyPath || paths.dataEncryptionKeyPath;
    this.maxGapMs = Math.max(1000, Number(options.maxGapMs || 120000));
    this.maxSequenceLength = Math.max(2, Math.min(6, Number(options.maxSequenceLength || 4)));
    this.recent = [];
  }

  observe(event, context = {}) {
    const now = Date.parse(event.timestamp);
    this.recent = this.recent.filter(item => now - Date.parse(item.timestamp) <= this.maxGapMs);
    this.recent.push(event);
    if (this.recent.length > this.maxSequenceLength) this.recent.splice(0, this.recent.length - this.maxSequenceLength);
    if (this.recent.length < 2) return [];

    const actions = this.recent.map(actionKey);
    const data = this._read();
    const key = actions.join('>');
    const existing = data.sequences[key] || {
      sequenceId: key,
      sequenceType: 'home_device_sequence',
      actions,
      context: {
        room: context.room,
        timeRange: context.timeRange,
        dayType: context.dayType
      },
      occurrenceCount: 0,
      averageGapSeconds: [],
      minGapSeconds: [],
      maxGapSeconds: [],
      exceptionCount: 0,
      confidence: 0,
      firstObservedAt: event.timestamp,
      lastObservedAt: null
    };
    const gaps = [];
    for (let index = 1; index < this.recent.length; index += 1) {
      gaps.push(Math.max(0, Math.round((Date.parse(this.recent[index].timestamp) - Date.parse(this.recent[index - 1].timestamp)) / 1000)));
    }
    existing.occurrenceCount += 1;
    existing.averageGapSeconds = gaps.map((gap, index) => {
      const previous = Number(existing.averageGapSeconds[index] || gap);
      return Math.round(((previous * (existing.occurrenceCount - 1)) + gap) / existing.occurrenceCount);
    });
    existing.minGapSeconds = gaps.map((gap, index) => Math.min(Number(existing.minGapSeconds[index] ?? gap), gap));
    existing.maxGapSeconds = gaps.map((gap, index) => Math.max(Number(existing.maxGapSeconds[index] ?? gap), gap));
    existing.confidence = Math.min(0.95, Number((existing.occurrenceCount / (existing.occurrenceCount + 8)).toFixed(4)));
    existing.lastObservedAt = event.timestamp;
    data.sequences[key] = existing;
    data.metadata.updatedAt = event.timestamp;
    writeJsonAtomic(this.filePath, data, { backup: true, config: this.config, keyPath: this.keyPath });

    return [{
      category: 'workflow',
      key: `home.${key}`,
      value: actions.join(' > '),
      confidence: Math.max(0.72, existing.confidence),
      source: event.source || 'home_event',
      metadata: existing
    }];
  }

  _read() {
    return readJsonFile(this.filePath, () => ({
      version: 1,
      sequences: {},
      metadata: { updatedAt: null }
    }), {
      createIfMissing: true,
      config: this.config,
      keyPath: this.keyPath,
      validate: value => value && value.version === 1 && value.sequences && typeof value.sequences === 'object'
    });
  }
}

module.exports = ActionSequenceLearner;
