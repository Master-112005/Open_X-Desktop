'use strict';

const fs = require('fs');
const path = require('path');
const { ensureDataRoot, readJsonFile, writeJsonAtomic } = require('../../Data');

function safeJsonLine(value) {
  return `${JSON.stringify(value).replace(/\r?\n/g, ' ')}\n`;
}

class RoutineObservationStore {
  constructor(options = {}) {
    this.config = options.config || {};
    const paths = ensureDataRoot(this.config);
    this.observationPath = path.resolve(options.observationPath || paths.routineObservationPath);
    this.summaryPath = path.resolve(options.summaryPath || paths.routineSummaryPath);
    this.maxReadLines = Math.max(50, Number(options.maxReadLines || 5000));
  }

  append(observation) {
    fs.mkdirSync(path.dirname(this.observationPath), { recursive: true, mode: 0o700 });
    fs.appendFileSync(this.observationPath, safeJsonLine(observation), { mode: 0o600 });
    return observation;
  }

  readRecent(filter = {}) {
    if (!fs.existsSync(this.observationPath)) return [];
    const lines = fs.readFileSync(this.observationPath, 'utf8').split(/\r?\n/).filter(Boolean);
    return lines
      .slice(-this.maxReadLines)
      .map(line => {
        try { return JSON.parse(line); } catch (_) { return null; }
      })
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
      validate: value => value && value.version === 1 && value.summaries && typeof value.summaries === 'object'
    });
  }

  writeSummary(key, summary) {
    const data = this.readSummaries();
    data.summaries[key] = summary;
    data.metadata.updatedAt = summary.lastUpdatedAt || new Date().toISOString();
    writeJsonAtomic(this.summaryPath, data, { backup: true });
    return summary;
  }
}

module.exports = RoutineObservationStore;
