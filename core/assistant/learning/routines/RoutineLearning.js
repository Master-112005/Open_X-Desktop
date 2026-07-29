'use strict';

const { RoutineNormalizer } = require('./RoutineNormalizer');
const RoutineObservationStore = require('./RoutineObservationStore');
const RoutineSummaryService = require('./RoutineSummaryService');
const RoutineChangeDetector = require('./RoutineChangeDetector');
const RoutineCandidateStore = require('./RoutineCandidateStore');
const RoutineDiagnostics = require('./RoutineDiagnostics');

class RoutineLearning {
  constructor(options = {}) {
    this.normalizer = options.normalizer || new RoutineNormalizer();
    this.store = options.store || new RoutineObservationStore(options);
    this.summary = options.summary || new RoutineSummaryService(options);
    this.changeDetector = options.changeDetector || new RoutineChangeDetector(options);
    this.candidates = options.candidates || new RoutineCandidateStore(options);
    this.diagnostics = options.diagnostics || new RoutineDiagnostics(options);
  }

  observe(input = {}) {
    const observation = this.normalizer.normalize(input);
    if (!observation) {
      this.diagnostics.record('routine.rejected', { reason: 'invalid_observation' });
      return null;
    }
    this.store.append(observation);
    const observations = this.store.readRecent({
      routineType: observation.routineType,
      dayType: observation.dayType
    });
    const summary = this.summary.summarize(observations, {
      routineType: observation.routineType,
      dayType: observation.dayType,
      now: observation.timestamp
    });
    if (!summary) return null;
    const key = `${summary.routineType}.${summary.dayType}`;
    const previous = this.store.readSummaries().summaries[key] || null;
    const change = this.changeDetector.detect(previous, summary);
    if (change.changeDetected) this.candidates.add({ ...change, routineType: summary.routineType, dayType: summary.dayType });
    this.store.writeSummary(key, { ...summary, change });
    this.diagnostics.record('routine.updated', {
      routineType: summary.routineType,
      dayType: summary.dayType,
      observationCount: summary.observationCount,
      confidence: summary.confidence
    });
    return {
      observation,
      summary,
      change,
      learningEvent: {
        category: 'habit',
        key: `routine.${summary.routineType}.${summary.dayType}`,
        value: summary.typicalTime,
        confidence: Math.max(0.7, summary.confidence),
        source: observation.source,
        metadata: {
          routineType: summary.routineType,
          dayType: summary.dayType,
          normalStart: summary.normalStart,
          normalEnd: summary.normalEnd,
          observationCount: summary.observationCount,
          exceptionCount: summary.exceptionCount,
          stability: summary.stability,
          change
        }
      }
    };
  }
}

module.exports = RoutineLearning;
