'use strict';

const { circularDistanceMinutes } = require('./CircularTimeStatistics');

class RoutineChangeDetector {
  constructor(options = {}) {
    this.minimumRecentObservations = Math.max(3, Number(options.minimumRecentObservations || 7));
    this.changeThresholdMinutes = Math.max(15, Number(options.changeThresholdMinutes || 35));
  }

  detect(previousSummary, recentSummary) {
    if (!previousSummary || !recentSummary) {
      return { changeDetected: false, status: 'insufficient_baseline' };
    }
    const recentCount = Number(recentSummary.observationCount || recentSummary.count || 0);
    if (recentCount < this.minimumRecentObservations) {
      return { changeDetected: false, status: 'insufficient_recent_evidence' };
    }
    const distance = circularDistanceMinutes(previousSummary.typicalMinutes, recentSummary.typicalMinutes);
    const changeDetected = distance >= this.changeThresholdMinutes;
    return {
      changeDetected,
      status: changeDetected ? 'candidate_change' : 'stable',
      previousTypicalTime: previousSummary.typicalTime,
      newCandidateTime: recentSummary.typicalTime,
      shiftMinutes: Math.round(distance),
      evidenceCount: recentCount,
      changeConfidence: changeDetected ? Math.min(0.95, Number(recentSummary.confidence || 0.7)) : 0
    };
  }
}

module.exports = RoutineChangeDetector;
