'use strict';

const { CircularTimeStatistics } = require('./CircularTimeStatistics');

class TimePatternAnalyzer {
  constructor(options = {}) {
    this.statistics = options.statistics || new CircularTimeStatistics();
  }

  analyze(observations = []) {
    const minutes = observations
      .map(item => Number(item.localTimeMinutes))
      .filter(value => Number.isFinite(value));
    return this.statistics.summarize(minutes);
  }
}

module.exports = TimePatternAnalyzer;
