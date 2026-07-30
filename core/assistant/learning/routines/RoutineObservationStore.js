'use strict';

const fs = require('fs');
const path = require('path');
const {
  appendSecureJsonLine,
  ensureDataRoot,
  readSecureJsonFile: readJsonFile,
  readSecureJsonLines,
  writeSecureJsonAtomic: writeJsonAtomic
} = require('../../Data');

class RoutineObservationStore {
  constructor(options = {}) {
    this.config = options.config || {};
    const paths = ensureDataRoot(this.config);
    this.observationPath = path.resolve(options.observationPath || paths.routineObservationPath);
    this.summaryPath = path.resolve(options.summaryPath || paths.routineSummaryPath);
    this.keyPath = options.keyPath || paths.dataEncryptionKeyPath;
    this.maxReadLines = Math.max(50, Number(options.maxReadLines || 5000));
  }

  append(observation) {
    appendSecureJsonLine(this.observationPath, observation, {
      config: this.config,
      keyPath: this.keyPath
    });
    return observation;
  }

  readRecent(filter = {}) {
    if (!fs.existsSync(this.observationPath)) return [];
    return readSecureJsonLines(this.observationPath, {
      config: this.config,
      keyPath: this.keyPath,
      validate: value => Boolean(value) && typeof value === 'object'
    })
      .slice(-this.maxReadLines)
      .filter(Boolean)
      .filter(item => !filter.routineType || item.routineType === filter.routineType)
      .filter(item => !filter.dayType || item.dayType === filter.dayType);
  }

  readSummaries() {
    return readJsonFile(this.summaryPath, () => ({
      version: 1,
      summaries: {},
      metadata: { updatedAt: null }
    }), {
      createIfMissing: true,
      config: this.config,
      keyPath: this.keyPath,
      validate: value => value && value.version === 1 && value.summaries && typeof value.summaries === 'object'
    });
  }

  writeSummary(key, summary) {
    const data = this.readSummaries();
    data.summaries[key] = summary;
    data.metadata.updatedAt = summary.lastUpdatedAt || new Date().toISOString();
    writeJsonAtomic(this.summaryPath, data, { backup: true, config: this.config, keyPath: this.keyPath });
    return summary;
  }
}

module.exports = RoutineObservationStore;
