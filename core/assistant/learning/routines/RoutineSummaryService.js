'use strict';

const RoutineConfidence = require('./RoutineConfidence');
const TimePatternAnalyzer = require('./TimePatternAnalyzer');

class RoutineSummaryService {
  constructor(options = {}) {
    this.analyzer = options.analyzer || new TimePatternAnalyzer();
    this.confidence = options.confidence || new RoutineConfidence(options);
  }

  summarize(observations = [], options = {}) {
    if (!observations.length) return null;
    const pattern = this.analyzer.analyze(observations);
    if (!pattern) return null;
    const routineType = options.routineType || observations[0].routineType;
    const dayType = options.dayType || observations[0].dayType || 'all';
    const exceptionCount = observations.filter(item => item.exception === true).length;
    const confidence = this.confidence.score({
      observations: observations.length,
      exceptions: exceptionCount,
      consistency: Math.max(0.2, 1 - Math.min(0.8, pattern.standardDeviationMinutes / 180)),
      sourceWeight: Math.max(...observations.map(item => Number(item.confidence || 0.5)))
    });
    return {
      routineType,
      dayType,
      typicalMinutes: pattern.typicalMinutes,
      typicalTime: pattern.typicalTime,
      normalStart: pattern.normalStart,
      normalEnd: pattern.normalEnd,
      standardDeviationMinutes: pattern.standardDeviationMinutes,
      normalRangeMinutes: pattern.normalRangeMinutes,
      observationCount: observations.length,
      exceptionCount,
      confidence,
      stability: Number(Math.max(0, 1 - Math.min(1, pattern.standardDeviationMinutes / 180)).toFixed(4)),
      lastUpdatedAt: options.now || new Date().toISOString()
    };
  }
}

module.exports = RoutineSummaryService;
